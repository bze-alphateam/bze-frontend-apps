import {describe, expect, it, vi} from "vitest";
import BigNumber from "bignumber.js";

import {
    entrySummary,
    isEntryResolved,
    newRaffleEntry,
    raffleOdds,
    rafflePrize,
    raffleShare,
    recentWinners,
    resolveEntry,
    type TicketCheck,
    ticketBlock,
    ticketsProblem,
} from "./raffle";

describe("raffleOdds", () => {
    it("shows the chance out of 1,000,000 as 1 in N", () => {
        expect(raffleOdds(50_000n)).toBe("1 in 20");
        expect(raffleOdds("1")).toBe("1 in 1,000,000");
        expect(raffleOdds(1_000_000)).toBe("1 in 1");
    });

    it("rounds an uneven N to two decimals", () => {
        expect(raffleOdds(30_000n)).toBe("1 in 33.33");
    });

    it("has no odds for no chance at all", () => {
        expect(raffleOdds(0n)).toBe("—");
        expect(raffleOdds("-5")).toBe("—");
        expect(raffleOdds("abc")).toBe("—");
    });
});

describe("rafflePrize", () => {
    it("is ratio × pot in display units", () => {
        expect(rafflePrize("48300000000", "0.5", 6).toFixed()).toBe("24150");
    });

    it("truncates to whole base units like the chain", () => {
        // 0.333 × 1,000,001 = 333,000.333 → 333,000 upage.
        expect(rafflePrize("1000001", "0.333", 6).toFixed()).toBe("0.333");
        expect(rafflePrize("7", "0.5", 0).toFixed()).toBe("3");
    });

    it("is 0 for an empty pot or a bad value", () => {
        expect(rafflePrize("0", "0.5", 6).toFixed()).toBe("0");
        expect(rafflePrize("", "0.5", 6).toFixed()).toBe("0");
    });
});

describe("raffleShare", () => {
    it("is the ratio as a percentage", () => {
        expect(raffleShare("0.5")).toBe("50%");
        expect(raffleShare("0.125")).toBe("12.5%");
        expect(raffleShare("0")).toBe("0%");
    });
});

describe("recentWinners", () => {
    const winner = (index: string) => ({index, denom: "t", amount: "1", winner: `bze1${index}`});

    it("lists the newest winners first by walking back from the winner count", () => {
        // Key order, as the chain returns it.
        const list = ["1", "2", "3", "4", "5", "6", "7"].map(winner);

        expect(recentWinners(list, 7n).map((w) => w.index)).toEqual(["7", "6", "5", "4", "3"]);
        expect(recentWinners(list, 2n).map((w) => w.index)).toEqual(["2", "1"]);
    });

    it("follows the ring of 100 slots past winner 100", () => {
        // Winner 102 sits in slot 2, 101 in slot 1, 100 in slot 0.
        const list = ["0", "1", "10", "2", "98", "99"].map(winner);

        expect(recentWinners(list, 102n).map((w) => w.index)).toEqual(["2", "1", "0", "99", "98"]);
    });

    it("is empty without winners", () => {
        expect(recentWinners([winner("1")], 0n)).toEqual([]);
    });
});

describe("raffle entries", () => {
    const won = (amount: string): TicketCheck => ({hasWon: true, amount});
    const lost: TicketCheck = {hasWon: false, amount: "0"};

    it("draws ticket i in block height + 2 + i", () => {
        const entry = newRaffleEntry("a", 100, 3);

        expect(ticketBlock(entry)).toBe(102);
        expect(ticketBlock(entry, 2)).toBe(104);
    });

    it("resolves tickets in order and stops at the first block not processed yet", async () => {
        const answers = new Map<number, TicketCheck>([[102, lost], [103, won("2500000")]]);
        const check = vi.fn(async (height: number) => answers.get(height));

        const first = await resolveEntry(newRaffleEntry("a", 100, 3), check);
        expect(check.mock.calls.map(([height]) => height)).toEqual([102, 103, 104]);
        expect(first.results).toEqual([{won: false, amount: new BigNumber(0)}, {won: true, amount: new BigNumber("2500000")}]);
        expect(isEntryResolved(first)).toBe(false);

        // Block 104 is processed on a later poll: only it is checked again.
        check.mockClear();
        answers.set(104, lost);
        const second = await resolveEntry(first, check);
        expect(check.mock.calls.map(([height]) => height)).toEqual([104]);
        expect(isEntryResolved(second)).toBe(true);
        expect(entrySummary(second)).toEqual({won: 1, lost: 2, pending: 0, amount: new BigNumber("2500000")});
    });

    it("returns the same entry when nothing new is drawn", async () => {
        const entry = newRaffleEntry("a", 100, 1);

        expect(await resolveEntry(entry, async () => undefined)).toBe(entry);
        expect(entrySummary(entry)).toEqual({won: 0, lost: 0, pending: 1, amount: new BigNumber(0)});
    });
});

describe("ticketsProblem", () => {
    const price = new BigNumber("100000000"); // 100 PAGE

    it("needs a whole number of tickets above 0", () => {
        expect(ticketsProblem("", price, price, "PAGE")).toBe("Buy at least 1 ticket");
        expect(ticketsProblem("0", price, price, "PAGE")).toBe("Buy at least 1 ticket");
        expect(ticketsProblem("1.5", price, price, "PAGE")).toBe("Buy at least 1 ticket");
    });

    it("blocks a total above what can be spent", () => {
        expect(ticketsProblem("3", price, new BigNumber("299999999"), "PAGE")).toBe("Not enough PAGE for 3 tickets");
        expect(ticketsProblem("1", price, new BigNumber("99999999"), "PAGE")).toBe("Not enough PAGE for 1 ticket");
        expect(ticketsProblem("3", price, new BigNumber("300000000"), "PAGE")).toBe("");
    });
});
