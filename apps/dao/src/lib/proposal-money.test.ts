import {describe, expect, it} from "vitest";
import type {DaoCoin, DaoConfig, DaoDepositRefundPolicy, DaoProposalStatus} from "@bze/bze-ui-kit";
import {depositRefunded, describeMoney, outcomeOfStatus} from "./proposal-money";
import {CONFIG} from "./proposal-fixtures";
import type {ScanOutcome} from "./proposal-model";

const fmt = (c: DaoCoin) => `${Number(c.amount) / 1e6} ${c.denom === "ubze" ? "BZE" : c.denom}`;
const money = (status: DaoProposalStatus, config: Partial<DaoConfig> = {}, outcome: Partial<ScanOutcome> | null = null) =>
    describeMoney({
        status,
        config: {...CONFIG, ...config},
        deposit: {denom: "ubze", amount: "9000000"},
        outcome: outcome ? ({depositRefunded: null, depositDestination: null, ...outcome} as ScanOutcome) : null,
    }, fmt);

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

describe("describeMoney", () => {
    it("the cost: paid, where it went, never refunded; none when the DAO charges nothing", () => {
        expect(money("VOTING").cost).toBe("5 BZE paid when it was submitted, sent to the DAO's treasury. It is never refunded.");
        expect(money("VOTING", {proposal_cost: null, cost_destination: "BURN"}).cost).toBeNull();
        expect(money("VOTING", {proposal_cost: {denom: "ubze", amount: "5000000"}, cost_destination: "BURN"}).cost).toContain("burned");
    });

    it("while voting each policy says what will happen", () => {
        expect(money("VOTING", {deposit_refund_policy: "ALWAYS"}).depositRule).toBe("It is refunded to the proposer whatever the result.");
        expect(money("VOTING", {deposit_refund_policy: "ONLY_PASSED"}).depositRule).toBe("It is refunded only if the proposal passes; if it is rejected or cancelled it is kept and burned.");
        expect(money("VOTING", {deposit_refund_policy: "NEVER", kept_deposit_destination: "TREASURY"}).depositRule).toBe("It is never refunded: it is kept and sent to the DAO's treasury.");
    });

    it("after the result it says what did happen, per policy and outcome", () => {
        expect(money("EXECUTED", {deposit_refund_policy: "ONLY_PASSED"}).depositRule).toBe("It was refunded to the proposer.");
        expect(money("EXECUTION_FAILED", {deposit_refund_policy: "ONLY_PASSED"}).depositRule).toBe("It was refunded to the proposer.");
        expect(money("REJECTED", {deposit_refund_policy: "ONLY_PASSED"}).depositRule).toBe("It was kept (refunded only when a proposal passes) and burned.");
        expect(money("CANCELLED", {deposit_refund_policy: "ONLY_PASSED", kept_deposit_destination: "TREASURY"}).depositRule).toContain("sent to the DAO's treasury");
        expect(money("EXECUTED", {deposit_refund_policy: "NEVER"}).depositRule).toBe("It was kept (this DAO never refunds) and burned.");
        expect(money("REJECTED", {deposit_refund_policy: "ALWAYS"}).depositRule).toBe("It was refunded to the proposer.");
    });

    it("after the settle Scan's own record is shown", () => {
        expect(money("EXECUTED", {}, {depositRefunded: true}).released).toBe("Released at the settle: refunded to the proposer.");
        expect(money("REJECTED", {}, {depositRefunded: false, depositDestination: "bze1burnerxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}).released).toBe("Released at the settle: kept, sent to bze1burner…xxxxxx.");
        expect(money("VOTING", {}, {depositRefunded: null}).released).toBe("");
    });

    it("no deposit, or no pinned rules: no rule text", () => {
        const none = describeMoney({status: "EXECUTED", config: CONFIG, deposit: null, outcome: null}, fmt);
        expect(none.deposit).toBeNull();
        const unknown = describeMoney({status: "EXECUTED", config: null, deposit: {denom: "ubze", amount: "9000000"}, outcome: null}, fmt);
        expect(unknown.deposit).toContain("9 BZE");
        expect(unknown.depositRule).toBe("");
    });
});
