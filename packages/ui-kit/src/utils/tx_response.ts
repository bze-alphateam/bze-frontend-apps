// The payload delivered to useTx's onSuccess — the result of broadcastResult.wait(),
// which is a TxResponse from @interchainjs/cosmos containing the inclusion details.
export interface TxSuccessResponse {
    height: number;
    txhash: string;
    code: number;
    rawLog?: string;
    [key: string]: unknown;
}

/**
 * Turns the TxResponse returned by interchainjs' `broadcastResult.wait()` into a
 * TxSuccessResponse. interchainjs hands `height` over as a BigInt, so callers doing
 * `height + 2` threw "Cannot mix BigInt and other types" (the raffle result never showed).
 */
export function toTxSuccessResponse(resp: Record<string, unknown>): TxSuccessResponse {
    return {
        ...resp,
        height: Number(resp.height ?? 0),
        txhash: String(resp.txhash ?? ""),
        code: Number(resp.code ?? 0),
    } as TxSuccessResponse;
}
