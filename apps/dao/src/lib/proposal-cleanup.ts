import type {TxOutcome} from './dao-tx';

/** More batches than any proposal can need (a DAO has at most a few thousand ballots); stops a loop that makes no progress. */
export const MAX_CLEANUP_BATCHES = 500;

export interface CleanupDeps {
    /** Sends one MsgCleanupProposal (`limit` 0 = the chain's batch size). */
    sendBatch: () => Promise<TxOutcome>;
    /** True once the chain no longer has the proposal. Throws when the chain cannot be read. */
    isGone: () => Promise<boolean>;
    /** Called after each batch the chain accepted, with the count so far. */
    onProgress?: (batches: number) => void;
    maxBatches?: number;
}

export type CleanupResult =
    | {state: 'completed'; batches: number}
    /** A batch was refused, or its fate is unknown (`outcome.unconfirmed`). */
    | {state: 'stopped'; batches: number; reason: 'tx'; outcome: Extract<TxOutcome, {ok: false}>}
    /** The batch went through but the chain could not be asked whether the proposal is gone. */
    | {state: 'stopped'; batches: number; reason: 'unreadable'}
    | {state: 'stopped'; batches: number; reason: 'limit'};

/**
 * Cleans a finished proposal up batch by batch. The response of a batch carries `completed`, but a
 * transaction result does not reach this app, so completion is read from the chain: the proposal is
 * deleted with its last batch, and a chain that no longer has it is the one signal that counts.
 */
export async function cleanupProposal(deps: CleanupDeps): Promise<CleanupResult> {
    const max = deps.maxBatches ?? MAX_CLEANUP_BATCHES;
    let batches = 0;
    while (batches < max) {
        const outcome = await deps.sendBatch();
        if (!outcome.ok) return {state: 'stopped', batches, reason: 'tx', outcome};
        batches += 1;
        deps.onProgress?.(batches);
        let gone: boolean;
        try {
            gone = await deps.isGone();
        } catch {
            return {state: 'stopped', batches, reason: 'unreadable'};
        }
        if (gone) return {state: 'completed', batches};
    }
    return {state: 'stopped', batches, reason: 'limit'};
}
