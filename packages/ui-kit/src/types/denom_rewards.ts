/**
 * Denom Rewards (chain v8.2.0, x/rewards) records as the REST gateway returns them.
 *
 * Written by hand instead of re-exporting bzejs' `…SDKType`s: the LCD client hands back the raw
 * JSON, where uint64 fields arrive as strings (bzejs types them as `bigint`) — uint32 fields
 * (`lock`, `duration`, `payouts`) are plain numbers.
 */

/** The (unique, chain-wide) staking pool of a denom. `lock` and `min_stake` are frozen at creation. */
export interface DenomReward {
    staking_denom: string;
    /** Days a stake stays locked after exiting. */
    lock: number;
    /** Minimum stake in the staking denom's base units (uint64 as string). */
    min_stake: string;
    /** Total staked, base units (Int as string). */
    staked_amount: string;
}

/** One prize accumulator per prize denom ever used on a DR — what `max_prize_denoms_per_dr` counts. */
export interface DenomRewardPrize {
    staking_denom: string;
    prize_denom: string;
    /** Cumulative prize per staked unit (LegacyDec as string). */
    distributed_stake: string;
    /** uint64 as string. */
    last_distribution_epoch: string;
}

/** A funded daily schedule. Deleted by the chain once it has paid its last day. */
export interface DenomRewardSchedule {
    schedule_id: string;
    staking_denom: string;
    prize_denom: string;
    /** Prize paid per day, base units (Int as string). */
    daily_amount: string;
    /** Total days funded (1…36500, also after extensions). */
    duration: number;
    /** Days actually paid — a day with no stakers is skipped and does not count. */
    payouts: number;
}

/** A staker's position in a DR. */
export interface DenomRewardParticipant {
    address: string;
    staking_denom: string;
    /** Staked amount, base units (Int as string). */
    amount: string;
}

/** A coin as the REST gateway returns it (Int amount as string). */
export interface DenomRewardCoin {
    denom: string;
    amount: string;
}

/** A position plus what a claim would pay right now — the chain's own read-only settlement. */
export interface DenomRewardPosition {
    participant: DenomRewardParticipant;
    /** One coin per prize denom, sub-unit dust excluded — exactly what a claim pays. */
    pending: DenomRewardCoin[];
}

/** A stake released by an exit, waiting in the shared pending-unlock store. */
export interface DenomRewardUnlock {
    staking_denom: string;
    /** Base units (Int as string). */
    amount: string;
    /** The hour epoch at which the chain pays it back. */
    unlockEpoch: number;
}
