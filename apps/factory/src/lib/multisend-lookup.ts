import { Recipient } from '@/lib/multisend'
import { ChainTxResult, FetchFn, restTxReader } from '@/lib/tx-lookup'

const MULTI_SEND = '/cosmos.bank.v1beta1.MsgMultiSend'
/** Recent multi-sends of the sender searched when the hash is unknown or not found. */
const SEARCH_LIMIT = 20

/** A transaction as the chain reports it, reduced to what the check needs. */
export interface ChainTx {
    txhash: string;
    /** 0 = executed. */
    code: number;
    /** Outputs of each MsgMultiSend in the tx. */
    multiSends: Array<Array<{ address: string; coins: Array<{ denom: string; amount: string }> }>>;
}

/** Where the check reads transactions from. Network failures throw; they never mean "not found". */
export interface TxLookup {
    /** The tx with this hash, or null when the chain doesn't know it. */
    getTx(hash: string): Promise<ChainTx | null>;
    /** The sender's most recent multi-sends, newest first. */
    recentMultiSends(sender: string): Promise<ChainTx[]>;
}

function toChainTx(tx: ChainTxResult): ChainTx {
    const multiSends = tx.messages
        .filter((m): m is { '@type': string; outputs?: ChainTx['multiSends'][number] } =>
            (m as { '@type'?: unknown })?.['@type'] === MULTI_SEND)
        .map(m => m.outputs ?? [])
    return { txhash: tx.txhash, code: tx.code, multiSends }
}

/** The multi-send view of the shared REST reader (lib/tx-lookup). */
export function restTxLookup(restUrl: string, fetchFn?: FetchFn): TxLookup {
    const reader = restTxReader(restUrl, fetchFn)
    return {
        async getTx(hash) {
            const tx = await reader.getTx(hash)
            return tx ? toChainTx(tx) : null
        },
        async recentMultiSends(sender) {
            const query = `message.sender='${sender}' AND message.action='${MULTI_SEND}'`
            return (await reader.searchTxs(query, SEARCH_LIMIT)).map(toChainTx)
        },
    }
}

function sameOutputs(chain: ChainTx['multiSends'][number], denom: string, outputs: ReadonlyArray<Recipient>): boolean {
    return chain.length === outputs.length && chain.every((o, i) =>
        o.address === outputs[i].address
        && o.coins.length === 1
        && o.coins[0].denom === denom
        && o.coins[0].amount === outputs[i].amount)
}

export type BatchCheck =
    | { result: 'sent'; txHash: string }
    /** On chain but failed: nobody was paid, it can be sent again. */
    | { result: 'failed' }
    | { result: 'not-found' }
    /** The node couldn't be reached: nothing is known, the batch stays unknown. */
    | { result: 'error' }

/**
 * Whether a batch whose outcome is unclear reached the chain: by its hash when we have one,
 * else (or when the hash is unknown to the node) among the sender's recent multi-sends with
 * exactly these outputs.
 */
export async function checkBatchOnChain(
    lookup: TxLookup,
    batch: { txHash?: string; sender?: string; denom: string; outputs: ReadonlyArray<Recipient> },
): Promise<BatchCheck> {
    try {
        if (batch.txHash) {
            const tx = await lookup.getTx(batch.txHash)
            if (tx) return tx.code === 0 ? { result: 'sent', txHash: tx.txhash } : { result: 'failed' }
        }
        if (batch.sender) {
            const recent = await lookup.recentMultiSends(batch.sender)
            const match = recent.find(tx => tx.code === 0 && tx.multiSends.some(m => sameOutputs(m, batch.denom, batch.outputs)))
            if (match) return { result: 'sent', txHash: match.txhash }
        }
        return { result: 'not-found' }
    } catch {
        return { result: 'error' }
    }
}
