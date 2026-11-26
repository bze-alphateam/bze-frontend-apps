import BigNumber from "bignumber.js";
import {DaoParams, DaoStakeElectorate} from "../../types/dao";

// The voters of a stake DAO: staking rewards ("Simple rewards") and one Denom Reward
// ("Compounded reward") that all stake the same token. These are pure mirrors of the
// chain's `validateStakeSources` (x/dao keeper), fed with the sources a page has loaded,
// so the create flow can show the reason before anything is signed. The chain stays
// authoritative.

export interface DaoStakeSource {
    /** `sr`: a staking reward, `dr`: the Denom Reward of a token. */
    kind: 'sr' | 'dr';
    /** The reward id of a staking reward, the staking denom of a Denom Reward. */
    id: string;
    stakingDenom: string;
    /** Days a stake stays locked after leaving. */
    lock: number;
    /** Total staked, base units. */
    staked: string;
}

export interface DaoSourceRow extends DaoStakeSource {
    selected: boolean;
    /** Set when the source cannot be picked (or kept): the reason in words. */
    disabledReason?: string;
}

export const daoSourceKey = (source: Pick<DaoStakeSource, 'kind' | 'id'>): string => `${source.kind}/${source.id}`;

type TickerOf = (denom: string) => string;

const sourceName = (source: Pick<DaoStakeSource, 'kind' | 'id'>): string =>
    source.kind === 'dr' ? 'The Compounded reward' : `Simple reward #${Number(source.id) || source.id}`;

const selectedSources = (electorate: DaoStakeElectorate, sources: DaoStakeSource[]): {found: DaoStakeSource[]; missing: string[]} => {
    const found: DaoStakeSource[] = [];
    const missing: string[] = [];
    for (const id of electorate.sr_ids) {
        const s = sources.find(x => x.kind === 'sr' && x.id === id);
        if (s) found.push(s); else missing.push(`Simple reward #${Number(id) || id}`);
    }
    if (electorate.dr_denom !== '') {
        const s = sources.find(x => x.kind === 'dr' && x.id === electorate.dr_denom);
        if (s) found.push(s); else missing.push('The Compounded reward');
    }
    return {found, missing};
}

/**
 * The staking denom the electorate is fixed to: the host's, else the denom of the first picked
 * source, else none (every source is still open).
 */
export const electorateStakingDenom = (
    electorate: DaoStakeElectorate,
    sources: DaoStakeSource[],
    lockedDenom?: string,
): string | undefined => lockedDenom ?? selectedSources(electorate, sources).found[0]?.stakingDenom;

/**
 * Every source worth showing, with its state. A source that stakes another token than the
 * one fixed, or whose lock is below the chain's minimum, is shown disabled with the reason
 * (a picked one stays tickable so it can be dropped). When the host fixes a staking denom only
 * its sources are listed.
 */
export const daoSourceRows = (input: {
    sources: DaoStakeSource[];
    electorate: DaoStakeElectorate;
    params: Pick<DaoParams, 'max_sr_per_dao' | 'min_electorate_lock_days'>;
    lockedDenom?: string;
    tickerOf: TickerOf;
}): DaoSourceRow[] => {
    const {sources, electorate, params, lockedDenom, tickerOf} = input;
    const denom = electorateStakingDenom(electorate, sources, lockedDenom);
    const picked = new Set([...electorate.sr_ids.map(id => `sr/${id}`), ...(electorate.dr_denom ? [`dr/${electorate.dr_denom}`] : [])]);
    const maxSr = Number(params.max_sr_per_dao);
    const minLock = params.min_electorate_lock_days;

    return sources
        .filter(s => !lockedDenom || s.stakingDenom === lockedDenom)
        .map((s): DaoSourceRow => {
            const selected = picked.has(daoSourceKey(s));
            let disabledReason: string | undefined;
            if (s.lock < minLock) {
                disabledReason = `${s.lock}-day lock: needs at least ${minLock} days, or stake could leave and vote again from another wallet.`;
            } else if (denom && s.stakingDenom !== denom) {
                disabledReason = `Stakes ${tickerOf(s.stakingDenom)}, not ${tickerOf(denom)}. All sources of a DAO must stake the same token.`;
            } else if (!selected && s.kind === 'sr' && electorate.sr_ids.length >= maxSr) {
                disabledReason = `A DAO can vote with at most ${maxSr} Simple rewards.`;
            }
            return {...s, selected, disabledReason};
        })
        .sort((a, b) => (a.kind === b.kind ? new BigNumber(b.staked).comparedTo(a.staked) ?? 0 : a.kind === 'dr' ? -1 : 1));
}

/** Pick or drop a source; the Denom Reward is named by its staking denom, there is at most one. */
export const toggleDaoSource = (electorate: DaoStakeElectorate, source: DaoStakeSource, on: boolean): DaoStakeElectorate => {
    if (source.kind === 'dr') {
        return {...electorate, dr_denom: on ? source.id : ''};
    }
    const without = electorate.sr_ids.filter(id => id !== source.id);
    return {...electorate, sr_ids: on ? [...without, source.id] : without};
}

/**
 * The first problem of a picked electorate, as a sentence: unknown sources, too many staking
 * rewards, tokens that differ (also from the host's), a lock below the chain's minimum.
 * No source at all is fine here (an external admin can set it up later).
 */
export const validateDaoSources = (input: {
    sources: DaoStakeSource[];
    electorate: DaoStakeElectorate;
    params: Pick<DaoParams, 'max_sr_per_dao' | 'min_electorate_lock_days'>;
    lockedDenom?: string;
    tickerOf: TickerOf;
}): string | undefined => {
    const {sources, electorate, params, lockedDenom, tickerOf} = input;
    const maxSr = Number(params.max_sr_per_dao);
    if (electorate.sr_ids.length > maxSr) {
        return `A DAO can vote with at most ${maxSr} Simple rewards (you picked ${electorate.sr_ids.length}).`;
    }

    const {found, missing} = selectedSources(electorate, sources);
    if (missing.length > 0) return `${missing[0]} was not found. Pick the voters again.`;

    let denom = lockedDenom;
    for (const s of found) {
        if (denom === undefined) denom = s.stakingDenom;
        if (s.stakingDenom !== denom) {
            return `${sourceName(s)} stakes ${tickerOf(s.stakingDenom)}, not ${tickerOf(denom)}. All sources of a DAO must stake the same token.`;
        }
        if (s.lock < params.min_electorate_lock_days) {
            return `${sourceName(s)} has a ${s.lock}-day lock, at least ${params.min_electorate_lock_days} days are required.`;
        }
    }
    return undefined;
}

export interface DaoElectorateSummary {
    stakingDenom?: string;
    count: number;
    /** What the picked sources hold, base units. */
    staked: BigNumber;
    /** Something is staked, so somebody can vote. */
    live: boolean;
}

export const summarizeDaoElectorate = (
    electorate: DaoStakeElectorate,
    sources: DaoStakeSource[],
    lockedDenom?: string,
): DaoElectorateSummary => {
    const {found} = selectedSources(electorate, sources);
    const staked = found.reduce((sum, s) => sum.plus(s.staked || 0), new BigNumber(0));
    return {stakingDenom: electorateStakingDenom(electorate, sources, lockedDenom), count: found.length, staked, live: staked.isGreaterThan(0)};
}
