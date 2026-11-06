import BigNumber from "bignumber.js";

import {formatUnits} from "./format";
import {type ActivityTag, MSG, tagOf} from "./tags";
import type {ScanBalance, ScanLabel, ScanTransfer, ScanTx, ScanTxMessage} from "./types";

// The Token Activity row model: one row per transaction that moved the token, built from the
// token's transfer rows (`/token/transfers`) grouped by tx hash, enriched by the transaction
// (`/txs/{hash}`) once it is read: the fee, the signer and the message count.
//
// Skipped: rows with no transaction (unlocks completing, burner and raffle burns, epoch payouts),
// and a transaction whose only rows are its fee (it paid the fee in the token, moved nothing).
// Token events are not rows here; they belong to the History tab.

/** The token the activity is about. */
export interface ActivityToken {
    denom: string;
    symbol: string;
    exponent: number;
}

/** The transfer rows of one transaction, newest transaction first. */
export interface TxGroup {
    txHash: string;
    height: number;
    txIndex: number;
    time: string;
    /** The rows of its messages (`msg_index` set), in Scan's order. */
    moves: ScanTransfer[];
    /** Its fee rows, present only when the fee was paid in the token. */
    feeRows: ScanTransfer[];
}

export interface ActivityRow {
    txHash: string;
    height: number;
    time: string;
    tag: ActivityTag;
    /** Other messages in the transaction ("+N"); 0 for none. */
    more: number;
    title: string;
    /** Who did it: the signer once the transaction is read, else the party the rows show. */
    actor: string | null;
    actorLabel: ScanLabel | null;
    /** The token moved, in base units (never negative). */
    amount: string;
    /** Whether the actor received the token, sent it, or neither (only moved others'). */
    direction: "in" | "out" | "none";
    /** The fee it paid; null until the transaction is read (unless it paid it in the token). */
    fee: ScanBalance[] | null;
    /** A cross-chain row's other chain, when known. */
    chain: string | null;
    /** The transaction (`/txs/{hash}`) has been read. */
    detailed: boolean;
}

/**
 * The transactions in `transfers` (newest first, as Scan sends them, possibly several pages
 * flattened). With `hasMore`, the last transaction may continue on the next page, so it is
 * held back until that page arrives.
 */
export function groupTransfers(transfers: ScanTransfer[], hasMore: boolean): TxGroup[] {
    const groups = new Map<string, TxGroup>();
    for (const row of transfers) {
        if (!row.tx_hash) continue;
        let group = groups.get(row.tx_hash);
        if (!group) {
            group = {txHash: row.tx_hash, height: row.height, txIndex: row.tx_index, time: row.time, moves: [], feeRows: []};
            groups.set(row.tx_hash, group);
        }
        (row.msg_index === null ? group.feeRows : group.moves).push(row);
    }

    const list = [...groups.values()];
    const lastHash = [...transfers].reverse().find((row) => row.tx_hash)?.tx_hash;
    const complete = hasMore && lastHash ? list.filter((group) => group.txHash !== lastHash) : list;

    return complete.filter((group) => group.moves.length > 0);
}

const isPartyLabel = (label: ScanLabel | null): boolean => !label || (label.kind !== "module" && label.kind !== "ibc_escrow");

/** The party the rows show as acting: the first non-module sender, else the first non-module recipient. */
function partyOf(moves: ScanTransfer[]): {address: string; label: ScanLabel | null} | null {
    for (const row of moves) {
        if (row.sender && isPartyLabel(row.sender_label)) return {address: row.sender, label: row.sender_label};
    }
    for (const row of moves) {
        if (row.recipient && isPartyLabel(row.recipient_label)) return {address: row.recipient, label: row.recipient_label};
    }
    return null;
}

/** The `@type` of each message an authz MsgExec runs, in order. */
function innerTypes(message: ScanTxMessage | undefined): string[] {
    const msgs = message?.body?.msgs;
    if (!Array.isArray(msgs)) return [];

    return msgs
        .map((m) => (m as {"@type"?: unknown})?.["@type"])
        .filter((type): type is string => typeof type === "string");
}

/** The message type the row is tagged by: the first message that moves the token, MsgExec unwrapped. */
function rowType(group: TxGroup, tx: ScanTx | undefined): {typeUrl: string | null; message: ScanTxMessage | undefined} {
    const first = group.moves.reduce((min, row) => (row.msg_index! < min.msg_index! ? row : min));
    const message = tx?.messages.find((m) => m.msg_index === first.msg_index);
    let typeUrl = first.msg_type ?? message?.type_url ?? null;

    // Scan resolves a MsgExec whose messages share one type; mixed ones keep MsgExec's own.
    if (typeUrl === MSG.exec) {
        const inner = innerTypes(message);
        typeUrl = inner[0] ?? null;
        const body = (message?.body?.msgs as Record<string, unknown>[] | undefined)?.[0];
        return {typeUrl, message: message && body ? {...message, type_url: typeUrl ?? message.type_url, body} : message};
    }

    return {typeUrl, message};
}

/** The other chain of a cross-chain row: its escrow account's label, else the transfer Scan matched. */
function chainOf(group: TxGroup, tx: ScanTx | undefined): string | null {
    for (const row of group.moves) {
        for (const label of [row.sender_label, row.recipient_label]) {
            const name = label?.kind === "ibc_escrow" ? /\(([^)]+)\)\s*$/.exec(label.name)?.[1] : undefined;
            if (name) return name;
        }
    }
    const counterparty = tx?.ibc_transfers?.find((t) => t.counterparty)?.counterparty;

    return counterparty?.pretty_name ?? counterparty?.chain_id ?? null;
}

/** The fee: the transaction's fee rows (they carry symbol and exponent), else its fee coins. */
function feeOf(group: TxGroup, tx: ScanTx | undefined): ScanBalance[] | null {
    const source = tx ? tx.transfers.filter((row) => row.msg_index === null) : group.feeRows;
    if (source.length > 0) {
        const byDenom = new Map<string, ScanBalance>();
        for (const row of source) {
            const current = byDenom.get(row.denom);
            byDenom.set(row.denom, current
                ? {...current, amount: new BigNumber(current.amount).plus(row.amount).toFixed()}
                : {denom: row.denom, amount: row.amount, symbol: row.symbol, exponent: row.exponent});
        }
        return [...byDenom.values()];
    }
    if (tx) return tx.fee.map((coin) => ({...coin, symbol: null, exponent: null}));

    return null;
}

/** A pool's "BASE / QUOTE" from its create message, with the symbols the transaction's rows show. */
function poolName(message: ScanTxMessage | undefined, tx: ScanTx | undefined, token: ActivityToken): string | null {
    const base = message?.body?.base;
    const quote = message?.body?.quote;
    if (typeof base !== "string" || typeof quote !== "string") return null;

    const symbolOf = (denom: string) => denom === token.denom
        ? token.symbol
        : tx?.transfers.find((row) => row.denom === denom && row.symbol)?.symbol;
    const [b, q] = [symbolOf(base), symbolOf(quote)];

    return b && q ? `${b} / ${q}` : null;
}

interface TitleInput {
    typeUrl: string | null;
    message: ScanTxMessage | undefined;
    direction: ActivityRow["direction"];
    amountText: string;
    chain: string | null;
    tx: ScanTx | undefined;
    token: ActivityToken;
}

function titleOf({typeUrl, message, direction, amountText, chain, tx, token}: TitleInput): string {
    const where = chain ?? "another chain";
    switch (typeUrl) {
        case MSG.multiSwap:
            return direction === "in" ? `Bought ${token.symbol}` : direction === "out" ? `Sold ${token.symbol}` : `Swapped ${token.symbol}`;
        case MSG.addLiquidity:
            return "Added liquidity";
        case MSG.removeLiquidity:
            return "Removed liquidity";
        case MSG.createLiquidityPool: {
            const pool = poolName(message, tx, token);
            return pool ? `Created the ${pool} pool` : "Created a pool";
        }
        case MSG.createOrder: {
            const side = message?.body?.order_type;
            return side === "buy" || side === "sell" ? `Placed a ${side} order` : "Placed an order";
        }
        case MSG.fillOrders:
            return "Filled orders";
        case MSG.cancelOrder:
            return "Cancelled an order";
        case MSG.joinDenomReward:
            return "Staked in the holders pool";
        case MSG.joinStaking:
            return "Staked in a reward program";
        case MSG.exitDenomReward:
        case MSG.exitStaking:
            return "Started unstaking";
        case MSG.claimDenomRewards:
        case MSG.claimStakingRewards:
            return "Claimed rewards";
        case MSG.createStakingReward:
        case MSG.createDenomReward:
        case MSG.createDenomRewardSchedule:
        case MSG.createTradingReward:
        case MSG.activateTradingReward:
            return "Started a reward program";
        case MSG.updateStakingReward:
        case MSG.updateDenomRewardSchedule:
            return "Extended a reward program";
        case MSG.distributeStakingRewards:
        case MSG.distributeDenomRewards:
            return "Added rewards";
        case MSG.fundBurner:
            return "Sent to the burner";
        case MSG.burn:
            return "Burned";
        case MSG.joinRaffle:
            return "Joined the raffle";
        case MSG.startRaffle:
            return "Started a raffle";
        case MSG.ibcTransfer:
            return `Sent to ${where}`;
        case MSG.ibcRecvPacket:
            return `Received from ${where}`;
        case MSG.ibcAcknowledgement:
        case MSG.ibcTimeout:
        case MSG.ibcTimeoutOnClose:
            return `Returned from ${where}`;
        case MSG.mint:
            return `Minted ${amountText}`;
        default:
            return direction === "in" ? `Received ${amountText}` : `Sent ${amountText}`;
    }
}

/** One transaction's row; `tx` is its `/txs/{hash}` answer once read. */
export function activityRow(group: TxGroup, tx: ScanTx | undefined, token: ActivityToken): ActivityRow {
    const party = tx?.signer ? {address: tx.signer, label: null} : partyOf(group.moves);
    const actor = party?.address ?? null;

    let net = new BigNumber(0);
    let largest = new BigNumber(0);
    for (const row of group.moves) {
        const amount = new BigNumber(row.amount);
        if (amount.gt(largest)) largest = amount;
        if (actor && row.recipient === actor) net = net.plus(amount);
        if (actor && row.sender === actor) net = net.minus(amount);
    }
    const direction = net.gt(0) ? "in" : net.lt(0) ? "out" : "none";
    const amount = (direction === "none" ? largest : net.abs()).toFixed();

    const {typeUrl, message} = rowType(group, tx);
    const tag = tagOf(typeUrl);
    const chain = tag === "Cross-chain" ? chainOf(group, tx) : null;
    const messages = tx ? tx.msg_count : new Set(group.moves.map((row) => row.msg_index)).size;
    const amountText = `${formatUnits(amount, token.exponent)} ${token.symbol}`;

    return {
        txHash: group.txHash,
        height: group.height,
        time: group.time,
        tag,
        more: Math.max(messages - 1, 0),
        title: titleOf({typeUrl, message, direction, amountText, chain, tx, token}),
        actor,
        actorLabel: party?.label ?? null,
        amount,
        direction,
        fee: feeOf(group, tx),
        chain,
        detailed: Boolean(tx),
    };
}

/** The rows of the transfers loaded so far; `txs` holds the transactions read so far, by hash. */
export function activityRows(
    transfers: ScanTransfer[],
    {hasMore, txs, token}: {hasMore: boolean; txs: ReadonlyMap<string, ScanTx>; token: ActivityToken},
): ActivityRow[] {
    return groupTransfers(transfers, hasMore).map((group) => activityRow(group, txs.get(group.txHash), token));
}
