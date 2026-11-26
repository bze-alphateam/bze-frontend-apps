import type {DaoParams} from '@bze/bze-ui-kit';
import type {ProposalModel} from './proposal-model';
import {secondsOf} from './dao-rules';

export type TimelineKind = 'submitted' | 'early' | 'voting-end' | 'settled' | 'executed' | 'failed' | 'retry' | 'cancelled' | 'cleaned';

export interface TimelineItem {
    kind: TimelineKind;
    label: string;
    /** ISO time; null when only a block height is known. */
    time: string | null;
    height: number | null;
    /** Extra words under the label. */
    detail: string;
    /** In the future, or an open possibility: drawn dimmed. */
    upcoming: boolean;
}

/** The chain's fixed reasons a proposal's actions can fail (x/dao execution), in words. */
const EXECUTION_ERRORS: Record<string, string> = {
    'unauthorized signer': 'a message was signed by an account other than the DAO',
    'message not allowed': 'a message of a type a DAO may not run',
    'execution nested too deep': 'DAO executions are nested too deep',
    'message panicked': 'a message crashed while running',
    'invalid message': 'a message was invalid',
    'message failed': 'a message failed (for example a spend from an empty treasury)',
};

/** The reason an execution failed in words; the raw text when it is not one of the chain's fixed reasons. */
export function describeExecutionError(error: string | null | undefined): string {
    if (!error) return '';
    const text = error.trim();
    const known = Object.keys(EXECUTION_ERRORS).find((k) => text.toLowerCase().includes(k));
    return known ? `${EXECUTION_ERRORS[known]} (${known})` : text;
}

/**
 * The life of a proposal in order. Times come from the chain's proposal; the settle, the execution result
 * and the cleanup come from Scan (heights only, Scan keeps no block times for them), so a proposal read
 * without Scan shows the first three kinds only.
 */
export function buildTimeline(
    p: Pick<ProposalModel, 'status' | 'expedited' | 'daoType' | 'submitTime' | 'submitHeight' | 'votingEnd' | 'retryDeadline' | 'outcome'>,
    params: Pick<DaoParams, 'min_expedite_delay'> | null,
    nowMs: number,
): TimelineItem[] {
    const items: TimelineItem[] = [];
    const heightOf = (h: string | null) => (h && /^\d+$/.test(h) ? Number(h) : null);

    items.push({kind: 'submitted', label: 'Submitted', time: p.submitTime, height: heightOf(p.submitHeight), detail: '', upcoming: false});

    // Early settle: stake DAOs only, after the delay; a static list's members are fixed, so it has none.
    if (p.expedited && p.daoType === 'DAO_TYPE_STAKE' && p.submitTime && params) {
        const delay = secondsOf(params.min_expedite_delay);
        if (delay !== null && delay > 0) {
            const at = new Date(new Date(p.submitTime).getTime() + delay * 1000).toISOString();
            items.push({
                kind: 'early', label: 'Earliest early settle', time: at, height: null,
                detail: 'An expedited proposal can be settled from here on once it meets the expedite bars.',
                upcoming: p.status === 'VOTING' && new Date(at).getTime() > nowMs,
            });
        }
    }

    const ended = p.votingEnd !== null && new Date(p.votingEnd).getTime() <= nowMs;
    items.push({
        kind: 'voting-end', label: ended || p.status !== 'VOTING' ? 'Voting ended' : 'Voting ends', time: p.votingEnd, height: null, detail: '',
        upcoming: p.status === 'VOTING' && !ended,
    });

    const scan = p.outcome;
    if (scan?.cancelledHeight) {
        items.push({kind: 'cancelled', label: 'Cancelled by the proposer', time: null, height: scan.cancelledHeight, detail: '', upcoming: false});
    }
    if (scan?.settledHeight) {
        items.push({
            kind: 'settled', label: scan.expeditedEarly ? 'Settled early' : 'Settled', time: null, height: scan.settledHeight,
            detail: '', upcoming: false,
        });
    }
    if (scan && p.status === 'EXECUTED') {
        items.push({kind: 'executed', label: 'Actions executed', time: null, height: scan.settledHeight, detail: '', upcoming: false});
    }
    if (p.status === 'EXECUTION_FAILED' || (p.status === 'EXPIRED' && scan?.executionError)) {
        const why = describeExecutionError(scan?.executionError);
        items.push({kind: 'failed', label: 'Execution failed', time: null, height: scan?.settledHeight ?? null, detail: why ? `Reason: ${why}.` : '', upcoming: false});
    }
    if (p.retryDeadline) {
        items.push({
            kind: 'retry', label: 'Retry deadline', time: p.retryDeadline, height: null,
            detail: 'Until then anyone can retry; a settle after it expires the proposal.',
            upcoming: new Date(p.retryDeadline).getTime() > nowMs,
        });
    }
    if (scan?.cleanedHeight) {
        items.push({kind: 'cleaned', label: 'Cleaned up', time: null, height: scan.cleanedHeight, detail: 'The chain no longer stores this proposal or its votes.', upcoming: false});
    }
    return items;
}
