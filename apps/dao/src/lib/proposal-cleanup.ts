import {cleanupBatchResult, type TxOutcome} from './dao-tx';

/** More batches than any proposal can need (a DAO has at most a few thousand ballots); stops a loop that makes no progress. */
export const MAX_CLEANUP_BATCHES = 500;

export interface CleanupDeps {
    /** Sends one MsgCleanupProposal (`limit` 0 = the chain's batch size). */
    sendBatch: () => Promise<TxOutcome>;
    /** True once the chain no longer has the proposal. Throws when the chain cannot be read. */
    isGone: () => Promise<boolean>;
    /** Called after each batch the chain accepted: the batches so far and the ballots deleted so far (null when the chain's events did not say). */
    onProgress?: (batches: number, processed: number | null) => void;
    maxBatches?: number;
}

export type CleanupResult =
    | {state: 'completed'; batches: number}
    /** A batch was refused, or its fate is unknown (`outcome.unconfirmed`). */
    | {state: 'stopped'; batches: number; reason: 'tx'; outcome: Extract<TxOutcome, {ok: false}>}
    /** The batch went through but the chain could not be asked whether the proposal is gone. */
    | {state: 'stopped'; batches: number; reason: 'unreadable'}
    | {state: 'stopped'; batches: number; reason: 'limit'}
    /** A batch said it was not finished yet but deleted nothing: another would be the same, so no more wallet prompts. */
    | {state: 'stopped'; batches: number; reason: 'no-progress'};

/**
 * Cleans a finished proposal up batch by batch. Each batch's `EventProposalCleaned` (read from the
 * transaction's events) says `completed` and how many ballots it deleted; when the events are not there
 * the chain is asked instead: the proposal is deleted with its last batch, so a chain that no longer has
 * it is the same signal. A refused batch asks once as well (someone else may have finished the job).
 */
export async function cleanupProposal(deps: CleanupDeps): Promise<CleanupResult> {
    const max = deps.maxBatches ?? MAX_CLEANUP_BATCHES;
    let batches = 0;
    let processed: number | null = 0;
    while (batches < max) {
        const outcome = await deps.sendBatch();
        if (!outcome.ok) {
            if (!outcome.unconfirmed) {
                try {
                    if (await deps.isGone()) return {state: 'completed', batches};
                } catch {
                    // the refusal is what is reported
                }
            }
            return {state: 'stopped', batches, reason: 'tx', outcome};
        }
        batches += 1;
        const result = cleanupBatchResult(outcome.response);
        processed = result?.processed !== null && result?.processed !== undefined && processed !== null ? processed + result.processed : null;
        deps.onProgress?.(batches, processed);
        if (result?.completed === true) return {state: 'completed', batches};
        if (result?.completed === false) {
            if (result.processed === 0) return {state: 'stopped', batches, reason: 'no-progress'};
            continue;
        }
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
