import {describe, expect, it} from "vitest";
import type {DaoCoin, DaoDepositRefundPolicy, DaoProposalStatus} from "@bze/bze-ui-kit";
import {depositRefunded, depositSentence, moneyRows, outcomeOfStatus} from "./proposal-money";
import {CONFIG} from "@/test/proposal-fixtures";
import type {PinnedConfig, ScanOutcome} from "./proposal-model";

const fmt = (c: DaoCoin) => `${Number(c.amount) / 1e6} ${c.denom === "ubze" ? "BZE" : c.denom}`;

describe("outcomeOfStatus", () => {
    it("a passed proposal whose actions failed (or expired after failing) still counts as passed", () => {
        expect(outcomeOfStatus("VOTING")).toBe("pending");
        expect((["EXECUTED", "EXECUTION_FAILED", "EXPIRED"] as const).map(outcomeOfStatus)).toEqual(["passed", "passed", "passed"]);
        expect(outcomeOfStatus("REJECTED")).toBe("rejected");
        expect(outcomeOfStatus("CANCELLED")).toBe("cancelled");
    });
});

describe("depositRefunded: every policy x outcome", () => {
    it.each([
        ["ALWAYS", "passed", true], ["ALWAYS", "rejected", true], ["ALWAYS", "cancelled", true],
        ["ONLY_PASSED", "passed", true], ["ONLY_PASSED", "rejected", false], ["ONLY_PASSED", "cancelled", false],
        ["NEVER", "passed", false], ["NEVER", "rejected", false], ["NEVER", "cancelled", false],
    ] as const)("%s, %s -> %s", (policy: DaoDepositRefundPolicy, outcome, expected) => {
        expect(depositRefunded(policy, outcome)).toBe(expected);
    });
});

const rows = (status: DaoProposalStatus, config: Partial<PinnedConfig> | null = {}, outcome: Partial<ScanOutcome> | null = null, deposit: DaoCoin | null = {denom: "ubze", amount: "9000000"}) =>
    moneyRows({
        status,
        config: config === null ? null : {...CONFIG, ...config},
        deposit,
        outcome: outcome ? ({depositRefunded: null, depositDestination: null, ...outcome} as ScanOutcome) : null,
    }, fmt);
const table = (m: ReturnType<typeof moneyRows>) => m.rows.map((r) => [r.label, r.value]);

describe("moneyRows", () => {
    it("while voting: the deposit held by the module, what happens to it either way, and the cost", () => {
        const m = rows("VOTING");
        expect(table(m)).toEqual([
            ["Deposit", "9 BZE, held by the module"],
            ["If it passes", "Back to the proposer"],
            ["If it doesn't", "Burned"],
            ["Proposal cost", "5 BZE, sent to the DAO's treasury. Never refunded."],
        ]);
        expect(m.note).toBeNull();
        expect(table(rows("VOTING", {deposit_refund_policy: "NEVER", kept_deposit_destination: "TREASURY"})).slice(1, 3)).toEqual([
            ["If it passes", "Goes to the DAO's treasury"], ["If it doesn't", "Goes to the DAO's treasury"],
        ]);
        expect(table(rows("VOTING", {deposit_refund_policy: "ALWAYS", kept_deposit_destination: null})).slice(1, 3)).toEqual([
            ["If it passes", "Back to the proposer"], ["If it doesn't", "Back to the proposer"],
        ]);
    });

    it("a DAO that charges no cost says None next to a deposit", () => {
        expect(table(rows("VOTING", {proposal_cost: null})).at(-1)).toEqual(["Proposal cost", "None"]);
    });

    it("once decided: where the deposit went, by the policy (a failed execution still passed)", () => {
        expect(table(rows("EXECUTED"))).toContainEqual(["Where it went", "Back to the proposer"]);
        expect(table(rows("EXECUTION_FAILED"))).toContainEqual(["Where it went", "Back to the proposer"]);
        expect(table(rows("REJECTED"))).toContainEqual(["Where it went", "Burned"]);
        expect(table(rows("CANCELLED", {kept_deposit_destination: "TREASURY"}))).toContainEqual(["Where it went", "Went to the DAO's treasury"]);
        expect(table(rows("EXECUTED"))[0]).toEqual(["Deposit", "9 BZE"]);
    });

    it("Scan's record of the release comes first", () => {
        expect(table(rows("REJECTED", {}, {depositRefunded: true}))).toContainEqual(["Where it went", "Back to the proposer"]);
        expect(table(rows("REJECTED", {}, {depositRefunded: false, depositDestination: "bze1burnerxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}))).toContainEqual(["Where it went", "Kept, sent to bze1burner…xxxxxx"]);
        expect(rows("REJECTED", {}, {depositRefunded: false}).rows.find((r) => r.label === "Where it went")!.testId).toBe("deposit-released");
    });

    it("nothing to pay: one sentence", () => {
        expect(rows("VOTING", {proposal_cost: null}, null, null)).toEqual({rows: [], note: {text: "None: proposals in this DAO are free.", testId: "money-none"}});
        expect(rows("VOTING", null, null, null).note?.text).toBe("The cost and deposit of this proposal are not known.");
    });

    it("unknown rules are said to be unknown, never defaulted", () => {
        const m = rows("REJECTED", {deposit_refund_policy: null, kept_deposit_destination: null, cost_destination: null});
        expect(m.note?.testId).toBe("money-rules-unknown");
        expect(table(m)).toEqual([["Deposit", "9 BZE"], ["Proposal cost", "5 BZE. Never refunded."]]);
        expect(rows("VOTING", {kept_deposit_destination: null}).note?.testId).toBe("money-rules-unknown");
        expect(rows("VOTING", null).note?.testId).toBe("money-rules-unknown");
    });
});

describe("depositSentence", () => {
    const of = (status: DaoProposalStatus, config: Partial<PinnedConfig> = {}, outcome: Partial<ScanOutcome> | null = null) =>
        depositSentence({status, config: {...CONFIG, ...config}, deposit: {denom: "ubze", amount: "9000000"}, outcome: outcome ? ({depositRefunded: null, depositDestination: null, ...outcome} as ScanOutcome) : null}, fmt);

    it("where the deposit went, with the policy that sent it there", () => {
        expect(of("EXECUTED")).toBe("The 9 BZE deposit went back to the proposer.");
        expect(of("REJECTED", {kept_deposit_destination: "TREASURY"})).toBe("The 9 BZE deposit went to the treasury (only refunded if it passes).");
        expect(of("REJECTED")).toBe("The 9 BZE deposit was burned (only refunded if it passes).");
        expect(of("EXECUTED", {deposit_refund_policy: "NEVER"})).toBe("The 9 BZE deposit was burned (this DAO never refunds deposits).");
    });

    it("Scan's record first; a cancel adds that the cost is never refunded; nothing while it votes", () => {
        expect(of("REJECTED", {}, {depositRefunded: true})).toBe("The 9 BZE deposit went back to the proposer.");
        expect(of("CANCELLED", {kept_deposit_destination: "TREASURY"})).toBe("The 9 BZE deposit went to the treasury (only refunded if it passes). The cost is never refunded.");
        expect(of("VOTING")).toBe("");
        expect(of("REJECTED", {deposit_refund_policy: null})).toBe("");
    });
});
