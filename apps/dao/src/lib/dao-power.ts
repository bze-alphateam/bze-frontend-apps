import type {DaoType, DaoVotingPowerResponse} from '@bze/bze-ui-kit';

export interface PowerLine {
    proposalId: string;
    text: string;
    /** Whether the wallet can vote on the proposal. */
    counts: boolean;
}

export interface PowerView {
    headline: string;
    lines: PowerLine[];
}

const positive = (amount: string | undefined): boolean => !!amount && /[1-9]/.test(amount);

/**
 * What the wallet's voting power in a DAO means, in words. `current` is the stake in the DAO's
 * current sources; each open proposal has its own `eligible_weight`, counted against the sources
 * the proposal pinned, so a wallet without power now can still count on an older proposal.
 * `formatStake` writes an amount with the staking denom; `titleOf` names a proposal.
 */
export function describeVotingPower(
    type: DaoType,
    power: DaoVotingPowerResponse,
    formatStake: (amount: string) => string,
    titleOf: (proposalId: string) => string | undefined,
): PowerView {
    const stake = type === 'DAO_TYPE_STAKE';
    const hasPower = positive(power.current);

    const headline = stake
        ? hasPower
            ? `You have ${formatStake(power.current)} voting power`
            : 'You have no voting power in this DAO'
        : hasPower
            ? 'You are a member: one member, one vote'
            : 'You are not a member of this DAO';

    const lines = power.proposals.map((p): PowerLine => {
        const name = titleOf(p.proposal_id);
        const label = name ? `#${p.proposal_id} ${name}` : `Proposal #${p.proposal_id}`;
        if (positive(p.eligible_weight)) {
            return {
                proposalId: p.proposal_id,
                counts: true,
                text: stake ? `${label}: your vote counts for ${formatStake(p.eligible_weight)}` : `${label}: you can vote`,
            };
        }
        if (hasPower) {
            return {
                proposalId: p.proposal_id,
                counts: false,
                text: stake
                    ? `${label}: your stake joined after this proposal started, so it does not count on it`
                    : `${label}: you were added after this proposal started, so you cannot vote on it`,
            };
        }
        return {proposalId: p.proposal_id, counts: false, text: `${label}: you cannot vote on it`};
    });

    return {headline, lines};
}
