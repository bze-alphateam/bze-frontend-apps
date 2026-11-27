import BigNumber from 'bignumber.js'
import type { DaoParams, DaoStakeElectorate, DenomReward } from '@bze/bze-ui-kit'

// A stake DAO of a factory token (BFE-388): voted by the stakers of the token's rewards. The pure
// part: which of the token's rewards can be the electorate under the chain's rules (x/dao
// `validateStakeSources`), and the words and links around it.

export const DAO_NEW_PATH = '/dao/new'

/** The staking reward fields the picker reads (the chain's StakingReward, bigint-free). */
export interface StakingRewardLike {
    reward_id: string | bigint | number;
    staking_denom: string;
    lock: number | bigint | string;
    staked_amount: string;
}

/** The two DAO params the electorate depends on. */
export type TokenDaoParams = Pick<DaoParams, 'max_sr_per_dao' | 'min_electorate_lock_days'>

export interface ElectorateSource {
    kind: 'simple' | 'compounded';
    /** `sr_ids` entry for a simple reward; the staking denom for the compounded one. */
    id: string;
    label: string;
    lock: number;
    staked: BigNumber;
}

export interface IneligibleSource {
    label: string;
    reason: string;
}

export interface TokenElectorate {
    /** What goes into the preset. */
    electorate: DaoStakeElectorate;
    /** The chosen sources, compounded reward first. */
    sources: ElectorateSource[];
    /** Rewards of the token that cannot join, with the reason. */
    ineligible: IneligibleSource[];
    /** Eligible simple rewards left out because more than `max_sr_per_dao` qualify. */
    leftOut: number;
    /** At least one source and something staked in them. */
    live: boolean;
    hasSources: boolean;
    totalStaked: BigNumber;
    maxSr: number;
    minLock: number;
}

const simpleLabel = (id: string) => `Simple reward #${id}`
export const COMPOUNDED_LABEL = 'Compounded reward'

const lockReason = (lock: number, min: number) => `lock ${lock} day${lock === 1 ? '' : 's'}, needs ${min}`

/**
 * The electorate of a token's stake DAO, from all staking rewards, the token's compounded reward and the
 * DAO params. Eligible: stakes exactly this token and has an unstaking lock of at least
 * `min_electorate_lock_days`. When more than `max_sr_per_dao` simple rewards qualify the ones with
 * the most stake win. LP-share rewards stake another denom, so they never match.
 */
export function pickTokenElectorate(input: {
    denom: string;
    rewards: ReadonlyArray<StakingRewardLike>;
    denomReward?: Pick<DenomReward, 'staking_denom' | 'lock' | 'staked_amount'>;
    params: TokenDaoParams;
}): TokenElectorate {
    const { denom, rewards, denomReward, params } = input
    const minLock = Number(params.min_electorate_lock_days)
    const maxSr = Number(params.max_sr_per_dao)

    const ineligible: IneligibleSource[] = []
    const qualifying: ElectorateSource[] = []
    for (const r of rewards) {
        if (r.staking_denom !== denom) continue
        const id = String(r.reward_id)
        const lock = Number(r.lock)
        if (lock < minLock) {
            ineligible.push({ label: simpleLabel(id), reason: lockReason(lock, minLock) })
            continue
        }
        qualifying.push({ kind: 'simple', id, label: simpleLabel(id), lock, staked: new BigNumber(r.staked_amount || 0) })
    }
    // Most stake first; the id decides a tie so the pick is stable.
    qualifying.sort((a, b) => b.staked.comparedTo(a.staked) || Number(BigInt(a.id) - BigInt(b.id)))
    const simple = qualifying.slice(0, maxSr)
    const leftOut = qualifying.length - simple.length

    const sources: ElectorateSource[] = []
    if (denomReward && denomReward.staking_denom === denom) {
        const lock = Number(denomReward.lock)
        if (lock < minLock) {
            ineligible.push({ label: COMPOUNDED_LABEL, reason: lockReason(lock, minLock) })
        } else {
            sources.push({ kind: 'compounded', id: denom, label: COMPOUNDED_LABEL, lock, staked: new BigNumber(denomReward.staked_amount || 0) })
        }
    }
    sources.push(...simple)

    const totalStaked = sources.reduce((sum, s) => sum.plus(s.staked), new BigNumber(0))
    return {
        electorate: {
            sr_ids: simple.map(s => s.id),
            dr_denom: sources.some(s => s.kind === 'compounded') ? denom : '',
        },
        sources,
        ineligible,
        leftOut,
        live: totalStaked.gt(0),
        hasSources: sources.length > 0,
        totalStaked,
        maxSr,
        minLock,
    }
}

/** `/dao/new` with the token picked; `back` is the way back to where the user came from. */
export function tokenDaoHref(denom?: string, back?: { href: string; label: string }): string {
    const q = new URLSearchParams()
    if (denom) q.set('denom', denom)
    if (back) {
        q.set('return', back.href)
        q.set('returnLabel', back.label)
    }
    const s = q.toString()
    return s ? `${DAO_NEW_PATH}?${s}` : DAO_NEW_PATH
}

/** "Voted by the stakers of: Compounded reward, Simple reward #12". */
export const votersLine = (e: Pick<TokenElectorate, 'sources'>) =>
    `Voted by the stakers of: ${e.sources.map(s => s.label).join(', ')}`

/** The rule when simple rewards were dropped for the cap. */
export const leftOutLine = (e: Pick<TokenElectorate, 'leftOut' | 'maxSr'>) =>
    e.leftOut > 0 ? `Only the ${e.maxSr} simple rewards with the most stake count.` : ''

export const nobodyStakesLine = (ticker: string) => `Nobody stakes ${ticker} yet. The DAO needs an admin until someone does.`

/** Why a token can't be picked: "No reward with a 5+ day lock". */
export const noEligibleText = (minLock: number) => `No reward with a ${minLock}+ day lock`

/** The Token step's row state (staked amount is formatted by the caller). */
export function tokenRowState(e: Pick<TokenElectorate, 'hasSources' | 'live' | 'minLock'>, stakedText: string) {
    if (!e.hasSources) return { text: noEligibleText(e.minLock), tone: 'warn' as const, disabled: true }
    if (!e.live) return { text: 'Nobody stakes it yet', tone: 'warn' as const }
    return { text: stakedText, tone: 'good' as const }
}
