import {describe, expect, it} from "vitest";
import {
    durationText,
    endsIn,
    formatDateTimeUtc,
    formatDateUtc,
    formatPct,
    fractionPct,
    parseDurationSeconds,
    votingPeriodText,
} from "./format";

describe("percentages", () => {
    it("keeps one decimal and trims .0", () => {
        expect(formatPct("74.2857")).toBe("74.3%");
        expect(formatPct(50)).toBe("50%");
        expect(formatPct("100")).toBe("100%");
        expect(formatPct("nope")).toBe("");
    });

    it("reads chain fractions", () => {
        expect(fractionPct("0.334000000000000000")).toBe("33.4%");
        expect(fractionPct("0.500000000000000000")).toBe("50%");
        expect(fractionPct("0.667000000000000000")).toBe("66.7%");
    });
});

describe("dates", () => {
    it("writes date and time in UTC", () => {
        expect(formatDateTimeUtc("2026-10-20T10:13:59.778116570Z")).toBe("Oct 20, 2026, 10:13 UTC");
        expect(formatDateTimeUtc("2026-01-05T03:04:00+02:00")).toBe("Jan 5, 2026, 01:04 UTC");
    });

    it("writes the day in UTC", () => {
        expect(formatDateUtc("2026-07-21T23:30:00Z")).toBe("Jul 21, 2026");
        expect(formatDateUtc("2026-07-22T00:30:00+02:00")).toBe("Jul 21, 2026");
    });

    it("is empty for an unreadable time", () => {
        expect(formatDateTimeUtc("soon")).toBe("");
        expect(formatDateUtc("")).toBe("");
    });
});

describe("durations", () => {
    it("uses the two largest units", () => {
        expect(durationText(2 * 86400 + 22 * 3600 + 15 * 60)).toBe("2 days 22 hours");
        expect(durationText(3 * 3600 + 5 * 60 + 30)).toBe("3 hours 5 min");
        expect(durationText(86400)).toBe("1 day");
        expect(durationText(3600)).toBe("1 hour");
        expect(durationText(12 * 60)).toBe("12 min");
    });

    it("says less than a minute under a minute, and once past", () => {
        expect(durationText(59)).toBe("less than a minute");
        expect(durationText(-100)).toBe("less than a minute");
    });

    it("counts down to the end with the clock it is given", () => {
        const end = "2026-10-20T10:13:59Z";
        expect(endsIn(end, new Date("2026-10-17T12:00:00Z"))).toBe("2 days 22 hours");
        expect(endsIn(end, new Date("2026-10-20T07:08:00Z"))).toBe("3 hours 5 min");
        expect(endsIn(end, new Date("2026-10-20T10:13:30Z"))).toBe("less than a minute");
    });

    it("reads the voting period of the params", () => {
        expect(votingPeriodText("432000s")).toBe("5 days");
        expect(votingPeriodText("7200s")).toBe("2 hours");
        expect(votingPeriodText("86400s")).toBe("1 day");
        expect(votingPeriodText(undefined)).toBeNull();
        expect(parseDurationSeconds("1.5s")).toBe(1.5);
        expect(parseDurationSeconds("5d")).toBeNull();
    });
});
