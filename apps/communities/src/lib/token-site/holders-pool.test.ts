import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {DenomRewardSchedule} from "@bze/bze-ui-kit";

import {
    formatApr,
    formatShare,
    holdersPoolApr,
    holdersPoolPrizes,
    type HoldersPoolPrize,
    poolShare,
    sortPrizesByUsd,
} from "./holders-pool";

const T = "factory/bze1owner/upage";

const schedule = (prize: string, daily: string, duration: number, payouts: number): DenomRewardSchedule => ({
    schedule_id: `${prize}-${duration}-${payouts}`, staking_denom: T, prize_denom: prize, daily_amount: daily, duration, payouts,
});

const prize = (denom: string, daily: string, fundedForDays = 10): HoldersPoolPrize => ({denom, daily: new BigNumber(daily), fundedForDays});

describe("holdersPoolPrizes", () => {
    it("groups the running schedules per reward, summing daily and keeping the longest run", () => {
        const prizes = holdersPoolPrizes([
            schedule("ubze", "1000", 30, 10),
            schedule("ubze", "500", 100, 55),
            schedule(T, "200", 7, 0),
        ]);

        expect(prizes).toEqual([
            {denom: "ubze", daily: new BigNumber(1500), fundedForDays: 45},
            {denom: T, daily: new BigNumber(200), fundedForDays: 7},
        ]);
    });

    it("leaves finished schedules out", () => {
        const prizes = holdersPoolPrizes([schedule("ubze", "1000", 30, 30), schedule("uusdc", "5", 10, 12), schedule("uusdc", "7", 10, 9)]);

        expect(prizes).toEqual([{denom: "uusdc", daily: new BigNumber(7), fundedForDays: 1}]);
    });
});

describe("sortPrizesByUsd", () => {
    it("puts the most paid in USD first and the unpriced last", () => {
        const prices = new Map([["ubze", new BigNumber("0.001")], ["uusdc", new BigNumber(1)], ["uzero", new BigNumber(0)]]);
        const sorted = sortPrizesByUsd([prize("uvdl", "9"), prize("ubze", "1000"), prize("uzero", "5"), prize("uusdc", "2")], prices);

        expect(sorted.map((p) => p.denom)).toEqual(["uusdc", "ubze", "uvdl", "uzero"]);
    });
});

describe("holdersPoolApr", () => {
    const prices = new Map([["ubze", new BigNumber("0.002")], ["uusdc", new BigNumber(1)], [T, new BigNumber("0.5")]]);

    it("is the yearly USD paid over the USD staked", () => {
        // (1000 × 0.002 + 3 × 1) × 365 ÷ (10,000 × 0.5) × 100 = 36.5
        const apr = holdersPoolApr([prize("ubze", "1000"), prize("uusdc", "3")], new BigNumber(10_000), prices, prices.get(T));

        expect(apr?.toFixed()).toBe("36.5");
        expect(formatApr(apr!)).toBe("36.5%");
    });

    it("is unknown when a reward or the token has no price", () => {
        expect(holdersPoolApr([prize("ubze", "1000"), prize("uvdl", "3")], new BigNumber(10_000), prices, prices.get(T))).toBeUndefined();
        expect(holdersPoolApr([prize("ubze", "1000")], new BigNumber(10_000), prices, undefined)).toBeUndefined();
        expect(holdersPoolApr([prize("ubze", "1000")], new BigNumber(10_000), prices, new BigNumber(0))).toBeUndefined();
    });

    it("is unknown when nothing is staked or nothing is paid", () => {
        expect(holdersPoolApr([prize("ubze", "1000")], new BigNumber(0), prices, prices.get(T))).toBeUndefined();
        expect(holdersPoolApr([], new BigNumber(10_000), prices, prices.get(T))).toBeUndefined();
    });

    it("keeps thousands separators for a nearly empty pool", () => {
        expect(formatApr(new BigNumber("18250"))).toBe("18,250.0%");
    });
});

describe("poolShare", () => {
    it("is the stake over the total, in percent", () => {
        expect(formatShare(poolShare(5000, 18_450_000)!)).toBe("0.027%");
        expect(formatShare(poolShare(1, 10_000_000)!)).toBe("<0.001%");
        expect(formatShare(poolShare(5, 20)!)).toBe("25%");
        expect(poolShare(5, 0)).toBeUndefined();
    });
});
