import BigNumber from 'bignumber.js';

/** One source of a stake DAO's electorate, read from x/rewards. `own` is what the DAO's own account has staked in it. */
export type StakeSource =
    | {kind: 'sr'; id: string; stakingDenom: string; lockDays: number; staked: string; own: string}
    | {kind: 'dr'; stakingDenom: string; lockDays: number; staked: string; own: string};

/** The id the DEX staking page uses for a source (`simple:<reward id>` or `compounded:<denom>`). */
export const sourceRowId = (source: StakeSource): string =>
    source.kind === 'sr' ? `simple:${source.id}` : `compounded:${source.stakingDenom}`;

/** The DEX page of a source's staking row. */
export const dexSourceHref = (dexHref: string, source: StakeSource): string =>
    `${dexHref.replace(/\/$/, '')}/staking/details?id=${encodeURIComponent(sourceRowId(source))}`;

/** A source as the board names it: a staking reward is a "Simple reward #n", a Denom Reward the "Compounded reward". */
export const sourceName = (source: StakeSource): string =>
    source.kind === 'sr' ? `Simple reward #${Number(source.id) || source.id}` : 'Compounded reward';

/** The line under a source's name: its token and its unstaking lock ("HONEY · 7-day unstaking lock"). */
export const sourceDetail = (source: StakeSource, ticker: string): string =>
    `${ticker} · ${source.lockDays}-day unstaking lock`;

/**
 * Total voting power: what is staked in the sources, less the DAO's own stake in them (a treasury
 * staked in its own sources never votes, and the chain leaves it out of the denominator).
 */
export function totalVotingPower(sources: readonly StakeSource[]): string {
    return sources.reduce((sum, s) => {
        const voters = new BigNumber(s.staked || '0').minus(s.own || '0');
        return sum.plus(voters.isPositive() ? voters : 0);
    }, new BigNumber(0)).toFixed(0);
}

/** The staking denom to write an amount in: a current source's, else the Denom Reward a proposal pinned. */
export function stakingDenomFor(sources: readonly StakeSource[], pinned: ReadonlyArray<{dr_denom: string} | null | undefined>): string | undefined {
    return sources[0]?.stakingDenom ?? pinned.map((p) => p?.dr_denom).find((d): d is string => !!d);
}

/** The shortest member list shown at once; the rest sits behind "Show all". */
export const MEMBERS_PREVIEW = 12;

export const memberPreview = <T,>(members: readonly T[], showAll: boolean): {shown: T[]; hidden: number} =>
    showAll || members.length <= MEMBERS_PREVIEW
        ? {shown: [...members], hidden: 0}
        : {shown: members.slice(0, MEMBERS_PREVIEW), hidden: members.length - MEMBERS_PREVIEW};
