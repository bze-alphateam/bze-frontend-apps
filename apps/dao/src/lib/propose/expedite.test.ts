import {describe, expect, it} from "vitest";
import {CONFIG, DAO, STAKE_DAO} from "@/test/composer-fixtures";
import {expeditedExplanation} from "./expedite";

describe("expeditedExplanation", () => {
    it("states a member list's own period and bars, against all its members", () => {
        const {full, short} = expeditedExplanation(DAO, "43200s");
        expect(full).toBe("Shorter vote (1 day) that can settle early once 60% of all members have voted and yes is more than 70% of ALL members (not just of the votes cast). Use it for urgent things.");
        expect(short).toBe("1-day vote that can settle early.");
        expect(expeditedExplanation({...DAO, config: {...CONFIG, expedited_period: "172800s"}}, "0s").short).toBe("2-day vote that can settle early.");
        expect(expeditedExplanation({...DAO, config: {...CONFIG, expedited_period: "43200s"}}, "0s").short).toBe("12-hour vote that can settle early.");
        expect(expeditedExplanation({...DAO, config: {...CONFIG, expedited_period: "5400s"}}, "0s").short).toBe("Shorter vote (1 hour 30 minutes) that can settle early.");
    });

    it("a stake DAO adds the minimum delay before an early settle and counts voting power", () => {
        const {full} = expeditedExplanation(STAKE_DAO, "43200s");
        expect(full).toContain("settle early, at the earliest 12 hours after submission, once 60% of all voting power has voted");
        expect(full).toContain("more than 70% of ALL voting power");
    });

    it("does not guess when a duration cannot be read", () => {
        const {full, short} = expeditedExplanation({...STAKE_DAO, config: {...CONFIG, expedited_period: "?"}}, "?");
        expect(full).toContain("Shorter vote (the expedited period)");
        expect(full).toContain("at the earliest the minimum expedite delay after submission");
        expect(short).toBe("Shorter vote (the expedited period) that can settle early.");
    });
});
