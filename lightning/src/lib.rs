//! Fluid's Lightning node: rust-lightning (LDK) compiled to WASM and driven
//! by a small JS host bridge. Pure self-custody by construction:
//!
//! * The node's keys come from a `KeysManager` seeded with 32 bytes the
//!   host derives from the user's existing Fluid seed phrase (HKDF — see
//!   `deriveLightningSeed` in src/wallet-core.js). No custodian, no
//!   operator co-signing, no federation, no mint: the channel state
//!   machine is the user's own, running in the user's own browser (or, for
//!   the DripBot keeper, on the user's own always-on machine).
//! * All host services (persistence, broadcast, sockets, chain data) are
//!   dumb pipes supplied by the host through the [`HostBridge`] trait.
//!   They transport bytes; none of them can sign, redirect, or steal —
//!   the worst a broken host bridge can do is withhold service (liveness),
//!   never custody.
//! * Persistence goes through the host KV bridge. In the Fluid app the
//!   host encrypts every value with AES-GCM under a key derived from the
//!   wallet vault before it touches localStorage, so channel state at
//!   rest is protected by the same secret as the wallet itself. In the
//!   keeper the host stores the same bytes as files in a 0700 directory.
//!
//! `lightning` is compiled without its `std` feature: `std::time` traps
//! on wasm32-unknown-unknown, so — exactly like embedded no-std LDK
//! targets — the node clock is the time supplied at construction plus
//! block-header timestamps fed in by the host's chain sync.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use bitcoin::hash_types::Txid;
use bitcoin::hashes::Hash as BHash;
use bitcoin::{BlockHash, Network, Transaction};

use bitcoin::consensus::Encodable as _;
use lightning::chain::chaininterface::{BroadcasterInterface, ConfirmationTarget, FeeEstimator};
use lightning::chain::channelmonitor::ChannelMonitor;
use lightning::chain::chainmonitor::ChainMonitor;
use lightning::chain::{Filter, Watch};
use lightning::ln::channelmanager::ChainParameters;
use lightning::ln::peer_handler::{IgnoringMessageHandler, MessageHandler, PeerManager};
use lightning::onion_message::messenger::{DefaultMessageRouter, OnionMessenger};
use lightning::routing::gossip::{NetworkGraph, P2PGossipSync};
use lightning::routing::router::{DefaultRouter, PaymentParameters, RouteParameters};
use lightning::routing::scoring::{ProbabilisticScorer, ProbabilisticScoringDecayParameters, ProbabilisticScoringFeeParameters};
use lightning::chain::Confirm as _;
use lightning::events::EventsProvider as _;
use lightning::sign::{EntropySource as _, InMemorySigner, KeysManager, NodeSigner, Recipient};
use lightning::util::config::UserConfig;
use lightning::util::logger::{Level, Logger, Record};
use lightning::util::persist::KVStoreSync;
use lightning::util::ser::Writeable;
use lightning::ln::channelmanager::PaymentId;
use lightning_types::payment::PaymentHash;

// ---------------------------------------------------------------------------
// Host bridge
// ---------------------------------------------------------------------------

/// Everything the node needs from its environment. Implementations exist
/// for the browser (WASM imports backed by encrypted localStorage,
/// WebSocket, Esplora fetches) and for the keeper (Node: fs + net).
pub trait HostBridge: Send + Sync {
    fn kv_read(&self, key: &str) -> Option<Vec<u8>>;
    fn kv_write(&self, key: &str, value: &[u8]);
    fn kv_remove(&self, key: &str);
    fn kv_list(&self, prefix: &str) -> Vec<String>;
    /// Fire-and-forget raw transaction broadcast (hex-encoded by caller).
    fn broadcast_tx(&self, tx_bytes: &[u8]);
    /// Ask the host to open the byte-stream connection for `conn_id`.
    /// The host reports data/close through the node's socket methods and
    /// must never call back into the node synchronously from `ws_open`
    /// or `ws_notify`.
    fn ws_open(&self, conn_id: u32, host: &str, port: u16);
    /// Poked whenever outbound bytes are queued for `conn_id`; the host
    /// drains them with `take_outbound`.
    fn ws_notify(&self, conn_id: u32);
    fn ws_close(&self, conn_id: u32);
    fn log(&self, msg: &str);
}

// ---------------------------------------------------------------------------
// LDK service implementations backed by the host bridge
// ---------------------------------------------------------------------------

pub struct HostLogger {
    host: Arc<dyn HostBridge>,
}
impl Logger for HostLogger {
    fn log(&self, record: Record) {
        // Trace/Debug/Gossip are far too chatty to cross the bridge.
        if record.level == Level::Trace || record.level == Level::Debug || record.level == Level::Gossip {
            return;
        }
        self.host.log(&format!("[ldk:{}] {} — {}", record.level, record.module_path, record.args));
    }
}

pub struct HostFees {
    pub background_sat_kwu: AtomicU32,
    pub normal_sat_kwu: AtomicU32,
    pub high_priority_sat_kwu: AtomicU32,
}
impl HostFees {
    pub fn new() -> Self {
        // Conservative mainnet-ish defaults (sat/kwu) until the host
        // pushes real estimates: 1, 3 and 10 sat/vB.
        Self {
            background_sat_kwu: AtomicU32::new(250),
            normal_sat_kwu: AtomicU32::new(750),
            high_priority_sat_kwu: AtomicU32::new(2500),
        }
    }
    pub fn set(&self, background: u32, normal: u32, high: u32) {
        self.background_sat_kwu.store(background.max(253), Ordering::Relaxed);
        self.normal_sat_kwu.store(normal.max(253), Ordering::Relaxed);
        self.high_priority_sat_kwu.store(high.max(253), Ordering::Relaxed);
    }
}
impl FeeEstimator for HostFees {
    fn get_est_sat_per_1000_weight(&self, confirmation_target: ConfirmationTarget) -> u32 {
        match confirmation_target {
            ConfirmationTarget::ChannelCloseMinimum => {
                self.background_sat_kwu.load(Ordering::Relaxed)
            }
            ConfirmationTarget::MaximumFeeEstimate | ConfirmationTarget::UrgentOnChainSweep => {
                self.high_priority_sat_kwu.load(Ordering::Relaxed)
            }
            _ => self.normal_sat_kwu.load(Ordering::Relaxed),
        }
    }
}

pub struct HostBroadcaster {
    host: Arc<dyn HostBridge>,
}
impl BroadcasterInterface for HostBroadcaster {
    fn broadcast_transactions(&self, txs: &[&Transaction]) {
        for tx in txs {
            let mut bytes = Vec::new();
            tx.consensus_encode(&mut bytes).expect("tx encoding cannot fail");
            self.host.broadcast_tx(&bytes);
        }
    }
}

/// KVStore over the host bridge. Full key in LDK's namespace layout is
/// primary_namespace/secondary_namespace/key; we flatten with '/'.
pub struct HostStore {
    host: Arc<dyn HostBridge>,
}
fn flat_key(primary: &str, secondary: &str, key: &str) -> String {
    if secondary.is_empty() {
        format!("{primary}/{key}")
    } else {
        format!("{primary}/{secondary}/{key}")
    }
}
impl KVStoreSync for HostStore {
    fn read(
        &self, primary_namespace: &str, secondary_namespace: &str, key: &str,
    ) -> Result<Vec<u8>, bitcoin_io::Error> {
        self.host
            .kv_read(&flat_key(primary_namespace, secondary_namespace, key))
            .ok_or_else(|| bitcoin_io::ErrorKind::NotFound.into())
    }
    fn write(
        &self, primary_namespace: &str, secondary_namespace: &str, key: &str, buf: Vec<u8>,
    ) -> Result<(), bitcoin_io::Error> {
        self.host.kv_write(&flat_key(primary_namespace, secondary_namespace, key), &buf);
        Ok(())
    }
    fn remove(
        &self, primary_namespace: &str, secondary_namespace: &str, key: &str, _lazy: bool,
    ) -> Result<(), bitcoin_io::Error> {
        self.host.kv_remove(&flat_key(primary_namespace, secondary_namespace, key));
        Ok(())
    }
    fn list(
        &self, primary_namespace: &str, secondary_namespace: &str,
    ) -> Result<Vec<String>, bitcoin_io::Error> {
        let prefix = if secondary_namespace.is_empty() {
            format!("{primary_namespace}/")
        } else {
            format!("{primary_namespace}/{secondary_namespace}/")
        };
        let full = self.host.kv_list(&prefix);
        Ok(full.iter().map(|k| k[prefix.len()..].to_string()).collect())
    }
}


// ---------------------------------------------------------------------------
// Peer sockets: LDK sees a SocketDescriptor; the host moves the bytes.
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct ConnDesc {
    pub id: u32,
    host: Arc<dyn HostBridge>,
    outbound: Arc<Mutex<Vec<u8>>>,
}
impl PartialEq for ConnDesc {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}
impl Eq for ConnDesc {}
impl std::hash::Hash for ConnDesc {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.id.hash(state);
    }
}
impl lightning::ln::peer_handler::SocketDescriptor for ConnDesc {
    fn send_data(&mut self, data: &[u8], _resume_read: bool) -> usize {
        self.outbound.lock().unwrap().extend_from_slice(data);
        self.host.ws_notify(self.id);
        data.len()
    }
    fn disconnect_socket(&mut self) {
        self.host.ws_close(self.id);
    }
}

// ---------------------------------------------------------------------------
// Chain filter: records what LDK wants watched so the host's Esplora
// driver knows which transactions/outputs to confirm.
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct FilterRegs {
    pub txids: Vec<(Txid, bitcoin::ScriptBuf)>,
    pub outputs: Vec<lightning::chain::WatchedOutput>,
}
pub struct HostFilter {
    pub regs: Arc<Mutex<FilterRegs>>,
}
impl Filter for HostFilter {
    fn register_tx(&self, txid: &Txid, script_pubkey: &bitcoin::Script) {
        self.regs.lock().unwrap().txids.push((*txid, script_pubkey.to_owned()));
    }
    fn register_output(&self, output: lightning::chain::WatchedOutput) {
        self.regs.lock().unwrap().outputs.push(output);
    }
}

// ---------------------------------------------------------------------------
// Concrete LDK type stack
// ---------------------------------------------------------------------------

pub type Km = KeysManager;
pub type Signer = InMemorySigner;
pub type Monitor = ChannelMonitor<Signer>;
pub type Graph = NetworkGraph<Arc<HostLogger>>;
pub type Scorer = ProbabilisticScorer<Arc<Graph>, Arc<HostLogger>>;
pub type RouterT = DefaultRouter<
    Arc<Graph>,
    Arc<HostLogger>,
    Arc<Km>,
    Arc<std::cell::RefCell<Scorer>>,
    ProbabilisticScoringFeeParameters,
    Scorer,
>;
/// Fluid's onion-message router. `find_path` delegates to LDK's
/// DefaultMessageRouter unchanged. `create_blinded_paths` deliberately
/// diverges in ONE bounded way: the default router only builds offer
/// paths through peers that already appear in the gossip graph (or when
/// there is exactly one peer), which strands a light-client wallet whose
/// graph may not yet contain its own LSP. Fluid instead builds padded
/// blinded paths through the user's OWN connected channel peers — the
/// peers the offers flow already vetted (connected, onion-message
/// capable, with a usable channel). It never introduces strangers from
/// the graph. See docs/LIGHTNING.md.
pub struct FluidMessageRouter {
    inner: Arc<DefaultMessageRouter<Arc<Graph>, Arc<HostLogger>, Arc<Km>>>,
    entropy: Arc<Km>,
}
impl lightning::onion_message::messenger::MessageRouter for FluidMessageRouter {
    fn find_path(
        &self, sender: bitcoin::secp256k1::PublicKey, peers: Vec<bitcoin::secp256k1::PublicKey>,
        destination: lightning::onion_message::messenger::Destination,
    ) -> Result<lightning::onion_message::messenger::OnionMessagePath, ()> {
        use lightning::onion_message::messenger::MessageRouter as _;
        self.inner.find_path(sender, peers, destination)
    }
    fn create_blinded_paths<T: bitcoin::secp256k1::Signing + bitcoin::secp256k1::Verification>(
        &self, recipient: bitcoin::secp256k1::PublicKey,
        local_node_receive_key: lightning::sign::ReceiveAuthKey,
        context: lightning::blinded_path::message::MessageContext,
        peers: Vec<lightning::blinded_path::message::MessageForwardNode>,
        secp_ctx: &bitcoin::secp256k1::Secp256k1<T>,
    ) -> Result<Vec<lightning::blinded_path::message::BlindedMessagePath>, ()> {
        if peers.is_empty() {
            return Err(());
        }
        // Paths are built one per peer (max 3, like the default), each
        // padded with dummy hops to the same total length (4) the
        // default produces. One special case first: if the recipient
        // is itself one of our connected peers, the canonical one-hop
        // path (introduction node = the recipient, no intermediate
        // hops) leads the list — it is the one path whose first hop is
        // deliverable by construction, and several LDK call sites use
        // only the first path (e.g. reply paths on responses).
        let mut out = Vec::new();
        if peers.iter().any(|p| p.node_id == recipient) {
            out.push(lightning::blinded_path::message::BlindedMessagePath::one_hop(
                recipient,
                local_node_receive_key,
                context.clone(),
                &*self.entropy,
                secp_ctx,
            ));
        }
        for peer in peers.iter().take(3) {
            let hop = lightning::blinded_path::message::MessageForwardNode {
                node_id: peer.node_id,
                short_channel_id: None,
            };
            out.push(lightning::blinded_path::message::BlindedMessagePath::new_with_dummy_hops(
                &[hop],
                recipient,
                2,
                local_node_receive_key,
                context.clone(),
                &*self.entropy,
                secp_ctx,
            ));
        }
        Ok(out)
    }
}
pub type MessageRouterT = FluidMessageRouter;
pub type ChainMonitorT = ChainMonitor<
    Signer,
    Arc<HostFilter>,
    Arc<HostBroadcaster>,
    Arc<HostFees>,
    Arc<HostLogger>,
    Arc<HostStore>,
    Arc<Km>,
>;
pub type ChannelManagerT = lightning::ln::channelmanager::ChannelManager<
    Arc<ChainMonitorT>,
    Arc<HostBroadcaster>,
    Arc<Km>,
    Arc<Km>,
    Arc<Km>,
    Arc<HostFees>,
    Arc<RouterT>,
    Arc<MessageRouterT>,
    Arc<HostLogger>,
>;
pub type OnionMessengerT = OnionMessenger<
    Arc<Km>,
    Arc<Km>,
    Arc<HostLogger>,
    Arc<lightning::blinded_path::EmptyNodeIdLookUp>,
    Arc<MessageRouterT>,
    Arc<ChannelManagerT>,
    Arc<ChannelManagerT>,
    IgnoringMessageHandler,
    IgnoringMessageHandler,
>;
/// Placeholder UTXO-lookup type: the gossip sync is constructed with
/// `None` (light-client mode — announcements are not UTXO-verified,
/// which is the standard trade-off for a wallet that routes primarily
/// through its own channel peer and invoice route hints).
pub struct NoUtxo;
impl lightning::routing::utxo::UtxoLookup for NoUtxo {
    fn get_utxo(
        &self, _chain_hash: &bitcoin::constants::ChainHash, _scid: u64,
    ) -> lightning::routing::utxo::UtxoResult {
        unreachable!("NoUtxo is only a type parameter; None is always passed")
    }
}
pub type GossipT = P2PGossipSync<Arc<Graph>, Arc<NoUtxo>, Arc<HostLogger>>;
pub type PeerManagerT = PeerManager<
    ConnDesc,
    Arc<ChannelManagerT>,
    Arc<GossipT>,
    Arc<OnionMessengerT>,
    Arc<HostLogger>,
    IgnoringMessageHandler,
    Arc<Km>,
    IgnoringMessageHandler,
>;

// ---------------------------------------------------------------------------
// Small JSON writer (no serde dependency — the surface is tiny and flat)
// ---------------------------------------------------------------------------

pub fn jstr(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}
pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
pub fn unhex(s: &str) -> Result<Vec<u8>, String> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    if s.len() % 2 != 0 {
        return Err("odd-length hex string".into());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| "invalid hex".to_string()))
        .collect()
}

// ---------------------------------------------------------------------------
// The node
// ---------------------------------------------------------------------------

/// Shared sinks the event handler writes to (events for the UI,
/// durable payment history, pending funding requests).
#[derive(Clone)]
pub struct Sinks {
    pub events: Arc<Mutex<Vec<String>>>,
    pub history: Arc<Mutex<Vec<String>>>,
    pub pending_funding: Arc<Mutex<Vec<FundingReq>>>,
    pub host: Arc<dyn HostBridge>,
}
impl Sinks {
    fn ev(&self, json: String) {
        self.events.lock().unwrap().push(json);
    }
    fn hist(&self, json: String) {
        let mut h = self.history.lock().unwrap();
        h.push(json);
        if h.len() > 300 {
            let excess = h.len() - 300;
            h.drain(..excess);
        }
        let joined = format!("[{}]", h.join(","));
        drop(h);
        self.host.kv_write("history", joined.as_bytes());
    }
}

pub struct FundingReq {
    pub user_channel_id: u128,
    pub temporary_channel_id_hex: String,
    pub counterparty: String,
    pub value_sat: u64,
    pub script_pubkey_hex: String,
}

pub struct NodeInner {
    pub host: Arc<dyn HostBridge>,
    pub network: Network,
    pub keys_manager: Arc<Km>,
    pub fee_est: Arc<HostFees>,
    pub store: Arc<HostStore>,
    pub logger: Arc<HostLogger>,
    pub graph: Arc<Graph>,
    pub chain_monitor: Arc<ChainMonitorT>,
    pub channel_manager: Arc<ChannelManagerT>,
    pub peer_manager: Arc<PeerManagerT>,
    pub filter: Arc<HostFilter>,
    pub sinks: Sinks,
    pub conns: Mutex<HashMap<u32, Arc<Mutex<Vec<u8>>>>>,
    pub next_conn: AtomicU32,
    pub started_at: AtomicU64,
    pub tip_time: AtomicU64,
    pub dirty: AtomicBool,
}

impl NodeInner {
    /// The node's clock: host wall-clock at start, then block-header
    /// time as chain sync advances (no-std LDK convention).
    pub fn now_secs(&self) -> u64 {
        self.tip_time.load(Ordering::Relaxed).max(self.started_at.load(Ordering::Relaxed))
    }

    pub fn node_id(&self) -> String {
        self.keys_manager
            .get_node_id(Recipient::Node)
            .map(|k| k.to_string())
            .unwrap_or_else(|_| "error".into())
    }

    fn push_event(&self, json: String) {
        self.sinks.ev(json);
        self.dirty.store(true, Ordering::Relaxed);
    }
    fn push_history(&self, json: String) {
        self.sinks.hist(json);
        self.dirty.store(true, Ordering::Relaxed);
    }
    pub fn persist_manager(&self) {
        let mut bytes = Vec::new();
        if self.channel_manager.write(&mut bytes).is_ok() {
            self.host.kv_write("manager", &bytes);
        }
        let mut gbytes = Vec::new();
        if self.graph.write(&mut gbytes).is_ok() {
            self.host.kv_write("graph", &gbytes);
        }
    }
}

fn net_params(network: Network) -> (bitcoin::BlockHash, &'static str) {
    match network {
        Network::Bitcoin => (bitcoin::constants::genesis_block(Network::Bitcoin).block_hash(), "bitcoin"),
        Network::Testnet => (bitcoin::constants::genesis_block(Network::Testnet).block_hash(), "testnet"),
        Network::Signet => (bitcoin::constants::genesis_block(Network::Signet).block_hash(), "signet"),
        Network::Regtest => (bitcoin::constants::genesis_block(Network::Regtest).block_hash(), "regtest"),
        _ => (bitcoin::constants::genesis_block(Network::Bitcoin).block_hash(), "bitcoin"),
    }
}

impl NodeInner {
    /// Construct (or restore) the node. `seed32` is the 32-byte
    /// HKDF-derived Lightning seed from the host. `tip_*` describe the
    /// host's current chain tip; `now_secs` is the host's wall clock,
    /// used only as the no-std clock's starting value (block headers
    /// keep it honest afterwards).
    pub fn new(
        host: Arc<dyn HostBridge>, seed32: &[u8; 32], network: Network, tip_height: u32,
        tip_hash: BlockHash, now_secs: u64,
    ) -> Result<Arc<NodeInner>, String> {
        use lightning::util::ser::ReadableArgs;
        let keys_manager = Arc::new(KeysManager::new(seed32, now_secs, 0, true));
        let logger = Arc::new(HostLogger { host: host.clone() });
        let fee_est = Arc::new(HostFees::new());
        let store = Arc::new(HostStore { host: host.clone() });
        let broadcaster = Arc::new(HostBroadcaster { host: host.clone() });
        let filter = Arc::new(HostFilter { regs: Arc::new(Mutex::new(FilterRegs::default())) });

        // Network graph: restore or create.
        let graph = {
            let restored = host.kv_read("graph").and_then(|bytes| {
                let mut r = &bytes[..];
                Graph::read(&mut r, logger.clone()).ok()
            });
            Arc::new(restored.unwrap_or_else(|| NetworkGraph::new(network, logger.clone())))
        };
        let scorer = Arc::new(std::cell::RefCell::new(ProbabilisticScorer::new(
            ProbabilisticScoringDecayParameters::default(),
            graph.clone(),
            logger.clone(),
        )));
        let router = Arc::new(DefaultRouter::new(
            graph.clone(),
            logger.clone(),
            keys_manager.clone(),
            scorer.clone(),
            ProbabilisticScoringFeeParameters::default(),
        ));
        let message_router = Arc::new(FluidMessageRouter {
            inner: Arc::new(DefaultMessageRouter::new(graph.clone(), keys_manager.clone())),
            entropy: keys_manager.clone(),
        });
        let chain_monitor = Arc::new(ChainMonitor::new(
            Some(filter.clone()),
            broadcaster.clone(),
            logger.clone(),
            fee_est.clone(),
            store.clone(),
            keys_manager.clone(),
            keys_manager.get_peer_storage_key(),
        ));

        let mut config = UserConfig::default();
        config.channel_handshake_config.our_to_self_delay = 144;
        config.manually_accept_inbound_channels = false;

        // Channel monitors first: the manager read needs them.
        let monitors = lightning::util::persist::read_channel_monitors(
            store.clone(),
            keys_manager.clone(),
            keys_manager.clone(),
        )
        .map_err(|e| format!("could not read stored channel monitors: {e}"))?;

        let channel_manager: Arc<ChannelManagerT> = match host.kv_read("manager") {
            Some(bytes) => {
                let monitor_refs: Vec<&Monitor> = monitors.iter().map(|(_, m)| m).collect();
                let read_args = lightning::ln::channelmanager::ChannelManagerReadArgs::new(
                    keys_manager.clone(),
                    keys_manager.clone(),
                    keys_manager.clone(),
                    fee_est.clone(),
                    chain_monitor.clone(),
                    broadcaster.clone(),
                    router.clone(),
                    message_router.clone(),
                    logger.clone(),
                    config,
                    monitor_refs,
                );
                let mut reader = &bytes[..];
                let (_hash, manager) = <(BlockHash, ChannelManagerT)>::read(&mut reader, read_args)
                    .map_err(|e| format!("could not read stored channel manager: {e:?}"))?;
                Arc::new(manager)
            }
            None => {
                let best_block = lightning::chain::BestBlock::new(tip_hash, tip_height);
                Arc::new(ChannelManagerT::new(
                    fee_est.clone(),
                    chain_monitor.clone(),
                    broadcaster.clone(),
                    router.clone(),
                    message_router.clone(),
                    logger.clone(),
                    keys_manager.clone(),
                    keys_manager.clone(),
                    keys_manager.clone(),
                    config,
                    ChainParameters { network, best_block },
                    now_secs as u32,
                ))
            }
        };
        // Re-watch every restored monitor.
        for (_hash, monitor) in monitors.into_iter() {
            let funding_txo = monitor.get_funding_txo();
            let _ = chain_monitor.watch_channel(monitor.channel_id(), monitor);
            let _ = funding_txo;
        }

        let onion_messenger = Arc::new(OnionMessenger::new(
            keys_manager.clone(),
            keys_manager.clone(),
            logger.clone(),
            Arc::new(lightning::blinded_path::EmptyNodeIdLookUp {}),
            message_router.clone(),
            channel_manager.clone(),
            channel_manager.clone(),
            IgnoringMessageHandler {},
            IgnoringMessageHandler {},
        ));
        let gossip = Arc::new(P2PGossipSync::new(graph.clone(), None::<Arc<NoUtxo>>, logger.clone()));
        let message_handler = MessageHandler {
            chan_handler: channel_manager.clone(),
            route_handler: gossip.clone(),
            onion_message_handler: onion_messenger.clone(),
            custom_message_handler: IgnoringMessageHandler {},
            send_only_message_handler: IgnoringMessageHandler {},
        };
        let ephemeral: [u8; 32] = keys_manager.get_secure_random_bytes();
        let peer_manager = Arc::new(PeerManager::new(
            message_handler,
            now_secs as u32,
            &ephemeral,
            logger.clone(),
            keys_manager.clone(),
        ));

        let history: Vec<String> = host
            .kv_read("history")
            .and_then(|b| {
                let s = String::from_utf8(b).ok()?;
                let inner = s.strip_prefix('[')?.strip_suffix(']')?;
                if inner.is_empty() {
                    Some(Vec::new())
                } else {
                    // History entries are flat JSON objects without
                    // nested arrays/objects, so a top-level scan suffices.
                    let mut out = Vec::new();
                    let mut depth = 0i32;
                    let mut start = None;
                    for (i, c) in inner.char_indices() {
                        match c {
                            '{' => {
                                if depth == 0 {
                                    start = Some(i);
                                }
                                depth += 1;
                            }
                            '}' => {
                                depth -= 1;
                                if depth == 0 {
                                    if let Some(st) = start {
                                        out.push(inner[st..=i].to_string());
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    Some(out)
                }
            })
            .unwrap_or_default();

        let sinks = Sinks {
            events: Arc::new(Mutex::new(Vec::new())),
            history: Arc::new(Mutex::new(history)),
            pending_funding: Arc::new(Mutex::new(Vec::new())),
            host: host.clone(),
        };
        Ok(Arc::new(NodeInner {
            host,
            network,
            keys_manager,
            fee_est,
            store,
            logger,
            graph,
            chain_monitor,
            channel_manager,
            peer_manager,
            filter,
            sinks,
            conns: Mutex::new(HashMap::new()),
            next_conn: AtomicU32::new(1),
            started_at: AtomicU64::new(now_secs),
            tip_time: AtomicU64::new(now_secs),
            dirty: AtomicBool::new(false),
        }))
    }
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

use lightning::events::{Event, PaymentPurpose, ReplayEvent};

pub struct NodeEventHandler {
    cm: Arc<ChannelManagerT>,
    sinks: Sinks,
    host: Arc<dyn HostBridge>,
}

impl NodeEventHandler {
    fn ev(&self, json: String) {
        self.sinks.ev(json);
    }
    fn hist(&self, json: String) {
        self.sinks.hist(json);
    }
}

impl lightning::events::EventHandler for NodeEventHandler {
    fn handle_event(&self, event: Event) -> Result<(), ReplayEvent> {
        let cm = &self.cm;
        match event {
            Event::FundingGenerationReady {
                temporary_channel_id, counterparty_node_id, channel_value_satoshis, output_script, user_channel_id,
            } => {
                self.sinks.pending_funding.lock().unwrap().push(FundingReq {
                    temporary_channel_id_hex: hex(&temporary_channel_id.0),
                    user_channel_id,
                    counterparty: counterparty_node_id.to_string(),
                    value_sat: channel_value_satoshis,
                    script_pubkey_hex: hex(&output_script.into_bytes()),
                });
                self.ev(format!(
                    "{{\"type\":\"funding_needed\",\"userChannelId\":\"{user_channel_id:032x}\",\"temporaryChannelId\":{},\"counterparty\":{},\"valueSat\":{channel_value_satoshis}}}",
                    jstr(&hex(&temporary_channel_id.0)),
                    jstr(&counterparty_node_id.to_string()),
                ));
            }
            Event::PaymentClaimable { payment_hash, amount_msat, purpose, claim_deadline, .. } => {
                let preimage = match &purpose {
                    PaymentPurpose::Bolt11InvoicePayment { payment_preimage, .. } => *payment_preimage,
                    PaymentPurpose::Bolt12OfferPayment { payment_preimage, .. } => *payment_preimage,
                    PaymentPurpose::Bolt12RefundPayment { payment_preimage, .. } => *payment_preimage,
                    PaymentPurpose::SpontaneousPayment(p) => Some(*p),
                };
                match preimage {
                    Some(p) => {
                        cm.claim_funds(p);
                        self.ev(format!(
                            "{{\"type\":\"payment_claimable\",\"paymentHash\":{},\"amountMsat\":{amount_msat},\"claimDeadline\":{},\"claimed\":true}}",
                            jstr(&hex(&payment_hash.0)),
                            claim_deadline.map(|d| d.to_string()).unwrap_or_else(|| "null".into()),
                        ));
                    }
                    None => {
                        self.ev(format!(
                            "{{\"type\":\"payment_claimable\",\"paymentHash\":{},\"amountMsat\":{amount_msat},\"claimed\":false,\"note\":\"no preimage available\"}}",
                            jstr(&hex(&payment_hash.0)),
                        ));
                    }
                }
            }
            Event::PaymentClaimed { payment_hash, amount_msat, purpose, .. } => {
                let kind = match purpose {
                    PaymentPurpose::Bolt11InvoicePayment { .. } => "bolt11",
                    PaymentPurpose::Bolt12OfferPayment { .. } => "bolt12_offer",
                    PaymentPurpose::Bolt12RefundPayment { .. } => "bolt12_refund",
                    PaymentPurpose::SpontaneousPayment(_) => "spontaneous",
                };
                self.hist(format!(
                    "{{\"dir\":\"in\",\"kind\":\"{kind}\",\"paymentHash\":{},\"amountMsat\":{amount_msat}}}",
                    jstr(&hex(&payment_hash.0)),
                ));
                self.ev(format!(
                    "{{\"type\":\"payment_received\",\"paymentHash\":{},\"amountMsat\":{amount_msat},\"kind\":\"{kind}\"}}",
                    jstr(&hex(&payment_hash.0)),
                ));
            }
            Event::PaymentSent { payment_id, payment_hash, payment_preimage, fee_paid_msat, .. } => {
                self.hist(format!(
                    "{{\"dir\":\"out\",\"paymentId\":{},\"paymentHash\":{},\"paymentPreimage\":{},\"feePaidMsat\":{}}}",
                    jstr(&payment_id.map(|p| hex(&p.0)).unwrap_or_default()),
                    jstr(&hex(&payment_hash.0)),
                    jstr(&hex(&payment_preimage.0)),
                    fee_paid_msat.map(|f| f.to_string()).unwrap_or_else(|| "null".into()),
                ));
                self.ev(format!(
                    "{{\"type\":\"payment_sent\",\"paymentHash\":{}}}",
                    jstr(&hex(&payment_hash.0)),
                ));
            }
            Event::PaymentFailed { payment_id, payment_hash, reason, .. } => {
                self.hist(format!(
                    "{{\"dir\":\"out_failed\",\"paymentId\":{},\"paymentHash\":{},\"reason\":{}}}",
                    jstr(&hex(&payment_id.0)),
                    jstr(&payment_hash.map(|h| hex(&h.0)).unwrap_or_default()),
                    jstr(&format!("{reason:?}")),
                ));
                self.ev(format!(
                    "{{\"type\":\"payment_failed\",\"paymentHash\":{},\"reason\":{}}}",
                    jstr(&payment_hash.map(|h| hex(&h.0)).unwrap_or_default()),
                    jstr(&format!("{reason:?}")),
                ));
            }
            Event::ChannelReady { channel_id, user_channel_id, channel_type, .. } => {
                self.ev(format!(
                    "{{\"type\":\"channel_ready\",\"channelId\":{},\"userChannelId\":\"{user_channel_id:032x}\",\"channelType\":{}}}",
                    jstr(&hex(&channel_id.0)),
                    jstr(&format!("{channel_type:?}")),
                ));
            }
            Event::ChannelClosed { channel_id, user_channel_id, reason, .. } => {
                self.ev(format!(
                    "{{\"type\":\"channel_closed\",\"channelId\":{},\"userChannelId\":\"{user_channel_id:032x}\",\"reason\":{}}}",
                    jstr(&hex(&channel_id.0)),
                    jstr(&format!("{reason:?}")),
                ));
            }
            Event::ChannelPending { channel_id, user_channel_id, counterparty_node_id, .. } => {
                self.ev(format!(
                    "{{\"type\":\"channel_pending\",\"channelId\":{},\"userChannelId\":\"{user_channel_id:032x}\",\"counterparty\":{}}}",
                    jstr(&hex(&channel_id.0)),
                    jstr(&counterparty_node_id.to_string()),
                ));
            }
            Event::PersistStaticInvoice { invoice, invoice_request_path, invoice_slot, recipient_id, invoice_persisted_path } => {
                // We are acting as a static invoice server: persist the
                // invoice (and the path invoice requests arrive on) so we
                // can serve it while the recipient is offline.
                let mut ibytes = Vec::new();
                let mut pbytes = Vec::new();
                let ok = invoice.write(&mut ibytes).is_ok()
                    && invoice_request_path.write(&mut pbytes).is_ok();
                if ok {
                    self.host.kv_write(&format!("static_invoice/{invoice_slot}"), &ibytes);
                    self.host.kv_write(&format!("static_invoice/{invoice_slot}/path"), &pbytes);
                    cm.static_invoice_persisted(invoice_persisted_path);
                    self.ev(format!(
                        "{{\"type\":\"static_invoice_stored\",\"slot\":{invoice_slot},\"recipientId\":{}}}",
                        jstr(&String::from_utf8_lossy(&recipient_id)),
                    ));
                }
            }
            Event::StaticInvoiceRequested { recipient_id, invoice_slot, reply_path, invoice_request, .. } => {
                self.ev(format!(
                    "{{\"type\":\"static_invoice_requested\",\"slot\":{invoice_slot},\"recipientId\":{}}}",
                    jstr(&String::from_utf8_lossy(&recipient_id)),
                ));
                // Serve the invoice we persisted for this slot, if any.
                if let (Some(ibytes), Some(pbytes)) = (
                    self.host.kv_read(&format!("static_invoice/{invoice_slot}")),
                    self.host.kv_read(&format!("static_invoice/{invoice_slot}/path")),
                ) {
                    use lightning::util::ser::Readable as _;
                    let mut preader = &pbytes[..];
                    if let (Ok(inv), Ok(path)) = (
                        lightning::offers::static_invoice::StaticInvoice::try_from(ibytes),
                        lightning::blinded_path::message::BlindedMessagePath::read(&mut preader),
                    ) {
                        let _ = cm.respond_to_static_invoice_request(inv, reply_path, invoice_request, path);
                    }
                }
            }
            Event::OnionMessageIntercepted { peer_node_id, message } => {
                // A message for an offline peer we serve: hold it (bounded)
                // and forward when the peer reconnects (OnionMessagePeerConnected).
                let mut bytes = Vec::new();
                if message.write(&mut bytes).is_ok() {
                    let key = format!("held_om/{}", peer_node_id);
                    let mut held = self.host.kv_read(&key).unwrap_or_default();
                    // Cap held data per peer at ~256KB to bound abuse.
                    if held.len() + bytes.len() <= 256 * 1024 {
                        held.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
                        held.extend_from_slice(&bytes);
                        self.host.kv_write(&key, &held);
                    }
                }
                self.ev(format!(
                    "{{\"type\":\"held_message_stored\",\"peer\":{}}}",
                    jstr(&peer_node_id.to_string()),
                ));
            }
            Event::OnionMessagePeerConnected { peer_node_id } => {
                self.ev(format!(
                    "{{\"type\":\"peer_back_online\",\"peer\":{}}}",
                    jstr(&peer_node_id.to_string()),
                ));
            }
            Event::InvoiceReceived { .. } => {
                self.ev("{\"type\":\"invoice_received\"}".to_string());
            }
            Event::SpendableOutputs { outputs, channel_id: _ } => {
                let total: u64 = outputs
                    .iter()
                    .map(|o| match o {
                        lightning::sign::SpendableOutputDescriptor::DelayedPaymentOutput(d) => {
                            d.output.value.to_sat()
                        }
                        lightning::sign::SpendableOutputDescriptor::StaticPaymentOutput(d) => {
                            d.output.value.to_sat()
                        }
                        lightning::sign::SpendableOutputDescriptor::StaticOutput { .. } => 0,
                    })
                    .sum();
                self.ev(format!(
                    "{{\"type\":\"spendable_outputs\",\"count\":{},\"totalSat\":{total},\"note\":\"on-chain outputs from a closed channel are spendable by the wallet seed; sweep support is a separate tool\"}}",
                    outputs.len(),
                ));
            }
            Event::HTLCIntercepted { .. } => {
                self.ev("{\"type\":\"htlc_intercepted\"}".to_string());
            }
            Event::BumpTransaction(event) => {
                self.ev(format!(
                    "{{\"type\":\"bump_transaction\",\"detail\":{}}}",
                    jstr(&format!("{event:?}")),
                ));
            }
            other => {
                self.ev(format!("{{\"type\":\"ldk_event\",\"detail\":{}}}", jstr(&format!("{other:?}"))));
            }
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Peer connections, chain sync, ticking
// ---------------------------------------------------------------------------

impl NodeInner {
    pub fn handler(&self) -> NodeEventHandler {
        NodeEventHandler {
            cm: self.channel_manager.clone(),
            sinks: self.sinks.clone(),
            host: self.host.clone(),
        }
    }

    /// Open a connection to a peer. The host bridge performs the actual
    /// transport (WebSocket in the browser, TCP in the keeper); LDK's
    /// Noise handshake starts as soon as the descriptor is registered.
    pub fn connect_peer(self: &Arc<Self>, pubkey_hex: &str, host: &str, port: u16) -> Result<u32, String> {
        let pubkey = pubkey_hex
            .parse::<bitcoin::secp256k1::PublicKey>()
            .map_err(|_| "invalid peer public key".to_string())?;
        let conn_id = self.next_conn.fetch_add(1, Ordering::Relaxed);
        let outbound = Arc::new(Mutex::new(Vec::new()));
        let descriptor = ConnDesc { id: conn_id, host: self.host.clone(), outbound: outbound.clone() };
        self.conns.lock().unwrap().insert(conn_id, outbound);
        self.host.ws_open(conn_id, host, port);
        let initial = self
            .peer_manager
            .new_outbound_connection(pubkey, descriptor, None)
            .map_err(|_| "peer manager refused the connection".to_string())?;
        self.conns.lock().unwrap().get(&conn_id).unwrap().lock().unwrap().extend_from_slice(&initial);
        self.host.ws_notify(conn_id);
        Ok(conn_id)
    }

    /// Register an inbound connection (the host accepted a socket).
    /// Returns the connection id the host should use for it.
    pub fn accept_peer(self: &Arc<Self>) -> Result<u32, String> {
        let conn_id = self.next_conn.fetch_add(1, Ordering::Relaxed);
        let outbound = Arc::new(Mutex::new(Vec::new()));
        let descriptor = ConnDesc { id: conn_id, host: self.host.clone(), outbound: outbound.clone() };
        self.conns.lock().unwrap().insert(conn_id, outbound);
        self.peer_manager
            .new_inbound_connection(descriptor, None)
            .map_err(|_| "peer manager refused the inbound connection".to_string())?;
        Ok(conn_id)
    }

    pub fn take_outbound(&self, conn_id: u32) -> Vec<u8> {
        match self.conns.lock().unwrap().get(&conn_id) {
            Some(buf) => std::mem::take(&mut *buf.lock().unwrap()),
            None => Vec::new(),
        }
    }

    pub fn socket_data(self: &Arc<Self>, conn_id: u32, data: &[u8]) -> Result<(), String> {
        let outbound = self
            .conns
            .lock()
            .unwrap()
            .get(&conn_id)
            .cloned()
            .ok_or_else(|| "unknown connection".to_string())?;
        let mut descriptor = ConnDesc { id: conn_id, host: self.host.clone(), outbound };
        // read_event consumes the bytes and queues any response through
        // the descriptor's send_data (which notifies the host to drain).
        self.peer_manager
            .read_event(&mut descriptor, data)
            .map_err(|e| format!("peer read failed: {e:?}"))?;
        self.process_events();
        Ok(())
    }

    pub fn socket_closed(&self, conn_id: u32) {
        if let Some(outbound) = self.conns.lock().unwrap().remove(&conn_id) {
            let descriptor = ConnDesc { id: conn_id, host: self.host.clone(), outbound };
            self.peer_manager.socket_disconnected(&descriptor);
        }
        self.process_events();
    }

    pub fn process_events(&self) {
        let handler = self.handler();
        // Received HTLCs sit in a pending queue until this runs: it is
        // what peels onions, forwards payments, and generates
        // PaymentClaimable for payments addressed to us.
        self.channel_manager.process_pending_htlc_forwards();
        self.channel_manager.process_pending_events(&handler);
        self.chain_monitor.process_pending_events(&handler);
        self.peer_manager.process_events();
        self.channel_manager.process_pending_events(&handler);
        if self.dirty.swap(false, Ordering::Relaxed) {
            self.persist_manager();
        }
    }

    pub fn timer_tick(&self) {
        self.peer_manager.timer_tick_occurred();
        // The channel manager's own tick drives BOLT 12 offers-flow
        // retries and the async-payments static-invoice request cycle;
        // without it an async-receive offer never becomes ready.
        self.channel_manager.timer_tick_occurred();
        self.process_events();
    }

    /// Chain sync entry point used by the host's Esplora driver:
    /// confirm a batch of transactions (grouped per block by the host),
    /// unconfirm dropped ones, then move the best block.
    pub fn confirm_transactions(
        self: &Arc<Self>, header_hex: &str, height: u32, txs: &[(u32, Vec<u8>)],
    ) -> Result<(), String> {
        let header_bytes = unhex(header_hex)?;
        let header: bitcoin::block::Header = bitcoin::consensus::deserialize(&header_bytes)
            .map_err(|e| format!("bad block header: {e}"))?;
        let mut parsed: Vec<(usize, Transaction)> = Vec::new();
        for (idx, raw) in txs {
            let tx: Transaction = bitcoin::consensus::deserialize(raw)
                .map_err(|e| format!("bad transaction bytes: {e}"))?;
            parsed.push((*idx as usize, tx));
        }
        let refs: Vec<(usize, &Transaction)> = parsed.iter().map(|(i, t)| (*i, t)).collect();
        self.channel_manager.transactions_confirmed(&header, &refs, height);
        self.chain_monitor.transactions_confirmed(&header, &refs, height);
        Ok(())
    }

    pub fn unconfirm_transaction(&self, txid_hex: &str) -> Result<(), String> {
        let txid = txid_hex.parse::<Txid>().map_err(|_| "bad txid".to_string())?;
        self.channel_manager.transaction_unconfirmed(&txid);
        self.chain_monitor.transaction_unconfirmed(&txid);
        Ok(())
    }

    pub fn best_block_updated(&self, height: u32, hash_hex: &str, header_hex: &str) -> Result<(), String> {
        let header_bytes = unhex(header_hex)?;
        let header: bitcoin::block::Header = bitcoin::consensus::deserialize(&header_bytes)
            .map_err(|e| format!("bad block header: {e}"))?;
        let _ = hash_hex;
        self.tip_time.fetch_max(header.time as u64, Ordering::Relaxed);
        self.channel_manager.best_block_updated(&header, height);
        self.chain_monitor.best_block_updated(&header, height);
        self.dirty.store(true, Ordering::Relaxed);
        Ok(())
    }

    /// Everything the host's chain driver should watch: LDK-registered
    /// filter entries plus the managers' own relevant txids.
    pub fn relevant_txids(&self) -> Vec<String> {
        use lightning::chain::Confirm;
        let mut out: Vec<String> = Vec::new();
        for (txid, _, _) in self.channel_manager.get_relevant_txids() {
            out.push(txid.to_string());
        }
        for (txid, _, _) in self.chain_monitor.get_relevant_txids() {
            let s = txid.to_string();
            if !out.contains(&s) {
                out.push(s);
            }
        }
        let regs = self.filter.regs.lock().unwrap();
        for (txid, _) in &regs.txids {
            let s = txid.to_string();
            if !out.contains(&s) {
                out.push(s);
            }
        }
        for o in &regs.outputs {
            let s = o.outpoint.txid.to_string();
            if !out.contains(&s) {
                out.push(s);
            }
        }
        out
    }
}

// ---------------------------------------------------------------------------
// Operations: channels, invoices, payments, offers, async receive
// ---------------------------------------------------------------------------

impl NodeInner {
    pub fn open_channel(
        &self, pubkey_hex: &str, amount_sat: u64, push_msat: u64,
    ) -> Result<String, String> {
        let pubkey = pubkey_hex
            .parse::<bitcoin::secp256k1::PublicKey>()
            .map_err(|_| "invalid peer public key".to_string())?;
        let user_channel_id: u128 = {
            let b = self.keys_manager.get_secure_random_bytes();
            let mut v = [0u8; 16];
            v.copy_from_slice(&b[..16]);
            u128::from_be_bytes(v)
        };
        self.channel_manager
            .create_channel(pubkey, amount_sat, push_msat, user_channel_id, None, None)
            .map_err(|e| format!("create_channel failed: {e:?}"))?;
        self.dirty.store(true, Ordering::Relaxed);
        Ok(format!("{user_channel_id:032x}"))
    }

    pub fn funding_tx_ready(
        self: &Arc<Self>, user_channel_id_hex: &str, raw_tx_hex: &str,
    ) -> Result<(), String> {
        let uid = u128::from_str_radix(user_channel_id_hex.trim_start_matches("0x"), 16)
            .map_err(|_| "bad user channel id".to_string())?;
        let req = {
            let mut pending = self.sinks.pending_funding.lock().unwrap();
            let pos = pending
                .iter()
                .position(|r| r.user_channel_id == uid)
                .ok_or_else(|| "no pending funding request for that channel".to_string())?;
            pending.remove(pos)
        };
        let raw = unhex(raw_tx_hex)?;
        let tx: Transaction = bitcoin::consensus::deserialize(&raw)
            .map_err(|e| format!("bad funding transaction: {e}"))?;
        // Sanity: the tx must actually contain the agreed funding output
        // (script + value) before we hand it to the channel manager.
        let want_script = bitcoin::ScriptBuf::from_bytes(unhex(&req.script_pubkey_hex)?);
        if !tx.output.iter().any(|o| o.script_pubkey == want_script && o.value.to_sat() == req.value_sat) {
            return Err("funding transaction has no output matching the channel's funding script and value".into());
        }
        let counterparty = req
            .counterparty
            .parse::<bitcoin::secp256k1::PublicKey>()
            .map_err(|_| "bad counterparty".to_string())?;
        let temp_bytes = unhex(&req.temporary_channel_id_hex)?;
        if temp_bytes.len() != 32 {
            return Err("bad temporary channel id".into());
        }
        let mut temp_id = [0u8; 32];
        temp_id.copy_from_slice(&temp_bytes);
        self.channel_manager
            .funding_transaction_generated(lightning::ln::types::ChannelId(temp_id), counterparty, tx)
            .map_err(|e| format!("funding_transaction_generated failed: {e:?}"))?;
        self.process_events();
        Ok(())
    }

    pub fn close_channel(&self, channel_id_hex: &str, force: bool) -> Result<(), String> {
        let bytes = unhex(channel_id_hex)?;
        if bytes.len() != 32 {
            return Err("channel id must be 32 bytes".into());
        }
        let mut id = [0u8; 32];
        id.copy_from_slice(&bytes);
        let cid = lightning::ln::types::ChannelId(id);
        let chan = self
            .channel_manager
            .list_channels()
            .into_iter()
            .find(|c| c.channel_id == cid)
            .ok_or_else(|| "unknown channel".to_string())?;
        if force {
            self.channel_manager
                .force_close_broadcasting_latest_txn(&cid, &chan.counterparty.node_id, "Closed by the wallet owner".to_string())
                .map_err(|e| format!("force close failed: {e:?}"))?;
        } else {
            self.channel_manager
                .close_channel(&cid, &chan.counterparty.node_id)
                .map_err(|e| format!("close failed: {e:?}"))?;
        }
        Ok(())
    }

    pub fn create_invoice(
        &self, amount_msat: Option<u64>, description: &str, expiry_secs: u32,
    ) -> Result<String, String> {
        use lightning_invoice::{Currency, InvoiceBuilder, RouteHint, RouteHintHop, RoutingFees};
        let (payment_hash, payment_secret) = self
            .channel_manager
            .create_inbound_payment(amount_msat, expiry_secs, None)
            .map_err(|_| "inbound payment creation failed".to_string())?;
        let currency = match self.network {
            Network::Bitcoin => Currency::Bitcoin,
            Network::Testnet => Currency::BitcoinTestnet,
            Network::Signet => Currency::Signet,
            Network::Regtest => Currency::Regtest,
            _ => Currency::Bitcoin,
        };
        let node_pubkey = self
            .keys_manager
            .get_node_id(Recipient::Node)
            .map_err(|_| "node id unavailable".to_string())?;
        let mut builder = InvoiceBuilder::new(currency)
            .payee_pub_key(node_pubkey)
            .description(description.to_string())
            .payment_hash(bitcoin::hashes::sha256::Hash::from_byte_array(payment_hash.0))
            .payment_secret(payment_secret)
            .duration_since_epoch(std::time::Duration::from_secs(self.now_secs()))
            .expiry_time(std::time::Duration::from_secs(expiry_secs as u64))
            .min_final_cltv_expiry_delta(18);
        if let Some(a) = amount_msat {
            builder = builder.amount_milli_satoshis(a);
        }
        // Route hints over our usable private channels: the final hop
        // runs from our peer to us. Fees come from the peer's announced
        // forwarding info when we have it, else zero (our peer chooses
        // what it actually charges; payers treat hints as advisory).
        for chan in self.channel_manager.list_channels() {
            if !chan.is_usable {
                continue;
            }
            let scid = match chan.inbound_scid_alias.or(chan.short_channel_id) {
                Some(s) => s,
                None => continue,
            };
            let fees = chan
                .counterparty
                .forwarding_info
                .as_ref()
                .map(|f| RoutingFees {
                    base_msat: f.fee_base_msat,
                    proportional_millionths: f.fee_proportional_millionths,
                })
                .unwrap_or(RoutingFees { base_msat: 0, proportional_millionths: 0 });
            let cltv = chan
                .counterparty
                .forwarding_info
                .as_ref()
                .map(|f| f.cltv_expiry_delta)
                .unwrap_or(40);
            builder = builder.private_route(RouteHint(vec![RouteHintHop {
                src_node_id: chan.counterparty.node_id,
                short_channel_id: scid,
                fees,
                cltv_expiry_delta: cltv,
                htlc_minimum_msat: None,
                htlc_maximum_msat: None,
            }]));
        }
        let node_secret = self.keys_manager.get_node_secret_key();
        let secp = bitcoin::secp256k1::Secp256k1::signing_only();
        let invoice = builder
            .build_signed(|msg| secp.sign_ecdsa_recoverable(msg, &node_secret))
            .map_err(|e| format!("invoice signing failed: {e:?}"))?;
        Ok(invoice.to_string())
    }

    pub fn pay_invoice(
        self: &Arc<Self>, invoice_str: &str, amount_msat: Option<u64>,
    ) -> Result<String, String> {
        let invoice = invoice_str
            .parse::<lightning_invoice::Bolt11Invoice>()
            .map_err(|e| format!("invalid BOLT 11 invoice: {e:?}"))?;
        let amount = invoice
            .amount_milli_satoshis()
            .or(amount_msat)
            .ok_or_else(|| "invoice has no amount — specify one".to_string())?;
        let payment_id = PaymentId(self.keys_manager.get_secure_random_bytes());
        let payee = invoice
            .payee_pub_key()
            .copied()
            .ok_or_else(|| "invoice has no payee public key".to_string())?;
        let params = PaymentParameters::from_node_id(
            payee,
            invoice.min_final_cltv_expiry_delta() as u32,
        );
        let route_params = RouteParameters::from_payment_params_and_value(params, amount);
        match self.channel_manager.send_payment(
            PaymentHash(invoice.payment_hash().to_byte_array()),
            lightning::ln::channelmanager::RecipientOnionFields::secret_only(
                *invoice.payment_secret(),
            ),
            payment_id,
            route_params,
            lightning::ln::channelmanager::Retry::Attempts(3),
        ) {
            Ok(()) => Ok(hex(&payment_id.0)),
            Err(e) => Err(format!("payment failed to start: {e:?}")),
        }
    }

    pub fn pay_offer(self: &Arc<Self>, offer_str: &str, amount_msat: Option<u64>) -> Result<String, String> {
        let offer = offer_str
            .parse::<lightning::offers::offer::Offer>()
            .map_err(|e| format!("invalid BOLT 12 offer: {e:?}"))?;
        let amount = offer.amount().and_then(|a| match a {
            lightning::offers::offer::Amount::Bitcoin { amount_msats } => Some(amount_msats),
            _ => None,
        }).or(amount_msat);
        let payment_id = PaymentId(self.keys_manager.get_secure_random_bytes());
        self.channel_manager
            .pay_for_offer(&offer, amount, payment_id, Default::default())
            .map_err(|e| format!("offer payment failed to start: {e:?}"))?;
        Ok(hex(&payment_id.0))
    }

    pub fn create_offer(&self, amount_msat: Option<u64>, description: &str) -> Result<String, String> {
        let mut builder = self
            .channel_manager
            .create_offer_builder()
            .map_err(|e| {
                if format!("{e:?}").contains("MissingPaths") {
                    "an offer needs blinded paths through a connected channel peer — connect to your peer/LSP first".to_string()
                } else {
                    format!("offer builder failed: {e:?}")
                }
            })?;
        builder = builder.description(description.to_string());
        if let Some(a) = amount_msat {
            builder = builder.amount_msats(a);
        }
        let offer = builder.build().map_err(|e| format!("offer build failed: {e:?}"))?;
        Ok(offer.to_string())
    }

    /// SIS side: produce blinded paths a recipient uses to configure
    /// itself with us as its static invoice server.
    pub fn sis_paths_for_recipient(&self, recipient_id: &str) -> Result<String, String> {
        let paths = self
            .channel_manager
            .blinded_paths_for_async_recipient(recipient_id.as_bytes().to_vec(), None)
            .map_err(|_| "could not build paths to this node (are we connected to onion-message-capable peers?)".to_string())?;
        let mut out = String::from("[");
        for (i, p) in paths.iter().enumerate() {
            let mut bytes = Vec::new();
            p.write(&mut bytes).map_err(|e| e.to_string())?;
            if i > 0 {
                out.push(',');
            }
            out.push_str(&jstr(&hex(&bytes)));
        }
        out.push(']');
        Ok(out)
    }

    /// Recipient side: configure this node to build its async-receive
    /// offer with the given static invoice server paths.
    pub fn set_sis_paths(&self, paths_json_hexes: &[String]) -> Result<(), String> {
        use lightning::util::ser::Readable;
        let mut paths = Vec::new();
        for h in paths_json_hexes {
            let bytes = unhex(h)?;
            let mut r = &bytes[..];
            let p = lightning::blinded_path::message::BlindedMessagePath::read(&mut r)
                .map_err(|e| format!("bad blinded path: {e:?}"))?;
            paths.push(p);
        }
        self.channel_manager
            .set_paths_to_static_invoice_server(paths)
            .map_err(|_| "setting static-invoice-server paths failed".to_string())?;
        self.dirty.store(true, Ordering::Relaxed);
        Ok(())
    }

    pub fn async_receive_offer(&self) -> Result<String, String> {
        match self.channel_manager.get_async_receive_offer() {
            Ok(offer) => Ok(offer.to_string()),
            Err(()) => Err("async receive offer is not ready yet — the static invoice is still being built with your server peer; stay online a little longer".into()),
        }
    }

    pub fn list_channels_json(&self) -> String {
        let mut parts = Vec::new();
        for c in self.channel_manager.list_channels() {
            parts.push(format!(
                "{{\"channelId\":{},\"counterparty\":{},\"valueSat\":{},\"outboundMsat\":{},\"inboundMsat\":{},\"isUsable\":{},\"isPublic\":{},\"fundingTxo\":{}}}",
                jstr(&hex(&c.channel_id.0)),
                jstr(&c.counterparty.node_id.to_string()),
                c.channel_value_satoshis,
                c.outbound_capacity_msat,
                c.inbound_capacity_msat,
                c.is_usable,
                c.is_announced,
                jstr(&format!("{}:{}", c.funding_txo.map(|f| f.txid.to_string()).unwrap_or_default(), c.funding_txo.map(|f| f.index).unwrap_or(0))),
            ));
        }
        format!("[{}]", parts.join(","))
    }

    pub fn balance_json(&self) -> String {
        let chans = self.channel_manager.list_channels();
        let outbound: u64 = chans.iter().map(|c| c.outbound_capacity_msat).sum();
        let inbound: u64 = chans.iter().map(|c| c.inbound_capacity_msat).sum();
        let claimable: u64 = self
            .chain_monitor
            .get_claimable_balances(&[])
            .iter()
            .map(|b| b.claimable_amount_satoshis())
            .sum();
        format!(
            "{{\"nodeId\":{},\"channels\":{},\"spendableMsat\":{outbound},\"receivableMsat\":{inbound},\"claimableOnchainSat\":{claimable}}}",
            jstr(&self.node_id()),
            chans.len(),
        )
    }

    pub fn drain_events(&self) -> String {
        let evs = std::mem::take(&mut *self.sinks.events.lock().unwrap());
        format!("[{}]", evs.join(","))
    }
    pub fn history_json(&self) -> String {
        format!("[{}]", self.sinks.history.lock().unwrap().join(","))
    }
    pub fn pending_funding_json(&self) -> String {
        let p = self.sinks.pending_funding.lock().unwrap();
        let parts: Vec<String> = p
            .iter()
            .map(|r| {
                format!(
                    "{{\"userChannelId\":\"{:032x}\",\"temporaryChannelId\":{},\"counterparty\":{},\"valueSat\":{},\"scriptPubkey\":{}}}",
                    r.user_channel_id,
                    jstr(&r.temporary_channel_id_hex),
                    jstr(&r.counterparty),
                    r.value_sat,
                    jstr(&r.script_pubkey_hex),
                )
            })
            .collect();
        format!("[{}]", parts.join(","))
    }
}

// ---------------------------------------------------------------------------
// WASM host bindings (browser + Node keeper share this exact build)
// ---------------------------------------------------------------------------

#[cfg(target_arch = "wasm32")]
mod wasm_host {
    use super::*;
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = kvHas)]
        fn kv_has(key: &str) -> bool;
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = kvGet)]
        fn kv_get(key: &str) -> Vec<u8>;
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = kvSet)]
        fn kv_set(key: &str, value: &[u8]);
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = kvDel)]
        fn kv_del(key: &str);
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = kvKeys)]
        fn kv_keys(prefix: &str) -> Vec<String>;
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = broadcast)]
        fn broadcast(tx: &[u8]);
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = wsOpen)]
        fn ws_open(conn_id: u32, host: &str, port: u16);
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = wsNotify)]
        fn ws_notify(conn_id: u32);
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = wsClose)]
        fn ws_close(conn_id: u32);
        #[wasm_bindgen(js_namespace = FluidLnHost, js_name = logMsg)]
        fn log_msg(msg: &str);
    }

    pub struct WasmHost;
    impl HostBridge for WasmHost {
        fn kv_read(&self, key: &str) -> Option<Vec<u8>> {
            if kv_has(key) {
                Some(kv_get(key))
            } else {
                None
            }
        }
        fn kv_write(&self, key: &str, value: &[u8]) {
            kv_set(key, value);
        }
        fn kv_remove(&self, key: &str) {
            kv_del(key);
        }
        fn kv_list(&self, prefix: &str) -> Vec<String> {
            kv_keys(prefix)
        }
        fn broadcast_tx(&self, tx_bytes: &[u8]) {
            broadcast(tx_bytes);
        }
        fn ws_open(&self, conn_id: u32, host: &str, port: u16) {
            ws_open(conn_id, host, port);
        }
        fn ws_notify(&self, conn_id: u32) {
            ws_notify(conn_id);
        }
        fn ws_close(&self, conn_id: u32) {
            ws_close(conn_id);
        }
        fn log(&self, msg: &str) {
            log_msg(msg);
        }
    }

    fn parse_network(s: &str) -> Result<Network, JsValue> {
        match s {
            "bitcoin" | "mainnet" => Ok(Network::Bitcoin),
            "testnet" => Ok(Network::Testnet),
            "signet" => Ok(Network::Signet),
            "regtest" => Ok(Network::Regtest),
            _ => Err(JsValue::from_str("unknown network")),
        }
    }

    #[wasm_bindgen]
    pub struct FluidNode {
        inner: Arc<NodeInner>,
    }

    #[wasm_bindgen]
    impl FluidNode {
        #[wasm_bindgen(constructor)]
        pub fn new(
            seed: &[u8], network: &str, tip_height: u32, tip_hash: &str, now_secs: f64,
        ) -> Result<FluidNode, JsValue> {
            if seed.len() != 32 {
                return Err(JsValue::from_str("seed must be 32 bytes"));
            }
            let mut s = [0u8; 32];
            s.copy_from_slice(seed);
            let net = parse_network(network)?;
            let hash = tip_hash
                .parse::<BlockHash>()
                .map_err(|_| JsValue::from_str("bad tip hash"))?;
            let inner = NodeInner::new(
                Arc::new(WasmHost),
                &s,
                net,
                tip_height,
                hash,
                now_secs as u64,
            )
            .map_err(|e| JsValue::from_str(&e))?;
            Ok(FluidNode { inner })
        }

        pub fn node_id(&self) -> String {
            self.inner.node_id()
        }
        pub fn set_fee_estimates(&self, background: u32, normal: u32, high: u32) {
            self.inner.fee_est.set(background, normal, high);
        }
        pub fn connect_peer(&self, pubkey: &str, host: &str, port: u16) -> Result<u32, JsValue> {
            self.inner.connect_peer(pubkey, host, port).map_err(|e| JsValue::from_str(&e))
        }
        pub fn accept_peer(&self) -> Result<u32, JsValue> {
            self.inner.accept_peer().map_err(|e| JsValue::from_str(&e))
        }
        pub fn take_outbound(&self, conn_id: u32) -> Vec<u8> {
            self.inner.take_outbound(conn_id)
        }
        pub fn socket_data(&self, conn_id: u32, data: &[u8]) -> Result<(), JsValue> {
            self.inner.socket_data(conn_id, data).map_err(|e| JsValue::from_str(&e))
        }
        pub fn socket_closed(&self, conn_id: u32) {
            self.inner.socket_closed(conn_id);
        }
        pub fn tick(&self) {
            self.inner.process_events();
        }
        pub fn timer_tick(&self) {
            self.inner.timer_tick();
        }
        pub fn confirm_transactions(
            &self, header_hex: &str, height: u32, indexes: Vec<u32>, tx_hexes: Vec<String>,
        ) -> Result<(), JsValue> {
            let mut txs = Vec::new();
            for (i, h) in indexes.iter().zip(tx_hexes.iter()) {
                txs.push((*i, unhex(h).map_err(|e| JsValue::from_str(&e))?));
            }
            self.inner
                .confirm_transactions(header_hex, height, &txs)
                .map_err(|e| JsValue::from_str(&e))
        }
        pub fn unconfirm_transaction(&self, txid: &str) -> Result<(), JsValue> {
            self.inner.unconfirm_transaction(txid).map_err(|e| JsValue::from_str(&e))
        }
        pub fn best_block_updated(
            &self, height: u32, hash_hex: &str, header_hex: &str,
        ) -> Result<(), JsValue> {
            self.inner
                .best_block_updated(height, hash_hex, header_hex)
                .map_err(|e| JsValue::from_str(&e))
        }
        pub fn relevant_txids(&self) -> Vec<String> {
            self.inner.relevant_txids()
        }
        pub fn open_channel(&self, pubkey: &str, amount_sat: u64, push_msat: u64) -> Result<String, JsValue> {
            self.inner.open_channel(pubkey, amount_sat, push_msat).map_err(|e| JsValue::from_str(&e))
        }
        pub fn funding_tx_ready(&self, user_channel_id: &str, raw_tx_hex: &str) -> Result<(), JsValue> {
            self.inner.funding_tx_ready(user_channel_id, raw_tx_hex).map_err(|e| JsValue::from_str(&e))
        }
        pub fn close_channel(&self, channel_id: &str, force: bool) -> Result<(), JsValue> {
            self.inner.close_channel(channel_id, force).map_err(|e| JsValue::from_str(&e))
        }
        pub fn create_invoice(
            &self, amount_msat: Option<u64>, description: &str, expiry_secs: u32,
        ) -> Result<String, JsValue> {
            self.inner.create_invoice(amount_msat, description, expiry_secs).map_err(|e| JsValue::from_str(&e))
        }
        pub fn pay_invoice(&self, invoice: &str, amount_msat: Option<u64>) -> Result<String, JsValue> {
            self.inner.pay_invoice(invoice, amount_msat).map_err(|e| JsValue::from_str(&e))
        }
        pub fn pay_offer(&self, offer: &str, amount_msat: Option<u64>) -> Result<String, JsValue> {
            self.inner.pay_offer(offer, amount_msat).map_err(|e| JsValue::from_str(&e))
        }
        pub fn create_offer(&self, amount_msat: Option<u64>, description: &str) -> Result<String, JsValue> {
            self.inner.create_offer(amount_msat, description).map_err(|e| JsValue::from_str(&e))
        }
        pub fn sis_paths_for_recipient(&self, recipient_id: &str) -> Result<String, JsValue> {
            self.inner.sis_paths_for_recipient(recipient_id).map_err(|e| JsValue::from_str(&e))
        }
        pub fn set_sis_paths(&self, paths: Vec<String>) -> Result<(), JsValue> {
            self.inner.set_sis_paths(&paths).map_err(|e| JsValue::from_str(&e))
        }
        pub fn async_receive_offer(&self) -> Result<String, JsValue> {
            self.inner.async_receive_offer().map_err(|e| JsValue::from_str(&e))
        }
        pub fn balance(&self) -> String {
            self.inner.balance_json()
        }
        pub fn channels(&self) -> String {
            self.inner.list_channels_json()
        }
        pub fn history(&self) -> String {
            self.inner.history_json()
        }
        pub fn drain_events(&self) -> String {
            self.inner.drain_events()
        }
        pub fn pending_funding(&self) -> String {
            self.inner.pending_funding_json()
        }
        pub fn persist(&self) {
            self.inner.persist_manager();
        }
    }
}
#[cfg(target_arch = "wasm32")]
pub use wasm_host::FluidNode;
