import BigNumber from 'bignumber.js'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { isLpDenom, type DenomReward } from '@bze/bze-ui-kit'
import type { QueryReader } from '@/lib/create-routes'

// Airdrop coins (/airdrop): one wizard for every way of putting coins in many wallets at once.
// Step 1 picks who gets them: a list of wallets (bank multi-send), the stakers of a token, or the
// liquidity providers staking a pool's shares. Stakers are reached through the token's rewards: a
// compounded reward takes any prize token (MsgDistributeDenomRewards), a simple reward only its own
// prize token (MsgDistributeStakingRewards). Both are permissionless and need something staked.

export const AIRDROP_PATH = '/airdrop'

export const AIRDROP_TARGETS = ['list', 'stakers', 'lp'] as const
export type AirdropTarget = typeof AIRDROP_TARGETS[number]

const isTarget = (value: string | null): value is AirdropTarget =>
    value !== null && (AIRDROP_TARGETS as readonly string[]).includes(value)

export interface AirdropLink {
    /** Who gets it; left out, the wizard asks (or reads it from the token). */
    to?: AirdropTarget;
    /** The list's token, or the staked token. */
    denom?: string;
    /** A simple reward of the staked token. */
    id?: string;
    /** The coin to send to stakers. */
    prize?: string;
}

/** `/airdrop` with the non-empty parts of `link`. */
export function airdropHref(link: AirdropLink = {}): string {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(link)) {
        if (value) q.set(key, value)
    }
    const s = q.toString()
    return s ? `${AIRDROP_PATH}?${s}` : AIRDROP_PATH
}

/** The stakers of a token: LP providers when it is a pool share. */
export const stakersTarget = (denom: string): AirdropTarget => (isLpDenom(denom) ? 'lp' : 'stakers')

/** An airdrop to the stakers of `denom`, through one of its simple rewards when `id` is given. */
export const stakersAirdropHref = (denom: string, id?: string) => airdropHref({ to: stakersTarget(denom), denom, id })

/**
 * What a link preselects. The old routes redirect here with their own names: `?staking=` (simple
 * reward forms) and `?community=` (Reach) for the staked token, `?gift=` (Reach) for the prize.
 * Without `?to=`, a token or a reward id means its stakers (LP providers for a pool share); the
 * list of wallets always says `?to=list`.
 */
export function readAirdropLink(query: QueryReader): Required<Pick<AirdropLink, 'denom' | 'id' | 'prize'>> & { to?: AirdropTarget } {
    const denom = query.get('denom') || query.get('staking') || query.get('community') || ''
    const id = query.get('id') || ''
    const prize = query.get('prize') || query.get('gift') || ''
    const to = query.get('to')
    if (isTarget(to)) return { to, denom, id, prize }
    if (denom || id) return { to: stakersTarget(denom), denom, id, prize }
    return { denom, id, prize }
}

/** One reward of a staked token that an airdrop can go through. */
export type StakersReward =
    | { key: 'compounded'; kind: 'compounded'; stakingDenom: string; staked: string }
    | {
        key: string;
        kind: 'simple';
        rewardId: string;
        stakingDenom: string;
        prizeDenom: string;
        staked: string;
        /** Days of payouts left (0 when finished; its stakers can still claim an airdrop). */
        daysLeft: number;
    }

export const simpleRewardKey = (rewardId: string) => `simple:${rewardId}`

export const hasStaked = (reward: Pick<StakersReward, 'staked'>) => new BigNumber(reward.staked || 0).gt(0)

/**
 * The rewards of `denom`: its compounded reward first, then its simple rewards, the most staked
 * first.
 */
export function rewardsOfToken(
    denom: string,
    denomReward: Pick<DenomReward, 'staked_amount'> | undefined,
    simple: ReadonlyArray<Pick<StakingRewardSDKType, 'reward_id' | 'staking_denom' | 'prize_denom' | 'staked_amount' | 'duration' | 'payouts'>>,
): StakersReward[] {
    const out: StakersReward[] = []
    if (denomReward) out.push({ key: 'compounded', kind: 'compounded', stakingDenom: denom, staked: denomReward.staked_amount || '0' })
    const mine = simple
        .filter(r => r.staking_denom === denom)
        .map((r): StakersReward => ({
            key: simpleRewardKey(r.reward_id),
            kind: 'simple',
            rewardId: r.reward_id,
            stakingDenom: r.staking_denom,
            prizeDenom: r.prize_denom,
            staked: r.staked_amount || '0',
            daysLeft: Math.max(0, r.duration - r.payouts),
        }))
        .sort((a, b) => new BigNumber(b.staked).comparedTo(a.staked) ?? 0)
    return [...out, ...mine]
}

/**
 * The reward picked without asking: the one a link names (`?id=`), else the only one with
 * stakers. Several, or none with stakers, leave the pick to the user.
 */
export function defaultReward(rewards: ReadonlyArray<StakersReward>, rewardId?: string): string | undefined {
    if (rewardId) {
        const linked = rewards.find(r => r.kind === 'simple' && r.rewardId === rewardId)
        if (linked) return linked.key
    }
    const usable = rewards.filter(hasStaked)
    return usable.length === 1 ? usable[0].key : undefined
}

/** The staked tokens of the simple rewards: they can take an airdrop without a compounded reward. */
export const simpleStakedDenoms = (simple: ReadonlyArray<Pick<StakingRewardSDKType, 'staking_denom'>>) =>
    new Set(simple.map(r => r.staking_denom))
