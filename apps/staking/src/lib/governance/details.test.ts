import { describe, it, expect } from "vitest";
import type { GovParams, GovProposal, GovTally } from "@bze/bze-ui-kit";
import { coinsText, depositFate, depositsReturned, finalChecks, isVetoed, tallyFootnote, timeline, wholeBze } from "./details";

const PARAMS = {
    quorum: "0.334000000000000000",
    threshold: "0.500000000000000000",
    veto_threshold: "0.334000000000000000",
    expedited_threshold: "0.667000000000000000",
    burn_vote_veto: true,
    burn_vote_quorum: false,
} as GovParams;

const tally = (yes: string, no = "0", veto = "0", abstain = "0"): GovTally => ({
    yes_count: yes, no_count: no, no_with_veto_count: veto, abstain_count: abstain,
});

const proposal = (status: GovProposal["status"], overrides: Partial<GovProposal> = {}) =>
    ({ status, expedited: false, final_tally_result: tally("0"), ...overrides }) as GovProposal;

describe("coinsText", () => {
    it("shows ubze as BZE, a known denom with its ticker, an unknown one raw", () => {
        const resolve = (denom: string) => (denom === "factory/bze1x/uvdl" ? { ticker: "VDL", decimals: 6 } : undefined);
        expect(coinsText([{ denom: "ubze", amount: "3000000000000" }])).toBe("3,000,000 BZE");
        expect(coinsText([
            { denom: "ubze", amount: "100000000000" },
            { denom: "factory/bze1x/uvdl", amount: "2500000" },
            { denom: "ibc/ABC", amount: "7" },
        ], resolve)).toBe("100,000 BZE, 2.5 VDL and 7 ibc/ABC");
        expect(coinsText([])).toBe("nothing");
    });

    it("rounds voting power to whole BZE", () => {
        expect(wholeBze("113492783744251")).toBe("113,492,784");
    });
});

describe("veto and deposit", () => {
    it("vetoes only above the veto threshold", () => {
        expect(isVetoed(tally("666", "0", "334"), PARAMS)).toBe(false);
        expect(isVetoed(tally("665", "0", "335"), PARAMS)).toBe(true);
        expect(isVetoed(tally("0"), PARAMS)).toBe(false);
    });

    it("returns deposits unless a burning veto rejected the proposal", () => {
        expect(depositsReturned(proposal("PROPOSAL_STATUS_PASSED"), false, true)).toBe(true);
        expect(depositsReturned(proposal("PROPOSAL_STATUS_FAILED"), false, true)).toBe(true);
        expect(depositsReturned(proposal("PROPOSAL_STATUS_REJECTED"), false, true)).toBe(true);
        expect(depositsReturned(proposal("PROPOSAL_STATUS_REJECTED"), true, true)).toBe(false);
        expect(depositsReturned(proposal("PROPOSAL_STATUS_REJECTED"), true, false)).toBe(true);
    });

    it("words the deposit after burn_vote_veto: true", () => {
        const vetoed = tally("10", "0", "90");
        expect(depositFate(proposal("PROPOSAL_STATUS_VOTING_PERIOD"), null, PARAMS)).toBe("returned unless vetoed");
        expect(depositFate(proposal("PROPOSAL_STATUS_REJECTED"), vetoed, PARAMS)).toBe("burned");
        expect(depositFate(proposal("PROPOSAL_STATUS_PASSED"), tally("100"), PARAMS)).toBe("returned");
    });

    it("words the deposit after burn_vote_veto: false", () => {
        const params = { ...PARAMS, burn_vote_veto: false };
        expect(depositFate(proposal("PROPOSAL_STATUS_VOTING_PERIOD"), null, params)).toBe("returned when voting ends");
        expect(depositFate(proposal("PROPOSAL_STATUS_REJECTED"), tally("10", "0", "90"), params)).toBe("returned");
        expect(depositFate(proposal("PROPOSAL_STATUS_VOTING_PERIOD"), null, { ...params, burn_vote_quorum: true }))
            .toBe("returned unless short of quorum");
    });

    it("writes the veto sentence only when the veto burns the deposit", () => {
        expect(tallyFootnote(PARAMS)).toBe(
            "Abstain counts toward turnout, not toward the Yes share. If No with veto goes above 33.4%, the proposal fails and its deposit is burned."
        );
        expect(tallyFootnote({ ...PARAMS, burn_vote_veto: false })).toBe(
            "Abstain counts toward turnout, not toward the Yes share. If No with veto goes above 33.4%, the proposal fails."
        );
    });
});

describe("finalChecks", () => {
    it("knows a passed proposal met the quorum", () => {
        const c = finalChecks(proposal("PROPOSAL_STATUS_PASSED", { final_tally_result: tally("90", "10") }), PARAMS);
        expect(c.quorum).toEqual({ ok: true, need: expect.anything() });
        expect(c.quorum.need.toString()).toBe("33.4");
        expect(c.threshold.ok).toBe(true);
        expect(c.threshold.value?.toString()).toBe("90");
        expect(c.veto.ok).toBe(true);
    });

    it("reads a rejection whose Yes share and veto both pass as a missed quorum", () => {
        expect(finalChecks(proposal("PROPOSAL_STATUS_REJECTED", { final_tally_result: tally("90", "10") }), PARAMS).quorum.ok).toBe(false);
    });

    it("can't tell the quorum of a rejection another check explains", () => {
        const c = finalChecks(proposal("PROPOSAL_STATUS_REJECTED", { final_tally_result: tally("10", "90") }), PARAMS);
        expect(c.quorum.ok).toBeNull();
        expect(c.threshold.ok).toBe(false);
    });

    it("uses the expedited threshold for an expedited proposal", () => {
        const c = finalChecks(proposal("PROPOSAL_STATUS_REJECTED", { expedited: true, final_tally_result: tally("60", "40") }), PARAMS);
        expect(c.threshold.ok).toBe(false);
        expect(c.threshold.need.toString()).toBe("66.7");
    });
});

describe("timeline", () => {
    const times = {
        submit_time: "2026-10-15T10:13:59.778Z",
        voting_start_time: "2026-10-15T10:13:59.778Z",
        voting_end_time: "2026-10-20T10:13:59.778Z",
    };

    it("shows voting now and the end while open", () => {
        expect(timeline(proposal("PROPOSAL_STATUS_VOTING_PERIOD", times), new Date("2026-10-17T12:00:00Z"))).toEqual([
            { label: "Submitted", detail: "Oct 15, 2026, 10:13 UTC", state: "done" },
            { label: "Voting started", detail: "Oct 15, 2026, 10:13 UTC · deposit reached", state: "done" },
            { label: "Voting now", detail: "2 days 22 hours left", state: "now" },
            { label: "Voting ends", detail: "Oct 20, 2026, 10:13 UTC", state: "todo" },
        ]);
    });

    it("ends with the result once decided", () => {
        const items = timeline(proposal("PROPOSAL_STATUS_PASSED", times), new Date("2026-11-01T00:00:00Z"));
        expect(items.map((i) => i.label)).toEqual(["Submitted", "Voting started", "Voting ended", "Passed"]);
        expect(items[3]).toEqual({ label: "Passed", detail: "Messages executed", state: "passed" });
        expect(timeline(proposal("PROPOSAL_STATUS_FAILED", times), new Date()).at(-1)?.label).toBe("Failed");
    });
});
