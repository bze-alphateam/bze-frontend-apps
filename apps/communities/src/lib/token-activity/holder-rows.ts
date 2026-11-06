import BigNumber from "bignumber.js";

import {activityRow, type ActivityRow, type ActivityToken, type TxGroup} from "./rows";
import type {ScanAccountActivity, ScanTransfer, ScanTx} from "./types";

// The holder page's rows: the address's activity in the token (`/accounts/{address}/activity
// ?denom=`), drawn with the Activity tab's row model so the tags and titles match. The amount is
// the holder's own change in the token (its `deltas`, signed by `direction`), not what the
// transaction moved in all.

/** The token rows of a transaction, as `/token/transfers` would list them. */
function txMoves(tx: ScanTx, denom: string): ScanTransfer[] {
    return tx.transfers
        .filter((row) => row.msg_index !== null && row.denom === denom)
        .map((row) => ({
            ...row,
            height: tx.height,
            tx_index: tx.tx_index,
            tx_hash: tx.hash,
            time: tx.time,
            msg_type: tx.messages.find((message) => message.msg_index === row.msg_index)?.type_url ?? null,
        }));
}

/**
 * One activity item as a row, or undefined for one the page skips: a block-level row (no
 * transaction) or one that didn't change the holder's balance of the token. `tx` is the
 * transaction once read; until then the row is drawn from the item alone.
 */
export function holderActivityRow(item: ScanAccountActivity, tx: ScanTx | undefined, token: ActivityToken, address: string): ActivityRow | undefined {
    if (!item.tx_hash) return undefined;
    const change = new BigNumber(item.deltas.find((delta) => delta.denom === token.denom)?.amount ?? 0);
    if (!change.isFinite() || change.isZero()) return undefined;

    const fromTx = tx ? txMoves(tx, token.denom) : [];
    // Until the transaction is read: one move standing for the holder's change, tagged by the
    // item's first message.
    const moves: ScanTransfer[] = fromTx.length > 0 ? fromTx : [{
        height: item.height,
        tx_index: 0,
        tx_hash: item.tx_hash,
        time: item.time,
        seq: 0,
        msg_index: 0,
        msg_type: item.msg_types[0] ?? null,
        kind: "transfer",
        sender: change.lt(0) ? address : null,
        sender_label: null,
        recipient: change.gt(0) ? address : null,
        recipient_label: null,
        denom: token.denom,
        amount: change.abs().toFixed(),
        symbol: token.symbol,
        exponent: token.exponent,
    }];
    const group: TxGroup = {txHash: item.tx_hash, height: item.height, txIndex: tx?.tx_index ?? 0, time: item.time, moves, feeRows: []};
    const row = activityRow(group, tx, token);

    return {
        ...row,
        amount: change.abs().toFixed(),
        direction: change.gt(0) ? "in" : "out",
        fee: item.fee ?? row.fee,
        more: tx ? row.more : Math.max(item.msg_types.length - 1, 0),
    };
}
