import {describe, expect, it} from "vitest";
import type {DaoConfig} from "@bze/bze-ui-kit";
import {describeRules} from "./dao-rules";

const config = (over: Partial<DaoConfig> = {}): DaoConfig => ({
    min_quorum: "0.400000000000000000", threshold: "0.500000000000000000", voting_period: "259200s", allow_expedite: false,
    expedited_period: "0s", expedite_quorum: "0.000000000000000000", expedite_threshold: "0.000000000000000000",
    open_submission: false, proposal_cost: null, proposal_deposit: null, deposit_refund_policy: "ALWAYS",
    cost_destination: "BURN", kept_deposit_destination: "BURN", ...over,
});
const PARAMS = {min_expedite_delay: "86400s", max_open_proposals: "10"};
const fmt = (c: {denom: string; amount: string}) => `${c.amount} ${c.denom}`;
const value = (rules: ReturnType<typeof describeRules>, id: string) => rules.rows.find((r) => r.id === id)?.value;

describe("describeRules", () => {
    it("writes quorum, threshold and the voting period", () => {
        const rules = describeRules("DAO_TYPE_STAKE", config(), PARAMS, fmt);
        expect(value(rules, "quorum")).toBe("At least 40% of all voting power must vote");
        expect(value(rules, "threshold")).toBe("More than 50% of the yes and no votes must be yes");
        expect(value(rules, "voting-period")).toBe("3 days");
        expect(value(rules, "expedited")).toBe("Off");
        expect(value(rules, "open-slots")).toBe("Up to 10");
    });

    it("says members for a static list", () => {
        const rules = describeRules("DAO_TYPE_STATIC_LIST", config(), null, fmt);
        expect(value(rules, "quorum")).toMatch(/of all members/);
        expect(value(rules, "who-proposes")).toBe("Members only");
        expect(rules.rows.some((r) => r.id === "open-slots")).toBe(false);
    });

    it("expedited voting: period, bars against all voting power and the delay, which only stake DAOs have", () => {
        const c = config({allow_expedite: true, expedited_period: "86400s", expedite_quorum: "0.6", expedite_threshold: "0.7"});
        const stake = value(describeRules("DAO_TYPE_STAKE", c, PARAMS, fmt), "expedited");
        expect(stake).toMatch(/Voting lasts 1 day/);
        expect(stake).toMatch(/60% of all voting power has voted and more than 70% of all voting power has voted yes/);
        expect(stake).toMatch(/not before 1 day after submission/);
        expect(value(describeRules("DAO_TYPE_STATIC_LIST", c, PARAMS, fmt), "expedited")).not.toMatch(/not before/);
    });

    it("a zero expedite delay leaves the delay clause out", () => {
        const c = config({allow_expedite: true, expedited_period: "86400s", expedite_quorum: "0.6", expedite_threshold: "0.7"});
        expect(value(describeRules("DAO_TYPE_STAKE", c, {...PARAMS, min_expedite_delay: "0s"}, fmt), "expedited")).not.toMatch(/not before/);
    });

    it("who can propose: anyone with open submission, voters only for stake", () => {
        expect(value(describeRules("DAO_TYPE_STAKE", config({open_submission: true}), null, fmt), "who-proposes")).toBe("Anyone");
        expect(value(describeRules("DAO_TYPE_STAKE", config(), null, fmt), "who-proposes")).toMatch(/Voters only/);
    });

    it.each([
        ["BURN", "burned"],
        ["TREASURY", "treasury"],
    ] as const)("a proposal cost that goes to %s", (destination, word) => {
        const rules = describeRules("DAO_TYPE_STAKE", config({proposal_cost: {denom: "ubze", amount: "5"}, cost_destination: destination}), null, fmt);
        expect(value(rules, "cost")).toMatch(new RegExp(`^5 ubze, .*${word}`));
        expect(rules.freeProposalsWarning).toBeNull();
    });

    it.each([
        ["ALWAYS", /returned whatever the result/, false],
        ["ONLY_PASSED", /only when the proposal passes.*kept is burned/, true],
        ["NEVER", /never returned.*kept is sent to the DAO's treasury/, true],
    ] as const)("deposit with the %s refund policy", (policy, pattern, kept) => {
        const rules = describeRules("DAO_TYPE_STAKE", config({
            proposal_deposit: {denom: "ubze", amount: "9"}, deposit_refund_policy: policy,
            kept_deposit_destination: policy === "NEVER" ? "TREASURY" : "BURN",
        }), null, fmt);
        expect(value(rules, "deposit")).toMatch(pattern);
        expect(/kept/.test(value(rules, "deposit") ?? "")).toBe(kept);
        expect(rules.freeProposalsWarning === null).toBe(policy !== "ALWAYS");
    });

    it("warns that proposals are free when there is neither a cost nor a deposit", () => {
        const rules = describeRules("DAO_TYPE_STAKE", config(), PARAMS, fmt);
        expect(value(rules, "cost")).toBe("None");
        expect(value(rules, "deposit")).toBe("None");
        expect(rules.freeProposalsWarning).toMatch(/free.*all 10 open-proposal slots/);
    });

    it("a zero amount is no cost", () => {
        const rules = describeRules("DAO_TYPE_STAKE", config({proposal_cost: {denom: "ubze", amount: "0"}}), null, fmt);
        expect(value(rules, "cost")).toBe("None");
        expect(rules.freeProposalsWarning).not.toBeNull();
    });
});
