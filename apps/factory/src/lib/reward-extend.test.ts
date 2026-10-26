import { describe, it, expect } from "vitest";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import {
    daysLeft,
    daysLeftText,
    endDate,
    extendCost,
    extendHref,
    extendMsgValue,
    extendRoom,
    isFinished,
    newEndDate,
    searchRunningRewards,
    validateExtraDays,
} from "./reward-extend";
import { formatDate as formatDay } from "./format";

const reward = (over: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType => ({
    reward_id: "1",
    prize_amount: "100000000",
    prize_denom: "uhoney",
    staking_denom: "ulp_honey_bze",
    duration: 30,
    payouts: 24,
    min_stake: 0n,
    lock: 0,
    staked_amount: "0",
    distributed_stake: "0",
    ...over,
});

// A fixed "today": 20 Oct 2026, noon.
const NOW = new Date(2026, 9, 20, 12);

describe("days left and end dates", () => {
    it("counts the days still to pay and ends today + those days", () => {
        const r = reward();
        expect(daysLeft(r)).toBe(6);
        expect(isFinished(r)).toBe(false);
        expect(formatDay(endDate(r, NOW), NOW)).toBe("26 Oct");
        expect(daysLeftText(r, NOW)).toBe("6 of 30 · ends 26 Oct");
    });

    it("moves the end by the extra days", () => {
        expect(formatDay(newEndDate(reward(), 10, NOW), NOW)).toBe("5 Nov");
    });

    it("restarts a finished reward from today", () => {
        const r = reward({ payouts: 30 });
        expect(daysLeft(r)).toBe(0);
        expect(isFinished(r)).toBe(true);
        expect(daysLeftText(r, NOW)).toBe("Finished · all 30 paid");
        expect(formatDay(newEndDate(r, 10, NOW), NOW)).toBe("30 Oct");
    });

    it("never counts below zero", () => {
        expect(daysLeft(reward({ payouts: 40 }))).toBe(0);
    });

    it("adds the year when the end is in another year", () => {
        expect(formatDay(newEndDate(reward(), 80, NOW), NOW)).toBe("14 Jan 2027");
    });
});

describe("the 36,500-day cap", () => {
    it("leaves room for the days not yet booked", () => {
        expect(extendRoom(reward())).toBe(36470);
        expect(extendRoom(reward({ duration: 36500 }))).toBe(0);
    });

    it.each([
        ["", "Required."],
        ["0", "Enter a whole number of days."],
        ["1.5", "Enter a whole number of days."],
        ["-3", "Enter a whole number of days."],
        ["10", ""],
        ["36470", ""],
        ["36471", "Max 36470 days."],
    ])("%j extra days → %j", (value, error) => {
        expect(validateExtraDays(value, reward())).toBe(error);
    });

    it("refuses any day on a reward already at the cap", () => {
        expect(validateExtraDays("1", reward({ duration: 36500 }))).toBe("Max 36500 days reached.");
    });
});

describe("cost and message", () => {
    it("costs the fixed daily prize × the extra days", () => {
        expect(extendCost(reward(), "10").toFixed()).toBe("1000000000");
    });

    it("sends the days added, not the new total", () => {
        expect(extendMsgValue({ creator: "bze1me", rewardId: "7", days: " 10 " })).toEqual({ creator: "bze1me", rewardId: "7", duration: "10" });
    });

    it("links to the wizard for one reward, or to its list", () => {
        expect(extendHref("0000000000000007")).toBe("/reward/extend?id=0000000000000007");
        expect(extendHref()).toBe("/reward/extend");
    });
});

describe("searchRunningRewards", () => {
    const tickers: Record<string, string> = { ulp_honey_bze: "HONEY/BZE LP", uhoney: "HONEY", ubze: "BZE", uvdl: "VDL" };
    const ticker = (d: string) => tickers[d] ?? d;
    const list = [
        reward({ reward_id: "1" }),
        reward({ reward_id: "2", staking_denom: "uvdl", prize_denom: "ubze" }),
        reward({ reward_id: "3", payouts: 30 }),
    ];
    const ids = (q: string) => searchRunningRewards(list, q, ticker).map(r => r.reward_id);

    it("lists only the running rewards", () => {
        expect(ids("")).toEqual(["1", "2"]);
    });

    it("finds rewards by staked token, case-insensitively, or by the prize", () => {
        expect(ids("honey/")).toEqual(["1"]);
        expect(ids("vdl")).toEqual(["2"]);
        expect(ids("bze")).toEqual(["1", "2"]);
        expect(ids("nothing")).toEqual([]);
    });
});
