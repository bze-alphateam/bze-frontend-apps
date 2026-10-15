import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import {
    POT_TREND_TEXT,
    buildStartRaffleMsg,
    burnerCoinHref,
    chancesFromOneIn,
    expectedPotTrend,
    isRaffleRunningError,
    oneInFromChances,
    percentFromChances,
    percentFromRatio,
    raffleEndDate,
    raffleHref,
    raffleRunningText,
    ratioFromPercent,
    toBaseUnits,
    validateOneIn,
    validatePot,
    validatePrizePercent,
    validateRaffleDays,
    validateTicketPrice,
} from "./raffle-new";

const DENOM = "factory/bze1owner/utok";

describe("validatePot", () => {
    it("needs at least 100000 base units (0.1 of a 6-decimal token)", () => {
        expect(validatePot("0.099999", 6, "TOK")).toBe("The pot must be at least 0.1 TOK.");
        expect(validatePot("0.1", 6, "TOK")).toBe("");
    });

    it("shows the minimum in the token's own decimals", () => {
        expect(validatePot("999", 2, "TWO")).toBe("The pot must be at least 1,000 TWO.");
        expect(validatePot("1000", 2, "TWO")).toBe("");
    });

    it("caps at the spendable amount when a wallet is connected", () => {
        const max = new BigNumber(5_000_000);
        expect(validatePot("5.000001", 6, "TOK", max)).toBe("You only have 5 TOK.");
        expect(validatePot("5", 6, "TOK", max)).toBe("");
        expect(validatePot("500", 6, "TOK")).toBe("");
    });

    it("rejects what isn't an amount", () => {
        expect(validatePot("", 6, "TOK")).toBe("Amount is required.");
        expect(validatePot("abc", 6, "TOK")).toBe("Enter a valid positive number.");
        expect(validatePot("0.1234567", 6, "TOK")).toMatch(/At most 6 decimal places/);
    });
});

describe("validateRaffleDays", () => {
    it.each([
        ["0", "At least 1 day."],
        ["1", ""],
        ["180", ""],
        ["181", "At most 180 days."],
        ["1.5", "Enter a whole number of days."],
        ["", "Required."],
    ])("%s → %s", (input, error) => {
        expect(validateRaffleDays(input)).toBe(error);
    });
});

describe("validateTicketPrice", () => {
    it("needs at least one base unit", () => {
        expect(validateTicketPrice("0.0000001", 6, "TOK")).toBe("The smallest ticket price is 0.000001 TOK.");
        expect(validateTicketPrice("0.000001", 6, "TOK")).toBe("");
        expect(toBaseUnits("0.000001", 6)?.toFixed()).toBe("1");
    });

    it("must be above zero", () => {
        expect(validateTicketPrice("0", 6, "TOK")).toBe("Amount must be greater than zero.");
        expect(validateTicketPrice("0.0000000", 6, "TOK")).toBe("Amount must be greater than zero.");
    });
});

describe("win chance", () => {
    it("1 in N becomes round(1,000,000 / N), clamped to 1…1,000,000", () => {
        expect(chancesFromOneIn(1)).toBe(1_000_000);
        expect(chancesFromOneIn(1_000_000)).toBe(1);
        expect(chancesFromOneIn(3)).toBe(333_333);
        expect(chancesFromOneIn(100)).toBe(10_000);
        expect(chancesFromOneIn(2_000_001)).toBe(1);
    });

    it("shows the exact percentage the chain will use", () => {
        expect(percentFromChances(333_333)).toBe("33.3333");
        expect(percentFromChances(1)).toBe("0.0001");
        expect(percentFromChances(1_000_000)).toBe("100");
        expect(percentFromChances(10_000n)).toBe("1");
    });

    it("reads a running raffle's chances back as 1 in N", () => {
        expect(oneInFromChances(10_000n)).toBe(100);
        expect(oneInFromChances("333333")).toBe(3);
        expect(oneInFromChances(0)).toBe(0);
    });

    it("N must be a whole number from 1 to 1,000,000", () => {
        expect(validateOneIn("0")).toBe("Enter a number from 1 to 1,000,000.");
        expect(validateOneIn("1")).toBe("");
        expect(validateOneIn("1000000")).toBe("");
        expect(validateOneIn("1000001")).toBe("Enter a number from 1 to 1,000,000.");
        expect(validateOneIn("2.5")).toBe("Enter a whole number.");
    });
});

describe("prize share", () => {
    it("whole percents from 1 to 100", () => {
        expect(validatePrizePercent("0")).toBe("Enter a percent from 1 to 100.");
        expect(validatePrizePercent("1")).toBe("");
        expect(validatePrizePercent("100")).toBe("");
        expect(validatePrizePercent("101")).toBe("Enter a percent from 1 to 100.");
        expect(validatePrizePercent("12.5")).toBe("Enter a whole percent.");
    });

    it("is sent as a ratio with two decimals", () => {
        expect(ratioFromPercent(1)).toBe("0.01");
        expect(ratioFromPercent(25)).toBe("0.25");
        expect(ratioFromPercent(100)).toBe("1.00");
        expect(percentFromRatio("0.250000000000000000")).toBe("25");
    });
});

describe("expectedPotTrend", () => {
    const base = { chances: 10_000, ratio: "0.25", pot: 1_000_000_000 };

    it("follows ticketPrice − (chances / 1,000,000) × ratio × pot", () => {
        // 1 % × 25 % × 1,000 = 2.5 per ticket
        expect(expectedPotTrend({ ...base, ticketPrice: 3_000_000 })).toBe("grows");
        expect(expectedPotTrend({ ...base, ticketPrice: 2_000_000 })).toBe("shrinks");
        expect(expectedPotTrend({ ...base, ticketPrice: 2_500_000 })).toBe("same");
    });

    it("has a sentence for each trend", () => {
        expect(POT_TREND_TEXT.grows).toBe("On average the pot grows as people play.");
        expect(POT_TREND_TEXT.shrinks).toBe("On average the pot shrinks as people win.");
        expect(POT_TREND_TEXT.same).toBe("On average the pot stays about the same.");
    });
});

describe("buildStartRaffleMsg", () => {
    it("builds one MsgStartRaffle with base-unit strings", () => {
        const msg = buildStartRaffleMsg({
            creator: "bze1me",
            denom: DENOM,
            pot: new BigNumber("1000000000"),
            days: 14,
            chances: chancesFromOneIn(100),
            prizePercent: 25,
            ticketPrice: new BigNumber("10000000"),
        });
        expect(msg).toEqual({
            typeUrl: "/bze.burner.MsgStartRaffle",
            value: {
                creator: "bze1me",
                denom: DENOM,
                pot: "1000000000",
                duration: "14",
                chances: "10000",
                ratio: "0.25",
                ticketPrice: "10000000",
            },
        });
    });
});

describe("links and texts", () => {
    it("raffleHref adds the token and the way back", () => {
        expect(raffleHref()).toBe("/raffle/new");
        expect(raffleHref(DENOM)).toBe(`/raffle/new?denom=${encodeURIComponent(DENOM)}`);
        const ws = `/manage/token?denom=${encodeURIComponent(DENOM)}&tab=supply`;
        const href = raffleHref(DENOM, { href: ws, label: "TOK" });
        const params = new URLSearchParams(href.split("?")[1]);
        expect(params.get("denom")).toBe(DENOM);
        expect(params.get("return")).toBe(ws);
        expect(params.get("returnLabel")).toBe("TOK");
    });

    it("links the Burner coin page", () => {
        expect(burnerCoinHref("https://burner.test", DENOM)).toBe(`https://burner.test/coin?coin=${encodeURIComponent(DENOM)}`);
    });

    it("ends days × 24 hours after the current hour epoch started", () => {
        const end = raffleEndDate(14, "2026-10-15T10:00:00Z");
        expect(end.toISOString()).toBe("2026-10-29T10:00:00.000Z");
        const now = new Date("2026-10-15T10:30:00Z");
        expect(raffleEndDate(1, undefined, now).toISOString()).toBe("2026-10-16T10:30:00.000Z");
        expect(raffleEndDate(1, "not a date", now).toISOString()).toBe("2026-10-16T10:30:00.000Z");
    });

    it("recognises the chain's one-raffle-per-coin error", () => {
        expect(isRaffleRunningError("failed to execute message; message index: 0: raffle already running for this coin")).toBe(true);
        expect(isRaffleRunningError("not enough balance")).toBe(false);
        expect(isRaffleRunningError(undefined)).toBe(false);
        expect(raffleRunningText("TOK", "3d 4h")).toBe("A raffle for TOK is already running. It ends in 3d 4h.");
    });
});
