import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";

import {burnCoin, burnCountdown, burnedTotal, burnShare, formatBurnShare} from "./burn";

const bn = (value: string | number) => new BigNumber(value);

describe("burnShare", () => {
    it("is burned over supply plus burned", () => {
        // 2,340,112 burned out of 97,659,888 left = 100M originally.
        expect(burnShare(bn(2_340_112), bn(97_659_888)).toString()).toBe("0.02340112");
    });

    it("is 0 when nothing was burned", () => {
        expect(burnShare(bn(0), bn(1_000_000)).toString()).toBe("0");
    });

    it("is the whole supply when everything was burned", () => {
        expect(burnShare(bn(500), bn(0)).toString()).toBe("1");
    });

    it("guards an empty original supply instead of dividing by zero", () => {
        expect(burnShare(bn(0), bn(0)).toString()).toBe("0");
    });

    it("ignores a negative burn", () => {
        expect(burnShare(bn(-5), bn(100)).toString()).toBe("0");
    });
});

describe("formatBurnShare", () => {
    it.each([
        ["0", "0%"],
        ["0.02340112", "2.34%"],
        ["0.00005", "<0.01%"],
        ["0.0001", "0.01%"],
        ["1", "100%"],
    ])("formats %s as %s", (share, text) => {
        expect(formatBurnShare(bn(share))).toBe(text);
    });
});

describe("burnedTotal", () => {
    it("sums the burns and is 0 without any", () => {
        expect(burnedTotal([{amount: bn("1.5")}, {amount: bn(2)}]).toString()).toBe("3.5");
        expect(burnedTotal([]).toString()).toBe("0");
    });
});

describe("burnCountdown", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

    it.each([
        [2 * 1440 + 14 * 60 + 30, "2d 14h"],
        [3 * 1440, "3d"],
        [5 * 60 + 12, "5h 12m"],
        [7 * 60, "7h"],
        [12, "12m"],
    ])("shows %i minutes as %s", (minutes, text) => {
        expect(burnCountdown(later(minutes), now)).toBe(text);
    });

    it("says any moment now once the date is reached or passed", () => {
        expect(burnCountdown(later(0), now)).toBe("Any moment now");
        expect(burnCountdown(later(-30), now)).toBe("Any moment now");
    });
});

describe("burnCoin", () => {
    it("writes base units followed by the denom, without decimals or grouping", () => {
        expect(burnCoin(bn("1250000000"), "factory/bze1owner/upage")).toBe("1250000000factory/bze1owner/upage");
    });
});
