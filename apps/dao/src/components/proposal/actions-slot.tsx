import {DAO_FEATURES} from '@/lib/dao-actions';
import type {ProposalModel} from '@/lib/proposal-model';

/**
 * The extension point of BFE-374: the buttons that act on a proposal (vote and revote, vote and settle,
 * settle, retry, cancel, clean up) render here, below the status. It renders nothing until the
 * `proposalActions` flag of `DAO_FEATURES` is turned on by that story; the page already says when anyone can settle.
 */
export const ProposalActionsSlot = ({model, wallet}: {model: ProposalModel; wallet: string | null}) => {
    if (!DAO_FEATURES.proposalActions) return null;
    return <div data-testid="proposal-actions" data-proposal={model.id} data-wallet={wallet ?? ''} />;
};
