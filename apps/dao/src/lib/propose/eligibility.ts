import type {Dao, DaoParams, DaoVotingPowerResponse} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import type {Part} from '../dao-view-loader';
import type {StakeSource} from '../dao-voters';

export type ProposerStatus =
    /** The wallet may propose: a member, or the DAO is open to anyone. */
    | {kind: 'allowed'; reason: string}
    /** A stake DAO's wallet with stake now: whether it counts (joined before this block) is the chain's to decide. */
    | {kind: 'maybe'; reason: string}
    /** The power could not be read: the chain decides at the simulation. */
    | {kind: 'unknown'}
    /** The wallet is not a voter and the DAO is not open: how to become one is explained instead of a submit button. */
    | {kind: 'not-a-voter'; message: string}
    /** Nobody can propose right now (chain errors 1119 and 1120). */
    | {kind: 'blocked'; message: string};

export interface EligibilityInput {
    dao: Pick<Dao, 'type' | 'members' | 'config' | 'electorate' | 'address'>;
    params: Pick<DaoParams, 'max_open_proposals'>;
    wallet: string;
    /** The wallet's voting power; failed when the chain could not be asked. */
    power: Part<DaoVotingPowerResponse | null>;
    /** The DAO's proposals in voting; failed when they could not be read. */
    openCount: number | null;
    /** The stake of a stake DAO's sources; failed when it could not be read. */
    sources: Part<StakeSource[]>;
}

const positive = (amount: string | undefined): boolean => !!amount && /[1-9]/.test(amount);

/** What the DAO's voters hold, without the DAO's own stake: the chain's `votingDenominator`. */
const voterStake = (sources: StakeSource[]): BigNumber =>
    sources.reduce((sum, s) => sum.plus(BigNumber.max(new BigNumber(s.staked).minus(s.own), 0)), new BigNumber(0));

/**
 * Whether this wallet can submit a proposal to this DAO, from what the chain exposes. The chain stays
 * the judge (its `checkProposer` runs at the simulation, error 1118): the only things decided here are
 * the ones that are certain: a DAO without voters (1119) or with `max_open_proposals` already in voting
 * (1120), and a wallet that is clearly not a voter of a DAO that is not open.
 *
 * `VotingPower.current` ignores join records, so for a stake DAO it can only say "no stake at all"
 * (blocked) or "some stake" (maybe: stake counts only when joined in an earlier block than the proposal).
 */
export function proposerStatus(input: EligibilityInput): ProposerStatus {
    const {dao, params, wallet, power, openCount, sources} = input;

    if (dao.type === 'DAO_TYPE_STATIC_LIST' ? dao.members.length === 0 : !dao.electorate || (sources.ok && !voterStake(sources.value).gt(0))) {
        return {kind: 'blocked', message: 'This DAO has no voters yet, so a proposal could not be decided. It needs at least one member, or some stake in its sources.'};
    }

    const max = Number(params.max_open_proposals);
    if (openCount !== null && openCount >= max) {
        return {kind: 'blocked', message: `This DAO already has ${openCount} proposals in voting, the most it allows (${max}). Try again when one of them has been settled.`};
    }

    if (dao.config.open_submission) return {kind: 'allowed', reason: 'This DAO is open: anyone can submit a proposal.'};

    if (dao.type === 'DAO_TYPE_STATIC_LIST') {
        return dao.members.some((m) => m.toLowerCase() === wallet.toLowerCase())
            ? {kind: 'allowed', reason: 'You are a member of this DAO.'}
            : {kind: 'not-a-voter', message: 'Only the members of this DAO can submit a proposal, and your wallet is not one of them.'};
    }

    if (!power.ok || power.value === null) return {kind: 'unknown'};
    return positive(power.value.current)
        ? {kind: 'maybe', reason: 'You have stake in this DAO. It counts only if it joined before the block your proposal lands in; the chain checks that before anything is signed.'}
        : {kind: 'not-a-voter', message: 'Only stakers of this DAO can submit a proposal, and your wallet has no stake in its sources.'};
}
