import { describe, expect, it } from "vitest";
import BigNumber from "bignumber.js";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import type { AddressRewardsStaking, DenomRewardHolderItem } from "@bze/bze-ui-kit";
import { estimateRewardIncome } from "./reward-estimate";
import { buildStakingRows, type StakingLookups } from "./staking-list";

const PRICES: Record<string, number> = { ubze: 0.05, uvdl: 0.01 };
const usd = (d: string, u: BigNumber.Value) => new BigNumber(u).shiftedBy(-6).multipliedBy(PRICES[d] ?? 0);
const lookups: StakingLookups = { ticker: (d) => d, verified: () => true, isLp: () => false, usdValue: usd };
const units = (n: number) => new BigNumber(n).shiftedBy(6);

function simple(over: Partial<StakingRewardSDKType> = {}, addressData?: AddressRewardsStaking) {
    const reward = {
        reward_id: "1", prize_amount: "100000000", prize_denom: "ubze", duration: 100, payouts: 10, lock: 7,
        staked_amount: "900000000", distributed_stake: "0", staking_denom: "ubze", min_stake: "0", ...over,
    } as StakingRewardSDKType;
    return buildStakingRows({ nativeDenom: "ubze", simple: [reward], addressData, compounded: [] }, lookups)[0];
}

function compounded(daily: { denom: string; amount: string }[] | undefined) {
    const item = { denomReward: { staking_denom: "ubze", staked_amount: "900000000", lock: 0, min_stake: "0" }, dailyPrizes: daily, unlocks: [] } as unknown as DenomRewardHolderItem;
    return buildStakingRows({ nativeDenom: "ubze", simple: [], compounded: [item] }, lookups)[0];
}

describe("estimateRewardIncome", () => {
    it("gives a new stake its share of the daily prize, after the pool grows by it", () => {
        // 100 BZE a day; 100 BZE added to 900 staked = 10 %
        const est = estimateRewardIncome(simple(), units(100), usd)!;
        expect(est.tokens).toEqual([{ denom: "ubze", amount: "10000000", usd: new BigNumber(0.5) }]);
        expect(est.shareAfterPct).toBe(10);
        expect(est.usdPerDay.toNumber()).toBe(0.5);
        expect(est.usdPer30Days.toNumber()).toBe(15);
    });

    it("stops a simple reward's figures at the days it has left", () => {
        const est = estimateRewardIncome(simple({ payouts: 80 }), units(100), usd)!;
        expect(est.daysLeft).toBe(20);
        expect(est.usdPer30Days.toNumber()).toBe(10);
        expect(est.usdPerYear.toNumber()).toBe(10);
        expect(estimateRewardIncome(compounded([{ denom: "ubze", amount: "1" }]), units(1), usd)!.daysLeft).toBeUndefined();
    });

    it("counts only what an addition earns on top of the current stake", () => {
        const addressData = {
            address: "bze1",
            active: new Map([["1", { address: "bze1", reward_id: "1", amount: "450000000", joined_at: "0" }]]),
            unlocking: new Map(),
        } as unknown as AddressRewardsStaking;
        // 450 of 900 earns 50 BZE now; with +100 it is 550 of 1,000 = 55 BZE, so +5 BZE
        const est = estimateRewardIncome(simple({}, addressData), units(100), usd)!;
        expect(est.tokens[0].amount).toBe("5000000");
        expect(est.shareAfterPct).toBe(55);
        expect(est.totalUsdPerDay.toNumber()).toBe(2.75);
    });

    it("lists priced prizes by value first and leaves unpriced ones out of the USD figures", () => {
        const est = estimateRewardIncome(compounded([
            { denom: "uatom", amount: "1000000000" },
            { denom: "ubze", amount: "1000000000" },
            { denom: "uvdl", amount: "1000000000" },
        ]), units(100), usd)!;
        expect(est.tokens.map((t) => t.denom)).toEqual(["ubze", "uvdl", "uatom"]);
        expect(est.unpriced).toBe(1);
        // 100 BZE + 100 VDL a day = $5 + $1
        expect(est.usdPerDay.toNumber()).toBe(6);
    });

    it("has nothing to estimate without an amount, after the end, or with no daily prizes", () => {
        expect(estimateRewardIncome(simple(), 0, usd)).toBeUndefined();
        expect(estimateRewardIncome(simple({ payouts: 100 }), units(1), usd)).toBeUndefined();
        expect(estimateRewardIncome(compounded([]), units(1), usd)).toBeUndefined();
        expect(estimateRewardIncome(compounded(undefined), units(1), usd)).toBeUndefined();
    });
});
