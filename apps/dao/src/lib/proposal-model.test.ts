import {describe, expect, it} from "vitest";
import {configFromScan, modelFromChain, modelFromScan, rowFromChain, rowFromScan, statusFromScan} from "./proposal-model";
import {CONFIG, PROPOSAL, RESPONSE, SCAN} from "@/test/proposal-fixtures";

describe("statusFromScan", () => {
    it("reads Scan's lower-case names, null for a placeholder or an unknown one", () => {
        expect(statusFromScan("execution_failed")).toBe("EXECUTION_FAILED");
        expect(statusFromScan("voting")).toBe("VOTING");
        expect(statusFromScan(null)).toBeNull();
        expect(statusFromScan("deposit_period")).toBeNull();
    });
});

describe("modelFromChain", () => {
    it("takes the live flags, the pinned rules and the tally from the chain", () => {
        const model = modelFromChain({...RESPONSE, voting_ended: true}, null, "Stakers club", "DAO_TYPE_STAKE");
        expect(model).toMatchObject({
            id: "7", daoId: "4", daoName: "Stakers club", status: "VOTING", archived: false, votingEnded: true,
            tally: {denominator: "1000", yes: "300", no: "100", abstain: "50"}, config: CONFIG, deposit: PROPOSAL.pinned_deposit, outcome: null,
            submitTime: "2026-10-27T11:20:00.000Z", votingEnd: "2026-10-30T11:20:00.000Z", submitHeight: "100",
        });
    });

    it("the retry deadline only for a failed execution", () => {
        const failed = {...RESPONSE, proposal: {...PROPOSAL, status: "EXECUTION_FAILED" as const}, retry_deadline: "1794000000"};
        expect(modelFromChain(failed, null, null, null).retryDeadline).toBe("2026-11-06T21:20:00.000Z");
        expect(modelFromChain({...failed, retry_deadline: "0"}, null, null, null).retryDeadline).toBeNull();
        expect(modelFromChain({...RESPONSE, retry_deadline: "1794000000"}, null, null, null).retryDeadline).toBeNull();
    });

    it("adds what Scan knows and falls back to its DAO name", () => {
        const model = modelFromChain(RESPONSE, SCAN, null, null);
        expect(model.daoName).toBe("Stakers club");
        expect(model.outcome).toMatchObject({settledHeight: 2000, executed: true, depositRefunded: true, votesCount: 2});
    });
});

describe("modelFromScan (the archived proposal)", () => {
    it("is marked archived and carries the pinned rules, tally and deposit Scan kept", () => {
        const model = modelFromScan({...SCAN, msgs: [{"@type": "/cosmos.bank.v1beta1.MsgSend"}, "junk", {no: "type"}], cleaned_height: 9000})!;
        expect(model).toMatchObject({
            id: "7", archived: true, status: "EXECUTED", daoName: "Stakers club", daoType: "DAO_TYPE_STAKE", votingEnded: false, expediteSettleable: false,
            tally: {denominator: "1000", yes: "700", no: "100", abstain: "0"}, deposit: {denom: "ubze", amount: "9000000"},
            submitTime: "2026-10-27T10:00:00Z", submitHeight: "100", msgs: [{"@type": "/cosmos.bank.v1beta1.MsgSend"}],
        });
        expect(model.config?.min_quorum).toBe("0.400000000000000000");
        expect(model.outcome?.cleanedHeight).toBe(9000);
    });

    it("a placeholder row (no status or no submission) is not a proposal", () => {
        expect(modelFromScan({...SCAN, status: null})).toBeNull();
        expect(modelFromScan({...SCAN, title: null, proposer: null})).toBeNull();
    });

    it("keeps no bars when the pinned config or tally are missing", () => {
        const model = modelFromScan({...SCAN, pinned_config: null, yes: null})!;
        expect(model.config).toBeNull();
        expect(model.tally).toBeNull();
        expect(model.deposit).toBeNull();
    });
});

describe("configFromScan", () => {
    it("an unknown or missing refund policy or destination is unknown (null), not a default", () => {
        const raw = {min_quorum: "0.4", threshold: "0.5", deposit_refund_policy: "SOMETIMES", cost_destination: "MOON"};
        expect(configFromScan(raw)).toMatchObject({deposit_refund_policy: null, cost_destination: null, kept_deposit_destination: null});
        expect(configFromScan({...raw, deposit_refund_policy: "NEVER", cost_destination: "TREASURY", kept_deposit_destination: "BURN"}))
            .toMatchObject({deposit_refund_policy: "NEVER", cost_destination: "TREASURY", kept_deposit_destination: "BURN"});
    });

    it("reads snake_case and camelCase, and refuses a config without ratios", () => {
        expect(configFromScan({minQuorum: "0.4", threshold: "0.5", depositRefundPolicy: "x"})).toMatchObject({min_quorum: "0.4", threshold: "0.5", deposit_refund_policy: null});
        expect(configFromScan({threshold: "0.5"})).toBeNull();
        expect(configFromScan(null)).toBeNull();
    });
});

describe("rows", () => {
    it("a Scan list item and a chain proposal become the same row; a placeholder is dropped", () => {
        expect(rowFromScan({id: 7, dao_id: 4, title: "T", status: "voting", proposer: "bze1p", proposer_label: null, expedited: true, submit_time: null, voting_end: "2026-11-01T00:00:00Z", yes: "1", no: "0", abstain: "0", denominator: "2", settled_height: null, message_types: []}))
            .toEqual({id: "7", title: "T", status: "VOTING", proposer: "bze1p", votingEnd: "2026-11-01T00:00:00Z", expedited: true, tally: {denominator: "2", yes: "1", no: "0", abstain: "0"}});
        expect(rowFromScan({...SCAN, status: null})).toBeNull();
        expect(rowFromChain(PROPOSAL)).toMatchObject({id: "7", status: "VOTING", votingEnd: "2026-10-30T11:20:00.000Z", tally: {denominator: "1000"}});
    });
});
