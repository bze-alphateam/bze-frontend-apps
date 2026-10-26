/** A transaction as the chain's REST reports it, reduced to what the checks need. */
export interface ChainTxResult {
    txhash: string;
    /** 0 = executed. */
    code: number;
    /** The block it was included in (0 when the node didn't say). */
    height: number;
    rawLog?: string;
    /** The tx body's messages, as JSON (`@type` plus the fields). */
    messages: unknown[];
}

/** Where transactions are read from. Network failures throw; they never mean "not found". */
export interface TxReader {
    /** The tx with this hash, or null when the chain doesn't know it. */
    getTx(hash: string): Promise<ChainTxResult | null>;
    /** The txs matching a CometBFT event query, newest first. */
    searchTxs(query: string, limit: number): Promise<ChainTxResult[]>;
}

export type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

function toResult(tx: unknown, response: unknown): ChainTxResult | undefined {
    const r = response as { txhash?: unknown; code?: unknown; height?: unknown; raw_log?: unknown } | undefined
    if (!r || typeof r.txhash !== 'string') return undefined
    const messages = (tx as { body?: { messages?: unknown[] } } | undefined)?.body?.messages ?? []
    return {
        txhash: r.txhash,
        code: Number(r.code ?? 0),
        height: Number(r.height ?? 0),
        rawLog: typeof r.raw_log === 'string' && r.raw_log !== '' ? r.raw_log : undefined,
        messages,
    }
}

/**
 * Cosmos REST (SDK 0.50). Checked on the BZE testnet node 2026-10-14: the search takes
 * `query=` (`events=` answers 500 "query cannot be empty") and `limit=` (`pagination.limit`
 * is ignored); an unknown hash answers 404.
 */
export function restTxReader(restUrl: string, fetchFn: FetchFn = (url) => fetch(url)): TxReader {
    const base = restUrl.replace(/\/+$/, '')
    return {
        async getTx(hash) {
            const res = await fetchFn(`${base}/cosmos/tx/v1beta1/txs/${encodeURIComponent(hash)}`)
            if (res.status === 404) return null
            if (!res.ok) throw new Error(`tx lookup failed: HTTP ${res.status}`)
            const body = await res.json() as { tx?: unknown; tx_response?: unknown }
            return toResult(body.tx, body.tx_response) ?? null
        },
        async searchTxs(query, limit) {
            const params = new URLSearchParams({ query, order_by: '2', limit: String(limit) })
            const res = await fetchFn(`${base}/cosmos/tx/v1beta1/txs?${params.toString()}`)
            if (!res.ok) throw new Error(`tx search failed: HTTP ${res.status}`)
            const body = await res.json() as { txs?: unknown[]; tx_responses?: unknown[] }
            const responses = body.tx_responses ?? []
            return responses
                .map((r, i) => toResult(body.txs?.[i], r))
                .filter((t): t is ChainTxResult => t !== undefined)
        },
    }
}

export type TxStatusCheck =
    | { result: 'confirmed'; txHash: string; height: number }
    /** Included in a block but refused: `rawLog` holds the chain's reason. */
    | { result: 'failed'; txHash: string; height: number; rawLog?: string }
    /** The node doesn't know the hash (yet). */
    | { result: 'not-found' }
    /** The node couldn't be reached: nothing is known. */
    | { result: 'error' }

/** What the chain says about a transaction hash right now. */
export async function checkTxStatus(reader: TxReader, hash: string): Promise<TxStatusCheck> {
    try {
        const tx = await reader.getTx(hash)
        if (!tx) return { result: 'not-found' }
        return tx.code === 0
            ? { result: 'confirmed', txHash: tx.txhash, height: tx.height }
            : { result: 'failed', txHash: tx.txhash, height: tx.height, rawLog: tx.rawLog }
    } catch {
        return { result: 'error' }
    }
}
