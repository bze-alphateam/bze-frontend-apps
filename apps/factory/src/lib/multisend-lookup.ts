import { Recipient } from '@/lib/multisend'

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

type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

function toChainTx(tx: unknown, response: unknown): ChainTx | undefined {
    const r = response as { txhash?: unknown; code?: unknown } | undefined
    if (!r || typeof r.txhash !== 'string') return undefined
    const messages = (tx as { body?: { messages?: unknown[] } } | undefined)?.body?.messages ?? []
    const multiSends = messages
        .filter((m): m is { '@type': string; outputs?: ChainTx['multiSends'][number] } =>
            (m as { '@type'?: unknown })?.['@type'] === MULTI_SEND)
        .map(m => m.outputs ?? [])
    return { txhash: r.txhash, code: Number(r.code ?? 0), multiSends }
}

/**
 * Cosmos REST (SDK 0.50). Checked on the BZE testnet node 2026-10-14: the search takes
 * `query=` (`events=` answers 500 "query cannot be empty") and `limit=` (`pagination.limit`
 * is ignored); an unknown hash answers 404.
 */
export function restTxLookup(restUrl: string, fetchFn: FetchFn = (url) => fetch(url)): TxLookup {
    const base = restUrl.replace(/\/+$/, '')
    return {
        async getTx(hash) {
            const res = await fetchFn(`${base}/cosmos/tx/v1beta1/txs/${encodeURIComponent(hash)}`)
            if (res.status === 404) return null
            if (!res.ok) throw new Error(`tx lookup failed: HTTP ${res.status}`)
            const body = await res.json() as { tx?: unknown; tx_response?: unknown }
            return toChainTx(body.tx, body.tx_response) ?? null
        },
        async recentMultiSends(sender) {
            const query = `message.sender='${sender}' AND message.action='${MULTI_SEND}'`
            const params = new URLSearchParams({ query, order_by: '2', limit: String(SEARCH_LIMIT) })
            const res = await fetchFn(`${base}/cosmos/tx/v1beta1/txs?${params.toString()}`)
            if (!res.ok) throw new Error(`tx search failed: HTTP ${res.status}`)
            const body = await res.json() as { txs?: unknown[]; tx_responses?: unknown[] }
            const responses = body.tx_responses ?? []
            return responses
                .map((r, i) => toChainTx(body.txs?.[i], r))
                .filter((t): t is ChainTx => t !== undefined)
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
