import {describe, expect, it} from "vitest";
import {CONFIG, DAO, STAKE_DAO} from "@/test/composer-fixtures";
import {expeditedExplanation} from "./expedite";

describe("expeditedExplanation", () => {
    it("states the DAO's own periods and bars", () => {
        const lines = expeditedExplanation(DAO, "43200s");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain("after 1 day instead of 3 days");
        expect(lines[1]).toContain("at least 60% must take part and more than 70% must vote Yes");
    });

    it("a stake DAO adds the minimum delay before an early settle", () => {
        const lines = expeditedExplanation(STAKE_DAO, "43200s");
        expect(lines).toHaveLength(3);
        expect(lines[2]).toContain("during its first 12 hours");
    });

    it("does not guess when a duration cannot be read", () => {
        const lines = expeditedExplanation({...STAKE_DAO, config: {...CONFIG, expedited_period: "?", voting_period: "?"}}, "?");
        expect(lines[0]).toContain("the expedited period instead of the usual voting period");
        expect(lines[2]).toContain("its first minimum expedite delay");
    });
});
