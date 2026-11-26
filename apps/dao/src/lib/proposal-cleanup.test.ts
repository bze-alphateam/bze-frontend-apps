import {describe, expect, it, vi} from "vitest";
import {cleanupProposal} from "./proposal-cleanup";
import type {TxOutcome} from "./dao-tx";

const OK: TxOutcome = {ok: true, txHash: "AB"};
const refused: TxOutcome = {ok: false, stage: "chain", error: "refused", txHash: "CD", unconfirmed: false};
const timeout: TxOutcome = {ok: false, stage: "timeout", error: "slow", txHash: "EF", unconfirmed: true};

describe("cleanupProposal", () => {
    it("sends batches until the chain no longer has the proposal, reporting progress", async () => {
        const sendBatch = vi.fn(async () => OK);
        const gone = [false, false, true];
        const onProgress = vi.fn();
        const result = await cleanupProposal({sendBatch, isGone: async () => gone.shift()!, onProgress});

        expect(result).toEqual({state: "completed", batches: 3});
        expect(sendBatch).toHaveBeenCalledTimes(3);
        expect(onProgress.mock.calls.map(([n]) => n)).toEqual([1, 2, 3]);
    });

    it("stops at a refused batch and keeps the count of the ones that went through", async () => {
        const outcomes = [OK, refused];
        const result = await cleanupProposal({sendBatch: async () => outcomes.shift()!, isGone: async () => false});
        expect(result).toEqual({state: "stopped", batches: 1, reason: "tx", outcome: refused});
    });

    it("stops at a batch whose fate is unknown and hands the outcome over, without sending another", async () => {
        const sendBatch = vi.fn(async () => timeout);
        const result = await cleanupProposal({sendBatch, isGone: async () => false});
        expect(result).toMatchObject({state: "stopped", reason: "tx", outcome: {unconfirmed: true, txHash: "EF"}});
        expect(sendBatch).toHaveBeenCalledTimes(1);
    });

    it("a chain that cannot be read is 'unreadable', never 'done' and never another batch", async () => {
        const sendBatch = vi.fn(async () => OK);
        const result = await cleanupProposal({sendBatch, isGone: async () => { throw new Error("down"); }});
        expect(result).toEqual({state: "stopped", batches: 1, reason: "unreadable"});
        expect(sendBatch).toHaveBeenCalledTimes(1);
    });

    it("gives up after the limit instead of looping for ever", async () => {
        const result = await cleanupProposal({sendBatch: async () => OK, isGone: async () => false, maxBatches: 4});
        expect(result).toEqual({state: "stopped", batches: 4, reason: "limit"});
    });
});
