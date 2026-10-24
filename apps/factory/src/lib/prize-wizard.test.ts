import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import {
    type PrizeDoneInput,
    newPrizeNote,
    nothingStakedReason,
    prizeDoneText,
    prizeDoneTitle,
    scheduleExtendFacts,
    stakedRowState,
    stakedTokenOk,
} from "./prize-wizard";

const pretty = (n: BigNumber) => n.toFormat();
// Thursday 21 Oct 2026, noon.
const NOW = new Date(2026, 9, 21, 12);

describe("stakedRowState", () => {
    it("says what is staked, in green, for both flows", () => {
        expect(stakedRowState(new BigNumber(1250), "dailyPrize", pretty)).toEqual({ text: "1,250 staked", tone: "good" });
        expect(stakedRowState(new BigNumber(1250), "airdrop", pretty)).toEqual({ text: "1,250 staked", tone: "good" });
    });

    it("a daily prize can go to a reward nobody stakes yet (days without stakers are skipped)", () => {
        expect(stakedRowState(new BigNumber(0), "dailyPrize", pretty)).toEqual({ text: "Nothing staked yet", tone: "muted" });
    });

    it("an airdrop can't: the row is amber and disabled", () => {
        expect(stakedRowState(new BigNumber(0), "airdrop", pretty)).toEqual({ text: "Nothing staked · airdrop waits", tone: "warn", disabled: true });
    });

    it("says nothing without a compounded reward", () => {
        expect(stakedRowState(undefined, "airdrop", pretty)).toBeUndefined();
    });
});

describe("stakedTokenOk", () => {
    const read = (staked?: string, extra: Partial<{ isLoading: boolean; hasError: boolean }> = {}) => ({
        denomReward: staked === undefined ? undefined : { staked_amount: staked },
        isLoading: false,
        hasError: false,
        ...extra,
    });

    it("needs a loaded compounded reward", () => {
        expect(stakedTokenOk("dailyPrize", read("0"))).toBe(true);
        expect(stakedTokenOk("dailyPrize", read(undefined))).toBe(false);
        expect(stakedTokenOk("dailyPrize", read("5", { isLoading: true }))).toBe(false);
        // A load error is never "no reward" and never "ok".
        expect(stakedTokenOk("dailyPrize", read("5", { hasError: true }))).toBe(false);
    });

    it("an airdrop also needs something staked (the chain refuses with 5018)", () => {
        expect(stakedTokenOk("airdrop", read("1"))).toBe(true);
        expect(stakedTokenOk("airdrop", read("0"))).toBe(false);
    });
});

describe("nothingStakedReason", () => {
    it("names the token", () => {
        expect(nothingStakedReason("HONEY")).toMatch(/^Nobody is staking HONEY yet/);
    });
});

describe("newPrizeNote", () => {
    const slot = (used: number, isNewPrize = true, capReached = false) => ({ used, isNewPrize, capReached });

    it("a new prize: the fee and the slots left", () => {
        expect(newPrizeNote("BZE", "25,000 TBZE", slot(1), 5)).toBe("BZE is a new prize token here: +25,000 TBZE, uses 1 of the remaining 4 prize slots.");
    });

    it("without a known cap or fee", () => {
        expect(newPrizeNote("BZE", "", slot(1), undefined)).toBe("BZE is a new prize token here: the new prize fee applies, uses 1 prize slot for good.");
    });

    it("nothing for a prize the reward already pays, or once the cap is reached", () => {
        expect(newPrizeNote("BZE", "25,000 TBZE", slot(1, false), 5)).toBe("");
        expect(newPrizeNote("BZE", "25,000 TBZE", slot(5, true, true), 5)).toBe("");
    });
});

describe("scheduleExtendFacts", () => {
    const schedule = { daily_amount: "50000000", duration: 200, payouts: 2 };

    it("days left and the end, before any extra days", () => {
        const facts = scheduleExtendFacts(schedule, "", NOW);
        expect(facts.daysLeft).toBe(198);
        expect(facts.room).toBe(36300);
        expect(facts.error).toBe("Required.");
        expect(facts.extra).toBeUndefined();
        expect(facts.escrow).toBeUndefined();
        expect(facts.end).toBe("7 May 2027");
    });

    it("escrows daily × the extra days and moves the end", () => {
        const facts = scheduleExtendFacts({ ...schedule, duration: 10, payouts: 4 }, " 30 ", NOW);
        expect(facts.error).toBe("");
        expect(facts.extra).toBe(30);
        expect(facts.escrow?.toFixed()).toBe("1500000000");
        expect(facts.end).toBe("27 Oct");
        expect(facts.newEnd).toBe("26 Nov");
    });

    it("the total can't pass 36,500 days", () => {
        const facts = scheduleExtendFacts({ ...schedule, duration: 36490 }, "11", NOW);
        expect(facts.room).toBe(10);
        expect(facts.error).toMatch(/^Add between 1 and 10 days/);
        expect(facts.escrow).toBeUndefined();
        expect(scheduleExtendFacts({ ...schedule, duration: 36490 }, "10", NOW).error).toBe("");
    });

    it("a schedule at the cap takes no more", () => {
        const facts = scheduleExtendFacts({ ...schedule, duration: 36500 }, "1", NOW);
        expect(facts.room).toBe(0);
        expect(facts.error).toBe("This schedule already runs the maximum of 36,500 days.");
    });
});

describe("Done copy", () => {
    const base = { stakedDenom: "uhoney", stakedTicker: "HONEY", prizeDenom: "ubze", prizeTicker: "BZE" };
    const add: PrizeDoneInput = { ...base, kind: "add", perDay: "50", dailyAmount: "50000000", days: 30 };
    const extend: PrizeDoneInput = { ...base, kind: "extend", perDay: "50", days: 1, scheduleId: "7", newEnd: "5 Nov" };
    const airdrop: PrizeDoneInput = { ...base, prizeTicker: "BEE", kind: "airdrop", amount: "10,000" };

    it("the titles", () => {
        expect(prizeDoneTitle(add)).toBe("**50 BZE a day** for HONEY stakers.");
        expect(prizeDoneTitle(extend)).toBe("**1 more day** for HONEY stakers.");
        expect(prizeDoneTitle({ ...extend, days: 30 })).toBe("**30 more days** for HONEY stakers.");
        expect(prizeDoneTitle(airdrop)).toBe("**10,000 BEE** sent to HONEY stakers.");
    });

    it("the lines and the announcement", () => {
        expect(prizeDoneText(add)).toBe("Everyone staking HONEY shares 50 BZE a day for 30 days.");
        expect(prizeDoneText(extend)).toBe("Everyone staking HONEY keeps sharing 50 BZE a day until about 5 Nov.");
        expect(prizeDoneText(airdrop)).toBe("Everyone staking HONEY got a share, split by stake. They can claim it right away.");
    });
});
