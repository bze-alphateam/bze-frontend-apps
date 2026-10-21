import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { prizeSlot, summarizeScheduleCosts } from "./denom-reward";
import {
    checkDailyPrize,
    compoundedCosts,
    compoundedRewardMsgs,
    compoundedTxKind,
    dailyPrizeSummary,
} from "./daily-prize";

const BZE = (amount: string) => ({ denom: "ubze", amount });
const NEW_SLOT = prizeSlot([], "ubze", 50);

const base = {
    prizeDenom: "ubze",
    prizeDecimals: 6,
    dailyInput: "50",
    daysInput: "30",
    slot: NEW_SLOT,
    feesKnown: true,
};

describe("checkDailyPrize", () => {
    it("a valid prize: the daily amount and the escrow in base units", () => {
        const c = checkDailyPrize(base);
        expect(c).toMatchObject({ dailyError: "", daysError: "", days: 30, blocker: "", short: false, valid: true });
        expect(c.dailyUAmount?.toFixed()).toBe("50000000");
        expect(c.escrow?.toFixed()).toBe("1500000000");
    });

    it("validates the amount and the days (1…36,500)", () => {
        expect(checkDailyPrize({ ...base, dailyInput: "" }).dailyError).toBe("Amount is required.");
        expect(checkDailyPrize({ ...base, dailyInput: "0.0000001" }).dailyError).toMatch(/decimal places/);
        expect(checkDailyPrize({ ...base, daysInput: "0" }).daysError).toMatch(/between 1 and 36,500/);
        expect(checkDailyPrize({ ...base, daysInput: "36501" }).valid).toBe(false);
        expect(checkDailyPrize({ ...base, daysInput: "1.5" }).daysError).toBe("Enter a whole number of days.");
    });

    it("is not valid before a prize token is picked", () => {
        expect(checkDailyPrize({ ...base, prizeDenom: "", prizeDecimals: undefined }).valid).toBe(false);
    });

    it("is blocked when the prize slots are full", () => {
        const c = checkDailyPrize({ ...base, slot: prizeSlot([], "ubze", 0) });
        expect(c.blocker).toMatch(/maximum number of prize tokens/);
        expect(c.valid).toBe(false);
    });

    it("is blocked when the new prize fee is unknown", () => {
        const c = checkDailyPrize({ ...base, feesKnown: false });
        expect(c.blocker).toMatch(/couldn't be read from the chain/);
        expect(c.valid).toBe(false);
    });

    it("checks the balance only with a wallet", () => {
        expect(checkDailyPrize({ ...base, prizeBalance: new BigNumber("1499999999") })).toMatchObject({ short: true, valid: false });
        expect(checkDailyPrize({ ...base, prizeBalance: new BigNumber("1500000000") })).toMatchObject({ short: false, valid: true });
        expect(checkDailyPrize(base).short).toBe(false);
    });
});

describe("dailyPrizeSummary", () => {
    it("reads as the announcement number", () => {
        expect(dailyPrizeSummary("50", "BZE", 30)).toBe("50 BZE a day for 30 days");
        expect(dailyPrizeSummary("1,000", "WAX", 1)).toBe("1,000 WAX a day for 1 day");
        expect(dailyPrizeSummary("1", "WAX", 36500)).toBe("1 WAX a day for 36,500 days");
    });
});

describe("compoundedCosts", () => {
    const prize = summarizeScheduleCosts({
        dailyUAmount: "50000000",
        days: 30,
        prizeDenom: "ufoo",
        mode: "create",
        scheduleFee: BZE("25000000000"),
        prizeFee: BZE("25000000000"),
        isNewPrize: true,
    });

    it("alone: the compounded reward fee", () => {
        expect(compoundedCosts(BZE("25000000000"))).toEqual({
            fees: [{ label: "Compounded reward fee", coin: BZE("25000000000") }],
            escrow: undefined,
            feeTotals: [BZE("25000000000")],
            feesKnown: true,
        });
    });

    it("with a first prize: three named fees, one total, and the escrow", () => {
        const c = compoundedCosts(BZE("25000000000"), prize);
        expect(c.fees.map(f => f.label)).toEqual(["Compounded reward fee", "Daily prize fee", "New prize fee"]);
        expect(c.feeTotals).toEqual([BZE("75000000000")]);
        expect(c.escrow).toEqual({ denom: "ufoo", amount: "1500000000" });
        expect(c.feesKnown).toBe(true);
    });

    it("an unknown fee is never free", () => {
        expect(compoundedCosts(undefined).feesKnown).toBe(false);
        const unknownPrizeFee = summarizeScheduleCosts({ dailyUAmount: "1", days: 1, prizeDenom: "ufoo", mode: "create", scheduleFee: BZE("1"), isNewPrize: true });
        expect(compoundedCosts(BZE("1"), unknownPrizeFee).feesKnown).toBe(false);
    });

    it("a zero fee stays named but is not charged", () => {
        expect(compoundedCosts(BZE("0")).feeTotals).toEqual([]);
    });
});

describe("compoundedRewardMsgs", () => {
    it("without a prize: MsgCreateDenomReward alone", () => {
        const msgs = compoundedRewardMsgs("bze1me", "factory/bze1me/uhoney");
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/bze.rewards.MsgCreateDenomReward");
        expect(msgs[0].value).toMatchObject({ creator: "bze1me", denom: "factory/bze1me/uhoney" });
        expect(compoundedTxKind(false)).toBe("create-denom-reward");
    });

    it("with a prize: the create message, then the daily prize schedule", () => {
        const msgs = compoundedRewardMsgs("bze1me", "factory/bze1me/uhoney", { prizeDenom: "ubze", dailyUAmount: new BigNumber("50000000"), days: 30 });
        expect(msgs.map(m => m.typeUrl)).toEqual(["/bze.rewards.MsgCreateDenomReward", "/bze.rewards.MsgCreateDenomRewardSchedule"]);
        expect(msgs[1].value).toMatchObject({
            creator: "bze1me",
            denom: "factory/bze1me/uhoney",
            prizeDenom: "ubze",
            dailyAmount: "50000000",
            duration: "30",
        });
        expect(compoundedTxKind(true)).toEqual(["create-denom-reward", "create-denom-reward-schedule"]);
    });
});
