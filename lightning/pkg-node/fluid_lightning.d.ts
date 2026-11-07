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
    create_offer(amount_msat: bigint | null | undefined, description: string): string;
    drain_events(): string;
    funding_tx_ready(user_channel_id: string, raw_tx_hex: string): void;
    history(): string;
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
