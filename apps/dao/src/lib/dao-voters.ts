import BigNumber from 'bignumber.js';

/** One source of a stake DAO's electorate, read from x/rewards. */
export type StakeSource =
    | {kind: 'sr'; id: string; stakingDenom: string; lockDays: number; staked: string}
    | {kind: 'dr'; stakingDenom: string; lockDays: number; staked: string};

/** The id the DEX staking page uses for a source (`simple:<reward id>` or `compounded:<denom>`). */
export const sourceRowId = (source: StakeSource): string =>
    source.kind === 'sr' ? `simple:${source.id}` : `compounded:${source.stakingDenom}`;

/** The DEX page of a source's staking row. */
export const dexSourceHref = (dexHref: string, source: StakeSource): string =>
    `${dexHref.replace(/\/$/, '')}/staking/details?id=${encodeURIComponent(sourceRowId(source))}`;

export const sourceName = (source: StakeSource, ticker: string): string =>
    source.kind === 'sr' ? `Staking reward ${Number(source.id) || source.id} (${ticker})` : `Denom Reward of ${ticker}`;

/**
 * Total voting power: the sum of what is staked in the sources (they all stake the same denom).
 * The chain's denominator leaves out the DAO's own stake in its sources; this sum does not.
 */
export function totalVotingPower(sources: readonly StakeSource[]): string {
    return sources.reduce((sum, s) => sum.plus(s.staked || '0'), new BigNumber(0)).toFixed(0);
}

/** The shortest member list shown at once; the rest sits behind "Show all". */
export const MEMBERS_PREVIEW = 12;

export const memberPreview = <T,>(members: readonly T[], showAll: boolean): {shown: T[]; hidden: number} =>
    showAll || members.length <= MEMBERS_PREVIEW
        ? {shown: [...members], hidden: 0}
        : {shown: members.slice(0, MEMBERS_PREVIEW), hidden: members.length - MEMBERS_PREVIEW};
