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
    it("quorum, to pass and the voting period in the boards' words", () => {
        const rules = describeRules("DAO_TYPE_STAKE", config(), PARAMS, fmt);
        expect(rules.rows.map((r) => r.label)).toEqual(["Quorum", "To pass", "Voting", "Expedited", "Who can propose", "Proposal cost", "Deposit"]);
        expect(value(rules, "quorum")).toBe("40 % of all voting power must vote");
        expect(value(rules, "threshold")).toBe("More than 50 % of yes + no");
        expect(value(rules, "voting-period")).toBe("3 days");
        expect(value(rules, "expedited")).toBe("Not allowed");
    });

    it("says members for a static list", () => {
        const rules = describeRules("DAO_TYPE_STATIC_LIST", config(), null, fmt);
        expect(value(rules, "quorum")).toBe("40 % of members must vote");
        expect(value(rules, "who-proposes")).toBe("Members only");
    });

    it("expedited voting: a <n>-day vote, its bars, and the earliest settle time, which only stake DAOs have", () => {
        const c = config({allow_expedite: true, expedited_period: "172800s", expedite_quorum: "0.5", expedite_threshold: "0.667"});
        expect(value(describeRules("DAO_TYPE_STAKE", c, PARAMS, fmt), "expedited")).toBe(
            "Allowed: 2-day vote that settles early when 50 % vote and more than 66.7 % of all voting power says yes, at the earliest 1 day after submission",
        );
        expect(value(describeRules("DAO_TYPE_STATIC_LIST", c, PARAMS, fmt), "expedited")).toBe(
            "Allowed: 2-day vote that settles early when 50 % of members vote and more than 66.7 % of all members vote yes",
        );
    });

    it("a zero (or unknown) expedite delay leaves the earliest-settle clause out; a compound period stays as it is", () => {
        const c = config({allow_expedite: true, expedited_period: "108000s", expedite_quorum: "0.6", expedite_threshold: "0.7"});
        const zero = value(describeRules("DAO_TYPE_STAKE", c, {...PARAMS, min_expedite_delay: "0s"}, fmt), "expedited");
        expect(zero).not.toMatch(/at the earliest/);
        expect(zero).toMatch(/^Allowed: 1 day 6 hours vote/);
        expect(value(describeRules("DAO_TYPE_STAKE", c, null, fmt), "expedited")).not.toMatch(/at the earliest/);
    });

    it("who can propose: anyone with open submission, the stakers of the sources for stake", () => {
        expect(value(describeRules("DAO_TYPE_STAKE", config({open_submission: true}), null, fmt), "who-proposes")).toBe("Anyone");
        expect(value(describeRules("DAO_TYPE_STAKE", config(), null, fmt), "who-proposes")).toBe("Stakers in the sources below");
    });

    it.each([
        ["BURN", "5 ubze, paid on submit and burned, never refunded"],
        ["TREASURY", "5 ubze, paid on submit to the treasury, never refunded"],
    ] as const)("a proposal cost that goes to %s", (destination, text) => {
        const rules = describeRules("DAO_TYPE_STAKE", config({proposal_cost: {denom: "ubze", amount: "5"}, cost_destination: destination}), null, fmt);
        expect(value(rules, "cost")).toBe(text);
    });

    it.each([
        ["ALWAYS", "BURN", "9 ubze, always given back"],
        ["ONLY_PASSED", "TREASURY", "9 ubze, back only if the proposal passes; otherwise it goes to the treasury"],
        ["ONLY_PASSED", "BURN", "9 ubze, back only if the proposal passes; otherwise it is burned"],
        ["NEVER", "BURN", "9 ubze, never given back: burned when the proposal ends"],
        ["NEVER", "TREASURY", "9 ubze, never given back: it goes to the treasury when the proposal ends"],
    ] as const)("deposit with the %s refund policy, kept deposits %s", (policy, kept, text) => {
        const rules = describeRules("DAO_TYPE_STAKE", config({proposal_deposit: {denom: "ubze", amount: "9"}, deposit_refund_policy: policy, kept_deposit_destination: kept}), null, fmt);
        expect(value(rules, "deposit")).toBe(text);
    });

    it("free proposals: cost and deposit say None, and there is no warning about it any more", () => {
        const rules = describeRules("DAO_TYPE_STAKE", config(), PARAMS, fmt);
        expect(value(rules, "cost")).toBe("None");
        expect(value(rules, "deposit")).toBe("None");
        expect(Object.keys(rules)).toEqual(["rows"]);
        expect(JSON.stringify(rules)).not.toMatch(/free/i);
    });

    it("a zero amount is no cost", () => {
        const rules = describeRules("DAO_TYPE_STAKE", config({proposal_cost: {denom: "ubze", amount: "0"}}), null, fmt);
        expect(value(rules, "cost")).toBe("None");
    });
});
