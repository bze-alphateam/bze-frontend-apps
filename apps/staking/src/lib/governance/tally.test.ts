import {describe, expect, it} from "vitest";
import type {GovTally} from "@bze/bze-ui-kit";
import {passingChecks, quorumStatus, tallyShares, totalVotes, turnout, yesShare} from "./tally";

const tally = (yes: number, no = 0, veto = 0, abstain = 0): GovTally => ({
    yes_count: String(yes),
    no_count: String(no),
    no_with_veto_count: String(veto),
    abstain_count: String(abstain),
});

// Mainnet's tallying params (2026-10-17).
const params = {
    quorum: "0.334000000000000000",
    threshold: "0.500000000000000000",
    expedited_threshold: "0.667000000000000000",
    veto_threshold: "0.334000000000000000",
};

const pct = (v: { toFixed: () => string } | null) => (v == null ? null : v.toFixed());

describe("tally shares", () => {
    it("gives each option its amount and share of all votes", () => {
        const shares = tallyShares(tally(60, 20, 10, 10));
        expect(shares.map((s) => [s.label, s.amount.toFixed(), pct(s.pct)])).toEqual([
            ["Yes", "60", "60"],
            ["No", "20", "20"],
            ["No with veto", "10", "10"],
            ["Abstain", "10", "10"],
        ]);
        expect(totalVotes(tally(60, 20, 10, 10)).toFixed()).toBe("100");
    });

    it("leaves abstain out of the Yes share", () => {
        expect(pct(yesShare(tally(60, 20, 0, 1000)))).toBe("75");
    });
});

describe("the empty tally", () => {
    const empty = tally(0);

    it("has no shares, no Yes share and zero turnout", () => {
        expect(tallyShares(empty).every((s) => s.pct === null)).toBe(true);
        expect(yesShare(empty)).toBeNull();
        expect(pct(turnout(empty, "1000"))).toBe("0");
    });

    it("is not passing", () => {
        const c = passingChecks(empty, "1000", params, false);
        expect(c.quorum.ok).toBe(false);
        expect(c.threshold.ok).toBe(false);
        expect(c.threshold.value).toBeNull();
        expect(c.veto.ok).toBe(true);
        expect(c.passing).toBe(false);
    });

    it("reads a missing tally as empty", () => {
        expect(totalVotes(undefined).toFixed()).toBe("0");
        expect(passingChecks(null, "1000", params, false).passing).toBe(false);
    });
});

describe("turnout and quorum", () => {
    it("is votes cast over bonded tokens, abstain included", () => {
        expect(pct(turnout(tally(200, 0, 0, 100), "1000"))).toBe("30");
    });

    it("is unknown without the bonded tokens", () => {
        expect(turnout(tally(1), "0")).toBeNull();
        expect(quorumStatus(tally(1), null, params).reached).toBe(false);
    });

    it("is reached at exactly the quorum", () => {
        expect(quorumStatus(tally(334), "1000", params).reached).toBe(true);
        expect(quorumStatus(tally(333), "1000", params).reached).toBe(false);
    });
});

describe("passing checks", () => {
    it("passes with quorum, a Yes majority and no veto", () => {
        const c = passingChecks(tally(600, 100), "1000", params, false);
        expect(c.passing).toBe(true);
        expect(pct(c.threshold.need)).toBe("50");
    });

    it("needs more than the threshold: exactly 50% Yes is not enough", () => {
        expect(passingChecks(tally(250, 250), "1000", params, false).threshold.ok).toBe(false);
    });

    it("uses the expedited threshold for an expedited proposal", () => {
        const t = tally(600, 400);
        expect(passingChecks(t, "1000", params, false).threshold.ok).toBe(true);
        const expedited = passingChecks(t, "1000", params, true);
        expect(pct(expedited.threshold.need)).toBe("66.7");
        expect(expedited.threshold.ok).toBe(false);
        expect(expedited.passing).toBe(false);
    });

    it("fails on a veto above the veto threshold, counting abstain in the base", () => {
        // 340 / 1000 = 34% > 33.4%
        expect(passingChecks(tally(560, 0, 340, 100), "1000", params, false).veto.ok).toBe(false);
        // Exactly the threshold does not veto: the chain fails only above it.
        expect(passingChecks(tally(566, 0, 334, 100), "1000", params, false).veto.ok).toBe(true);
    });

    it("fails when everyone abstained", () => {
        const c = passingChecks(tally(0, 0, 0, 500), "1000", params, false);
        expect(c.quorum.ok).toBe(true);
        expect(c.threshold.ok).toBe(false);
        expect(c.passing).toBe(false);
    });
});
