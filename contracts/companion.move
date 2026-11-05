// Fluid Companion — Sui Move module (Phase 2 starter, for Sui TESTNET only)
// Corrections vs the original spec draft:
//  1. Modern Sui Move (2024 edition): `public struct`, explicit imports.
//  2. TRUE soulbound: Companion has `key` ONLY — no `store`. Without `store`
//     it cannot be moved with public_transfer, wrapped, or sold. The spec's
//     draft relied on convention; this enforces it in the type system.
//  3. add_stat now checks ownership AND updates an existing stat instead of
//     aborting (dynamic_field::add aborts if the key already exists — the
//     draft would have failed on the second game played).
//  4. level_up can only move forward by exactly 1, and only the owner.
//  5. personality_seed comes from the on-chain Clock (weak randomness — fine
//     for a personality seed, NEVER use this pattern for anything valuable).
//  6. Events emitted for mint / level_up / stat so OGO ERA can index them.
// Private AI memory is NEVER stored here — only public game stats, per spec.

module fluid::companion;

use sui::clock::Clock;
use sui::dynamic_field as df;
use sui::event;

public struct Companion has key {
    id: UID,
    owner: address,
    name: vector<u8>,
    personality_seed: u64,
    level: u64,
    model_hash: vector<u8>, // hash of the open-source base model, e.g. b"ipfs://base_model_v1"
    wallet_addr: address,
}

public struct CompanionMinted has copy, drop {
    companion_id: ID,
    owner: address,
}

public struct LevelledUp has copy, drop {
    companion_id: ID,
    new_level: u64,
}

public struct StatSet has copy, drop {
    companion_id: ID,
    key: vector<u8>,
}

/// One companion per wallet: mint is free, but a second mint for the same
/// sender is prevented by the game/app layer checking ownership first
/// (on-chain global uniqueness needs a registry object — Phase 2b).
public fun mint(name: vector<u8>, model_hash: vector<u8>, clock: &Clock, ctx: &mut TxContext) {
    let sender = ctx.sender();
    let companion = Companion {
        id: object::new(ctx),
        owner: sender,
        name,
        personality_seed: clock.timestamp_ms(), // see note 5 above
        level: 1,
        model_hash,
        wallet_addr: sender,
    };
    event::emit(CompanionMinted { companion_id: object::id(&companion), owner: sender });
    // transfer (not public_transfer) — the only move this object ever makes.
    transfer::transfer(companion, sender);
}

/// Only the owner, only +1 at a time. Called after a signed (biometric)
/// claim / game milestone in the Fluid app.
public fun level_up(companion: &mut Companion, ctx: &TxContext) {
    assert!(companion.owner == ctx.sender(), 0); // ENotOwner
    companion.level = companion.level + 1;
    event::emit(LevelledUp { companion_id: object::id(companion), new_level: companion.level });
}

/// Set or update a public stat: b"games_played", b"rains_claimed",
/// b"saves_coached", b"finance_score". Only the owner.
public fun add_stat(companion: &mut Companion, key: vector<u8>, value: u64, ctx: &TxContext) {
    assert!(companion.owner == ctx.sender(), 0); // ENotOwner
    if (df::exists_(&companion.id, key)) {
        let current: &mut u64 = df::borrow_mut(&mut companion.id, key);
        *current = value;
    } else {
        df::add(&mut companion.id, key, value);
    };
    event::emit(StatSet { companion_id: object::id(companion), key });
}

public fun get_stat(companion: &Companion, key: vector<u8>): u64 {
    if (df::exists_(&companion.id, key)) *df::borrow(&companion.id, key) else 0
}

public fun level(companion: &Companion): u64 { companion.level }
public fun owner(companion: &Companion): address { companion.owner }
