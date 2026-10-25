import { describe, expect, it } from "vitest";
import { formatDate, minMaxHint, notEnoughText, youHoldText } from "./format";

const NOW = new Date("2026-10-25T12:00:00Z");

describe("formatDate", () => {
    it("prints the exact day without the year in the current year", () => {
        expect(formatDate(new Date("2026-10-26T12:00:00Z"), NOW)).toBe("26 Oct");
    });

    it("adds the year when it is not the current one", () => {
        expect(formatDate(new Date("2027-10-26T12:00:00Z"), NOW)).toBe("26 Oct 2027");
    });
});

describe("shared wording", () => {
    it("min/max hint with raw numbers", () => {
        expect(minMaxHint(1, 36500, "days")).toBe("Min 1 · Max 36500 days");
        expect(minMaxHint(1, 1000000)).toBe("Min 1 · Max 1000000");
    });

    it("balance lines", () => {
        expect(youHoldText("12", "HONEY")).toBe("You hold 12 HONEY");
        expect(notEnoughText("HONEY", "12")).toBe("Not enough HONEY: you hold 12 HONEY.");
    });
});
