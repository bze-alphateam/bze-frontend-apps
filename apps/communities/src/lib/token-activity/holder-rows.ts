import BigNumber from "bignumber.js";

import {activityRow, type ActivityRow, type ActivityToken, type TxGroup} from "./rows";
import type {ScanAccountActivity} from "./types";

// The holder page's rows: the address's activity in the token (`/accounts/{address}/activity
// ?denom=`), drawn with the Activity tab's row model so the tags and titles match. Each row is
// built from its activity item alone (no `/txs` read per row): the tag from its first message
// type, the amount and direction from its `deltas` entry for the token (the holder's own change),
// the fee from its `fee`.

/**
 * One activity item as a row, or undefined for one the page skips: a block-level row (no
 * transaction) or one that didn't change the holder's balance of the token.
 */
export function holderActivityRow(item: ScanAccountActivity, token: ActivityToken, address: string): ActivityRow | undefined {
    if (!item.tx_hash) return undefined;
    const change = new BigNumber(item.deltas.find((delta) => delta.denom === token.denom)?.amount ?? 0);
    if (!change.isFinite() || change.isZero()) return undefined;

    // One move standing for the holder's change, tagged by the item's first message.
    const group: TxGroup = {
        txHash: item.tx_hash,
        height: item.height,
        txIndex: 0,
        time: item.time,
        moves: [{
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
        }],
        feeRows: [],
    };
    const row = activityRow(group, undefined, token);

    return {
        ...row,
        more: Math.max(item.msg_types.length - 1, 0),
        // Paid by whoever signed; an empty list when this holder didn't.
        fee: item.fee ?? [],
    };
}
