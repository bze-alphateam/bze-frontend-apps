import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {type DenomReward, type DenomRewardSchedule, uAmountToBigNumberAmount} from "@bze/bze-ui-kit";

import {isProgramFinished, programApr, programDaysLeft} from "./fixed-term";
import {holdersPoolApr, holdersPoolPrizes, type UsdPrices} from "./holders-pool";

/** Another token's holders pool with its running schedules. */
export interface PoolWithSchedules {
    denomReward: DenomReward;
    schedules: DenomRewardSchedule[];
}

/** One place that pays T for staking another token (Business Logic R7). */
export interface EarnOpportunity {
    kind: "program" | "pool";
    /** Unique per page: the program id, or the pool's staking denom. */
    key: string;
    /** The token staked there, never T. */
    stakingDenom: string;
    /** The program staked into; only for a program. */
    rewardId?: string;
    /** T paid out per day, display units. */
    daily: BigNumber;
    /** APR in percent; undefined when it can't be told honestly (R5/R6 missing-price rule). */
    apr?: BigNumber;
    /** Unlock time in days. */
    lock: number;
    /** Program: days until it ends. Pool: days the longest schedule paying T is funded for. */
    daysLeft: number;
    /** A pool's other running prizes, by denom; empty for a program. */
    otherPrizes: string[];
}

/** Decimals of a denom, as `useAssets().denomDecimals` tells them. */
export type Decimals = (denom: string) => number;

function programOpportunity(program: StakingRewardSDKType, prices: UsdPrices, decimals: Decimals): EarnOpportunity {
    const prizeDecimals = decimals(program.prize_denom);

    return {
        kind: "program",
        key: `program-${program.reward_id}`,
        stakingDenom: program.staking_denom,
        rewardId: program.reward_id,
        daily: uAmountToBigNumberAmount(program.prize_amount, prizeDecimals),
        apr: programApr({
            program,
            stakingDecimals: decimals(program.staking_denom),
            prizeDecimals,
            stakingPrice: prices.get(program.staking_denom),
            prizePrice: prices.get(program.prize_denom),
        }),
        lock: program.lock,
        daysLeft: programDaysLeft(program),
        otherPrizes: [],
    };
}

function poolOpportunity(denom: string, {denomReward, schedules}: PoolWithSchedules, prices: UsdPrices, decimals: Decimals): EarnOpportunity | undefined {
    const prizes = holdersPoolPrizes(schedules).map((prize) => ({...prize, daily: uAmountToBigNumberAmount(prize.daily, decimals(prize.denom))}));
    const paysT = prizes.find((prize) => prize.denom === denom);
    if (!paysT) return undefined;

    const stakingDenom = denomReward.staking_denom;
    const staked = uAmountToBigNumberAmount(denomReward.staked_amount, decimals(stakingDenom));

    return {
        kind: "pool",
        key: `pool-${stakingDenom}`,
        stakingDenom,
        daily: paysT.daily,
        // Over the pool's whole prize set: what a staker there actually earns.
        apr: holdersPoolApr(prizes, staked, prices, prices.get(stakingDenom)),
        lock: denomReward.lock,
        daysLeft: paysT.fundedForDays,
        otherPrizes: prizes.filter((prize) => prize.denom !== denom).map((prize) => prize.denom),
    };
}

/**
 * Everywhere staking another token pays T (Business Logic R7): the running fixed-term programs
 * whose prize is T, and the other tokens' holders pools with a running schedule paying T. Staking
 * T itself belongs to the Stake section and is left out. Best APR first (no APR last), then most
 * T paid per day.
 */
export function earnOpportunities(
    denom: string,
    programs: StakingRewardSDKType[],
    pools: PoolWithSchedules[],
    prices: UsdPrices,
    decimals: Decimals,
): EarnOpportunity[] {
    const list: EarnOpportunity[] = [];
    for (const program of programs) {
        if (program.prize_denom !== denom || program.staking_denom === denom || isProgramFinished(program)) continue;
        list.push(programOpportunity(program, prices, decimals));
    }
    for (const pool of pools) {
        if (pool.denomReward.staking_denom === denom) continue;
        const opportunity = poolOpportunity(denom, pool, prices, decimals);
        if (opportunity) list.push(opportunity);
    }

    return list.sort((a, b) => {
        if (a.apr && b.apr && !a.apr.eq(b.apr)) return b.apr.comparedTo(a.apr) ?? 0;
        if (Boolean(a.apr) !== Boolean(b.apr)) return a.apr ? -1 : 1;
        return b.daily.comparedTo(a.daily) ?? 0;
    });
}

/** "X", "X and Y", "X, Y and Z". */
export function joinTickers(tickers: string[]): string {
    if (tickers.length <= 1) return tickers.join("");

    return `${tickers.slice(0, -1).join(", ")} and ${tickers[tickers.length - 1]}`;
}
