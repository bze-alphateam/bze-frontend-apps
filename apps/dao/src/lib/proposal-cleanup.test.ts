import {describe, expect, it, vi} from "vitest";
import {cleanupProposal} from "./proposal-cleanup";
import type {TxOutcome} from "./dao-tx";

const OK: TxOutcome = {ok: true, txHash: "AB"};
const cleaned = (completed: boolean, processed: number): TxOutcome => ({
    ok: true,
    txHash: "AB",
    response: {height: 1, txhash: "AB", code: 0, events: [{type: "bze.dao.EventProposalCleaned", attributes: [{key: "id", value: '"7"'}, {key: "processed", value: `"${processed}"`}, {key: "completed", value: String(completed)}]}]},
});
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

    it("follows the chain's own `completed` from the batch events, with the ballots deleted so far, without asking the chain", async () => {
        const outcomes = [cleaned(false, 100), cleaned(false, 100), cleaned(true, 40)];
        const isGone = vi.fn(async () => false);
        const onProgress = vi.fn();
        const result = await cleanupProposal({sendBatch: async () => outcomes.shift()!, isGone, onProgress});

        expect(result).toEqual({state: "completed", batches: 3});
        expect(onProgress.mock.calls).toEqual([[1, 100], [2, 200], [3, 240]]);
        expect(isGone).not.toHaveBeenCalled();
    });

    it("stops when a batch says it is not finished but deleted nothing, instead of asking for up to 500 signatures", async () => {
        const sendBatch = vi.fn(async () => cleaned(false, 0));
        const result = await cleanupProposal({sendBatch, isGone: async () => false});
        expect(result).toEqual({state: "stopped", batches: 1, reason: "no-progress"});
        expect(sendBatch).toHaveBeenCalledTimes(1);
    });

    it("a batch that deleted something and is not finished goes on", async () => {
        const outcomes = [cleaned(false, 1), cleaned(true, 1)];
        expect(await cleanupProposal({sendBatch: async () => outcomes.shift()!, isGone: async () => false})).toEqual({state: "completed", batches: 2});
    });

    it("falls back to the chain when the events are not in the answer", async () => {
        const isGone = vi.fn(async () => true);
        const noEvents: TxOutcome = {ok: true, txHash: "AB", response: {height: 1, txhash: "AB", code: 0, events: []}};
        expect(await cleanupProposal({sendBatch: async () => noEvents, isGone})).toEqual({state: "completed", batches: 1});
        expect(isGone).toHaveBeenCalledTimes(1);
    });

    it("a refused batch asks the chain once: someone else may have finished the clean-up", async () => {
        const result = await cleanupProposal({sendBatch: async () => refused, isGone: async () => true});
        expect(result).toEqual({state: "completed", batches: 0});
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
