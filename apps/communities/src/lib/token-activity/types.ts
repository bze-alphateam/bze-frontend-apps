// The BZE Scan `/api/v1` answers Token Activity reads, as sent (snake_case). Amounts are base
// units in strings, times RFC 3339 in UTC and an absent value is `null`.

/** A labelled address (`{name, kind}`): kind `module`, `ibc_escrow`, `validator_owner` or `known`. */
export interface ScanLabel {
    name: string;
    kind: string;
}

/** A list answer: `next_cursor` goes back as `cursor` for the next page, null on the last one. */
export interface ScanPage<T> {
    items: T[];
    next_cursor: string | null;
}

/** A coin with what Scan knows of its denom (symbol and exponent null when unknown). */
export interface ScanBalance {
    denom: string;
    amount: string;
    symbol: string | null;
    exponent: number | null;
}

export interface ScanCoin {
    denom: string;
    amount: string;
}

/** A token event (`/token/events`, and the last 20 on `/token`). */
export interface ScanTokenEvent {
    height: number;
    tx_index: number;
    seq: number;
    /** Null for a block-level halt. */
    tx_hash: string | null;
    kind: string;
    actor: string | null;
    actor_label: ScanLabel | null;
    amount: string | null;
    details: Record<string, unknown> | null;
    time: string;
}

export interface ScanOriginChain {
    chain_id: string;
    name: string | null;
    logo_url: string | null;
    status: string | null;
}

/** `GET /token?denom=`: the denom's columns, its last events and its 24-hour transfers. */
export interface ScanToken {
    denom: string;
    symbol: string | null;
    name: string | null;
    kind: "native" | "factory" | "ibc" | "lp" | "unknown";
    exponent: number | null;
    supply: string | null;
    /** Owners of at least one display unit; null until the holders job ran. */
    holders_count: number | null;
    price_usd: string | null;
    halted: boolean;
    logo_url: string | null;
    origin_chain: ScanOriginChain | null;
    description: string | null;
    creator: string | null;
    creator_label: ScanLabel | null;
    /** Null once renounced. */
    admin: string | null;
    admin_label: ScanLabel | null;
    created_height: number | null;
    created_tx_hash: string | null;
    created_time: string | null;
    events: ScanTokenEvent[];
    events_next_cursor: string | null;
    transfers_24h: {count: number; amount: string};
}

/** A move of the token (`/token/transfers`), newest first. */
export interface ScanTransfer {
    height: number;
    tx_index: number;
    /** Null for the block's own rows (unlocks, burner and raffle burns, epoch payouts). */
    tx_hash: string | null;
    time: string;
    seq: number;
    /** Null for the fee and the block's own rows. */
    msg_index: number | null;
    /**
     * The type_url of the row's message; for an authz MsgExec the type its inner messages share,
     * MsgExec's own when they differ; null for the fee and the block's own rows.
     */
    msg_type: string | null;
    kind: "transfer" | "mint" | "burn";
    sender: string | null;
    sender_label: ScanLabel | null;
    recipient: string | null;
    recipient_label: ScanLabel | null;
    denom: string;
    amount: string;
    symbol: string | null;
    exponent: number | null;
}

/** A row of the holders snapshot (`/token/holders`), largest balance first. */
export interface ScanHolder {
    rank: number;
    address: string;
    label: ScanLabel | null;
    balance: string;
    /** Of the supply, five decimals; null without a supply. */
    share_pct: string | null;
}

/** `GET /accounts/{address}`: the indexed part plus the live state read from the node. */
export interface ScanAccount {
    address: string;
    label: ScanLabel | null;
    first_seen: {height: number; time: string} | null;
    last_seen_height: number | null;
    tx_count: number;
    activity_count: number;
    balances: ScanBalance[];
    delegations: {validator: string; moniker: string | null; amount: string}[];
    unbonding: {validator: string; moniker: string | null; amount: string; completion_time: string}[];
    rewards: {validator: string; coins: ScanCoin[]}[];
    total_staked: string | null;
    total_rewards: ScanCoin[];
    live: {available: boolean};
}

/** What one transaction or block did to an address (`/accounts/{address}/activity`). */
export interface ScanAccountActivity {
    time: string;
    height: number;
    /** Null for a block-level row. */
    tx_hash: string | null;
    kind: string;
    category: string;
    is_signer: boolean;
    success: boolean;
    counterparty: {address: string; label: ScanLabel | null; moniker: string | null} | null;
    /** The net balance change per denom, the fee included. */
    deltas: ScanBalance[];
    msg_types: string[];
    details: unknown;
    /** When the address signed or paid the transaction, else null. */
    fee: ScanBalance[] | null;
}

/** `/accounts/{address}/activity` adds `total` when asked by `page`. */
export interface ScanActivityPage extends ScanPage<ScanAccountActivity> {
    total?: number;
}

export interface ScanTxMessage {
    msg_index: number;
    type_url: string;
    sender: string | null;
    module: string | null;
    /** Proto JSON of the message (an authz MsgExec holds `msgs` with their `@type`); null when undecoded. */
    body: Record<string, unknown> | null;
    events: {type: string; attrs: Record<string, unknown>}[];
}

/** A transfer of the transaction page: the token rows without height, index and hash. */
export type ScanTxTransfer = Omit<ScanTransfer, "height" | "tx_index" | "tx_hash" | "time" | "msg_type">;

export interface ScanIbcTransfer {
    channel_id: string;
    sequence: number;
    direction: "in" | "out";
    status: string;
    sender: string;
    receiver: string;
    denom: string;
    amount: string;
    counterparty: {chain_id: string | null; pretty_name: string | null; logo_url: string | null} | null;
}

/** `GET /txs/{hash}`. Its `dex` outcome is kept loose: only the transaction page reads it. */
export interface ScanTx {
    height: number;
    tx_index: number;
    hash: string;
    time: string;
    success: boolean;
    msg_count: number;
    msg_types: string[];
    fee: ScanCoin[];
    signer: string | null;
    signers: string[];
    fee_payer: string | null;
    memo: string | null;
    code: number;
    error_log: string | null;
    gas_wanted: number;
    gas_used: number;
    messages: ScanTxMessage[];
    transfers: ScanTxTransfer[];
    dex: Record<string, unknown> | null;
    ibc_transfers: ScanIbcTransfer[] | null;
}

/** A module account the labels seed names (`/modules`). */
export interface ScanModule {
    address: string;
    name: string;
    module: string;
}
