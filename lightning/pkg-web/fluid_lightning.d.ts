/* tslint:disable */
/* eslint-disable */

export class FluidNode {
    free(): void;
    [Symbol.dispose](): void;
    accept_peer(): number;
    async_receive_offer(): string;
    balance(): string;
    best_block_updated(height: number, hash_hex: string, header_hex: string): void;
    channels(): string;
    close_channel(channel_id: string, force: boolean): void;
    confirm_transactions(header_hex: string, height: number, indexes: Uint32Array | number[], tx_hexes: string[]): void;
    connect_peer(pubkey: string, host: string, port: number): number;
    create_invoice(amount_msat: bigint | null | undefined, description: string, expiry_secs: number): string;
    create_invoice_desc_hash(amount_msat: bigint | null | undefined, description_hash_hex: string, expiry_secs: number): string;
    create_invoice_jit(amount_msat: bigint, description: string, expiry_secs: number, lsp_pubkey: string, intercept_scid: string, cltv_expiry_delta: number): string;
    create_invoice_jit_desc_hash(amount_msat: bigint, description_hash_hex: string, expiry_secs: number, lsp_pubkey: string, intercept_scid: string, cltv_expiry_delta: number): string;
    create_offer(amount_msat: bigint | null | undefined, description: string): string;
    drain_events(): string;
    funding_tx_ready(user_channel_id: string, raw_tx_hex: string): void;
    history(): string;
    lsps1_check_order(lsp_pubkey: string, order_id: string): string;
    lsps1_create_order(lsp_pubkey: string, lsp_balance_sat: bigint): string;
    lsps1_request_options(lsp_pubkey: string): string;
    lsps2_request_params(lsp_pubkey: string, token: string): string;
    lsps2_select_params(request_id: string, menu_index: number, payment_size_msat?: bigint | null): string;
    constructor(seed: Uint8Array | number[], network: string, tip_height: number, tip_hash: string, now_secs: number, role: string);
    node_id(): string;
    open_channel(pubkey: string, amount_sat: bigint, push_msat: bigint): string;
    pay_invoice(invoice: string, amount_msat?: bigint | null): string;
    pay_offer(offer: string, amount_msat?: bigint | null): string;
    pending_funding(): string;
    persist(): void;
    relevant_txids(): string[];
    set_fee_estimates(background: number, normal: number, high: number): void;
    set_sis_paths(paths: string[]): void;
    sis_paths_for_recipient(recipient_id: string): string;
    socket_closed(conn_id: number): void;
    socket_data(conn_id: number, data: Uint8Array | number[]): void;
    take_outbound(conn_id: number): Uint8Array;
    tick(): void;
    timer_tick(): void;
    unconfirm_transaction(txid: string): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_fluidnode_free: (a: number, b: number) => void;
    readonly fluidnode_accept_peer: (a: number, b: number) => void;
    readonly fluidnode_async_receive_offer: (a: number, b: number) => void;
    readonly fluidnode_balance: (a: number, b: number) => void;
    readonly fluidnode_best_block_updated: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly fluidnode_channels: (a: number, b: number) => void;
    readonly fluidnode_close_channel: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly fluidnode_confirm_transactions: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly fluidnode_connect_peer: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly fluidnode_create_invoice: (a: number, b: number, c: number, d: bigint, e: number, f: number, g: number) => void;
    readonly fluidnode_create_invoice_desc_hash: (a: number, b: number, c: number, d: bigint, e: number, f: number, g: number) => void;
    readonly fluidnode_create_invoice_jit: (a: number, b: number, c: bigint, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly fluidnode_create_invoice_jit_desc_hash: (a: number, b: number, c: bigint, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly fluidnode_create_offer: (a: number, b: number, c: number, d: bigint, e: number, f: number) => void;
    readonly fluidnode_drain_events: (a: number, b: number) => void;
    readonly fluidnode_funding_tx_ready: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly fluidnode_history: (a: number, b: number) => void;
    readonly fluidnode_lsps1_check_order: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly fluidnode_lsps1_create_order: (a: number, b: number, c: number, d: number, e: bigint) => void;
    readonly fluidnode_lsps1_request_options: (a: number, b: number, c: number, d: number) => void;
    readonly fluidnode_lsps2_request_params: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly fluidnode_lsps2_select_params: (a: number, b: number, c: number, d: number, e: number, f: number, g: bigint) => void;
    readonly fluidnode_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly fluidnode_node_id: (a: number, b: number) => void;
    readonly fluidnode_open_channel: (a: number, b: number, c: number, d: number, e: bigint, f: bigint) => void;
    readonly fluidnode_pay_invoice: (a: number, b: number, c: number, d: number, e: number, f: bigint) => void;
    readonly fluidnode_pay_offer: (a: number, b: number, c: number, d: number, e: number, f: bigint) => void;
    readonly fluidnode_pending_funding: (a: number, b: number) => void;
    readonly fluidnode_persist: (a: number) => void;
    readonly fluidnode_relevant_txids: (a: number, b: number) => void;
    readonly fluidnode_set_fee_estimates: (a: number, b: number, c: number, d: number) => void;
    readonly fluidnode_set_sis_paths: (a: number, b: number, c: number, d: number) => void;
    readonly fluidnode_sis_paths_for_recipient: (a: number, b: number, c: number, d: number) => void;
    readonly fluidnode_socket_closed: (a: number, b: number) => void;
    readonly fluidnode_socket_data: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly fluidnode_take_outbound: (a: number, b: number, c: number) => void;
    readonly fluidnode_tick: (a: number) => void;
    readonly fluidnode_timer_tick: (a: number) => void;
    readonly fluidnode_unconfirm_transaction: (a: number, b: number, c: number, d: number) => void;
    readonly rustsecp256k1_v0_10_0_context_create: (a: number) => number;
    readonly rustsecp256k1_v0_10_0_context_destroy: (a: number) => void;
    readonly rustsecp256k1_v0_10_0_default_error_callback_fn: (a: number, b: number) => void;
    readonly rustsecp256k1_v0_10_0_default_illegal_callback_fn: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export4: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_export5: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export6: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
