import type {DaoType, DaoVotingPowerResponse} from '@bze/bze-ui-kit';

/** The wallet's role in the DAO, as the card's pill says it. */
export interface PowerRole {
    label: 'Staker' | 'No stake' | 'Member' | 'Not a member';
    /** Whether the wallet has power now (indigo pill) or not (neutral). */
    active: boolean;
}

/** What one open proposal counts for the wallet. */
export type PowerOnProposal =
    /** A stake DAO: the weight that counts; `of` is the current power when only part of it counts. */
    | {kind: 'weight'; amount: string; of: string | null}
    /** A member list, the wallet can vote: `voted` is its option, null when it has not voted, undefined when unknown. */
    | {kind: 'member'; voted: string | null | undefined}
    /** The wallet cannot vote on it. */
    | {kind: 'none'};

export interface PowerLine {
    proposalId: string;
    /** "#21 Fund the liquidity push", or "Proposal #21" without a title. */
    label: string;
    value: PowerOnProposal;
}

export interface PowerView {
    role: PowerRole;
    /** The current power: the stake (an amount in base units) or 1 / 0 votes. */
    current: string;
    stake: boolean;
    lines: PowerLine[];
    /** The small lines under the list: why some power does not count on a proposal. */
    notes: string[];
}

const positive = (amount: string | undefined): boolean => !!amount && /[1-9]/.test(amount);
const less = (a: string, b: string): boolean => {
    try {
        return BigInt(a) < BigInt(b);
    } catch {
        return false;
    }
};

/**
 * The wallet's voting power in a DAO, shaped as the "Your voting power" card. `current` is the stake in the
 * DAO's current sources (1 / 0 in a member list); each open proposal has its own `eligible_weight`, counted
 * against the sources it pinned, so a wallet without power now can still count on an older proposal, and a
 * wallet that joined or added stake after a proposal started counts for less (or nothing) on it.
 * `titleOf` names a proposal; `votedOn` is the wallet's option on a proposal (null: no vote, undefined: unknown).
 */
export function describeVotingPower(
    type: DaoType,
    power: DaoVotingPowerResponse,
    titleOf: (proposalId: string) => string | undefined,
    votedOn: (proposalId: string) => string | null | undefined = () => undefined,
): PowerView {
    const stake = type === 'DAO_TYPE_STAKE';
    const hasPower = positive(power.current);
    const role: PowerRole = stake
        ? {label: hasPower ? 'Staker' : 'No stake', active: hasPower}
        : {label: hasPower ? 'Member' : 'Not a member', active: hasPower};
    const notes: string[] = [];

    const lines = power.proposals.map((p): PowerLine => {
        const name = titleOf(p.proposal_id);
        const label = name ? `#${p.proposal_id} ${name}` : `Proposal #${p.proposal_id}`;
        const ref = `#${p.proposal_id}`;
        const counts = positive(p.eligible_weight);
        if (stake) {
            if (!counts) {
                if (hasPower) notes.push(`On ${ref} your stake doesn't count: you joined or added to it after ${ref} started.`);
                return {proposalId: p.proposal_id, label, value: {kind: 'none'}};
            }
            const partial = hasPower && less(p.eligible_weight, power.current);
            if (partial) notes.push(`On ${ref} only part of your stake counts: you joined or added to it after ${ref} started.`);
            return {proposalId: p.proposal_id, label, value: {kind: 'weight', amount: p.eligible_weight, of: partial ? power.current : null}};
        }
        if (!counts) {
            if (hasPower) notes.push(`You were added after ${ref} started, so you can't vote on it.`);
            return {proposalId: p.proposal_id, label, value: {kind: 'none'}};
        }
        return {proposalId: p.proposal_id, label, value: {kind: 'member', voted: votedOn(p.proposal_id)}};
    });

    return {role, current: power.current, stake, lines, notes};
}
