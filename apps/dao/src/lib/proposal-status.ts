import type {DaoProposalStatus} from '@bze/bze-ui-kit';
import type {ProposalModel} from './proposal-model';
import {formatDateTime} from './format';

export type StatusTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusView {
    /** A stable key for tests and styling. */
    key: 'voting' | 'ended' | 'rejected' | 'executed' | 'failed' | 'expired' | 'cancelled';
    label: string;
    tone: StatusTone;
    /** An in-flight state (breathing dot). */
    live: boolean;
    /** A line under the pill; empty when there is nothing to add. */
    note: string;
}

/** Whether the proposal can still change by itself (voting, or a failed execution that may be retried). */
export const isOpenStatus = (status: DaoProposalStatus): boolean => status === 'VOTING' || status === 'EXECUTION_FAILED';

const LABELS: Record<DaoProposalStatus, string> = {
    VOTING: 'Voting',
    REJECTED: 'Rejected',
    EXECUTED: 'Executed',
    EXECUTION_FAILED: 'Execution failed',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
};

/** The plain label of a status (for lists, where the settle flags are not known). */
export const statusLabel = (status: DaoProposalStatus): string => LABELS[status];

export const statusTone = (status: DaoProposalStatus): StatusTone =>
    ({VOTING: 'info', REJECTED: 'danger', EXECUTED: 'success', EXECUTION_FAILED: 'warning', EXPIRED: 'neutral', CANCELLED: 'neutral'} as const)[status];

/** The status of a proposal in words, with the chain's settle flags and the retry deadline. */
export function describeStatus(p: Pick<ProposalModel, 'status' | 'votingEnded' | 'expediteSettleable' | 'retryDeadline'>): StatusView {
    switch (p.status) {
        case 'VOTING':
            if (p.votingEnded) {
                return {key: 'ended', label: 'Voting ended, waiting to be settled', tone: 'warning', live: false, note: 'The result is decided from the tally below once someone settles it.'};
            }
            return {
                key: 'voting', label: 'Voting', tone: 'info', live: true,
                note: p.expediteSettleable ? 'The expedited bars are already met: it can be settled before the voting period ends.' : '',
            };
        case 'EXECUTION_FAILED': {
            const until = formatDateTime(p.retryDeadline);
            return {
                key: 'failed', label: 'Execution failed', tone: 'warning', live: false,
                note: until ? `It passed but its actions failed. Anyone can retry until ${until}.` : 'It passed but its actions failed. Anyone can retry until the retry deadline.',
            };
        }
        case 'REJECTED':
            return {key: 'rejected', label: 'Rejected', tone: 'danger', live: false, note: ''};
        case 'EXECUTED':
            return {key: 'executed', label: 'Executed', tone: 'success', live: false, note: ''};
        case 'EXPIRED':
            return {key: 'expired', label: 'Expired', tone: 'neutral', live: false, note: 'It passed but its actions never ran before the retry deadline.'};
        case 'CANCELLED':
            return {key: 'cancelled', label: 'Cancelled', tone: 'neutral', live: false, note: 'The proposer withdrew it.'};
    }
}

/** Anyone can settle it now (the button is BFE-374; the page only says so). */
export const canSettleNow = (p: Pick<ProposalModel, 'status' | 'votingEnded' | 'expediteSettleable'>): boolean =>
    p.status === 'VOTING' && (p.votingEnded || p.expediteSettleable);
