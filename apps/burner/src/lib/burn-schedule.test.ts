import { describe, it, expect } from "vitest";

import { breakdownDuration } from "./burn-schedule";

describe("breakdownDuration", () => {
    it("is all zeros for a spent countdown", () => {
        expect(breakdownDuration(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    });

    it("splits a mixed duration into days/hours/minutes/seconds", () => {
        const total = 1 * 86400 + 2 * 3600 + 3 * 60 + 4;
        expect(breakdownDuration(total)).toEqual({ days: 1, hours: 2, minutes: 3, seconds: 4 });
    });

    it("carries 23:59:59 without overflowing into a day", () => {
        const total = 23 * 3600 + 59 * 60 + 59;
        expect(breakdownDuration(total)).toEqual({ days: 0, hours: 23, minutes: 59, seconds: 59 });
    });

    it("counts multiple days", () => {
        expect(breakdownDuration(10 * 86400).days).toBe(10);
    });

    it("clamps a negative (already-spent) countdown to zero", () => {
        expect(breakdownDuration(-100)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    });

    it("floors fractional seconds", () => {
        // 65.9s -> 65s -> 1m 5s
        expect(breakdownDuration(65.9)).toEqual({ days: 0, hours: 0, minutes: 1, seconds: 5 });
    });
});
