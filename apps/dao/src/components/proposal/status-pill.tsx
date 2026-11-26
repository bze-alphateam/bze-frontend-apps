import {StatusPill} from '@bze/bze-ui-kit';
import {describeStatus, statusLabel, statusTone, type StatusView} from '@/lib/proposal-status';
import type {DaoProposalStatus} from '@bze/bze-ui-kit';

/** A proposal's status in its colour; `view` is the full reading with the settle flags (the proposal page). */
export const ProposalStatusPill = ({view}: {view: StatusView}) => (
    <StatusPill tone={view.tone} live={view.live}>
        <span data-testid="proposal-status" data-status={view.key}>{view.label}</span>
    </StatusPill>
);

/** The plain status of a list row. */
export const RowStatusPill = ({status}: {status: DaoProposalStatus}) => (
    <StatusPill tone={statusTone(status)} live={status === 'VOTING'}>
        <span data-testid="row-status">{statusLabel(status)}</span>
    </StatusPill>
);

export {describeStatus};
