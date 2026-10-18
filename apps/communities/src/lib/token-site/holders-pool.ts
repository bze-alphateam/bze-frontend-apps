import BigNumber from "bignumber.js";
import type {DenomRewardSchedule} from "@bze/bze-ui-kit";

/** One reward the holders pool pays: a prize denom with its running schedules summed up. */
export interface HoldersPoolPrize {
    denom: string;
    /** Paid per day across its running schedules (base units, or display units once converted). */
    daily: BigNumber;
    /** Days the longest running schedule still has to pay. */
    fundedForDays: number;
}

/**
 * The rewards of a holders pool from its schedules (Business Logic R5): finished schedules
 * (`payouts >= duration`) are left out; the rest are grouped per prize denom, with the daily
 * amounts summed and the longest remaining run as "funded for".
 */
export function holdersPoolPrizes(schedules: DenomRewardSchedule[]): HoldersPoolPrize[] {
    const prizes = new Map<string, HoldersPoolPrize>();
    for (const schedule of schedules) {
        if (schedule.payouts >= schedule.duration) continue;

        const left = schedule.duration - schedule.payouts;
        const daily = new BigNumber(schedule.daily_amount);
        const prize = prizes.get(schedule.prize_denom);
        prizes.set(schedule.prize_denom, prize
            ? {denom: prize.denom, daily: prize.daily.plus(daily), fundedForDays: Math.max(prize.fundedForDays, left)}
            : {denom: schedule.prize_denom, daily, fundedForDays: left});
    }

    return [...prizes.values()];
}

/** USD per display unit of a denom; missing or not above 0 means "no price". */
export type UsdPrices = ReadonlyMap<string, BigNumber>;

const priceOf = (prices: UsdPrices, denom: string): BigNumber | undefined => {
    const price = prices.get(denom);

    return price && price.gt(0) ? price : undefined;
};

/** What a prize pays per day in USD (`daily` in display units), or undefined without a price. */
export function prizeDailyUsd(prize: HoldersPoolPrize, prices: UsdPrices): BigNumber | undefined {
    return priceOf(prices, prize.denom)?.multipliedBy(prize.daily);
}

/** Prizes by USD paid per day, biggest first; the unpriced ones last, in their original order. */
export function sortPrizesByUsd(prizes: HoldersPoolPrize[], prices: UsdPrices): HoldersPoolPrize[] {
    return prizes
        .map((prize, index) => ({prize, index, usd: prizeDailyUsd(prize, prices)}))
        .sort((a, b) => {
            if (a.usd && b.usd) return b.usd.comparedTo(a.usd) ?? 0;
            if (a.usd || b.usd) return a.usd ? -1 : 1;
            return a.index - b.index;
        })
        .map(({prize}) => prize);
}

/**
 * Estimated APR of the holders pool in percent: Σ(daily × prize price) × 365 ÷ (staked × T price)
 * × 100, with `daily` and `staked` in display units. Undefined when it can't be told honestly: a
 * prize or T has no price, nothing is staked, or nothing is paid.
 */
export function holdersPoolApr(
    prizes: HoldersPoolPrize[],
    stakedAmount: BigNumber,
    prices: UsdPrices,
    tokenPrice: BigNumber | undefined,
): BigNumber | undefined {
    if (prizes.length === 0 || !stakedAmount.gt(0) || !tokenPrice?.gt(0)) return undefined;

    let dailyUsd = new BigNumber(0);
    for (const prize of prizes) {
        const usd = prizeDailyUsd(prize, prices);
        if (!usd) return undefined;
        dailyUsd = dailyUsd.plus(usd);
    }

    return dailyUsd.multipliedBy(365).dividedBy(stakedAmount.multipliedBy(tokenPrice)).multipliedBy(100);
}

/** "34.6%", with thousands separators for the huge APRs of a nearly empty pool. */
export function formatApr(apr: BigNumber): string {
    return `${apr.toFormat(1)}%`;
}

/** The viewer's share of the pool in percent, or undefined when the pool is empty. */
export function poolShare(stake: BigNumber.Value, totalStaked: BigNumber.Value): BigNumber | undefined {
    const total = new BigNumber(totalStaked);
    if (!total.gt(0)) return undefined;

    return new BigNumber(stake).dividedBy(total).multipliedBy(100);
}

/** "0.027%", "<0.001%" for a dust share. */
export function formatShare(share: BigNumber): string {
    if (share.gt(0) && share.lt(0.001)) return "<0.001%";

    return `${share.decimalPlaces(3, BigNumber.ROUND_DOWN).toFormat()}%`;
}

/** "45 days" / "1 day". */
export function formatDays(days: number): string {
    return `${days} day${days === 1 ? "" : "s"}`;
}
