import {describe, expect, it, vi} from "vitest";
import {daoTxOptions, type TxFailureDetails, type TxOptions} from "@bze/bze-ui-kit";
import type {EncodeObject} from "@bze/bzejs/types";
import {cleanupBatchResult, createTxLookup, sendDaoTx, type SignAndSend} from "./dao-tx";

const MSGS: EncodeObject[] = [{typeUrl: "/bze.dao.MsgVote", value: {}}];

/** A `tx` that ends the way ui-kit's does: it calls onFailure (or onSuccess) and returns whether it was sent. */
const fake = (end: (o: TxOptions) => boolean): {tx: SignAndSend} => ({tx: vi.fn(async (_msgs: EncodeObject[], o?: TxOptions) => end(o ?? {}))});
const failing = (error: string, details: TxFailureDetails, hash?: string) => fake((o) => {
    if (hash) o.onBroadcast?.(hash);
    o.onFailure?.(error, details);
    return false;
});

describe("sendDaoTx", () => {
    it("always signs direct and aborts on a simulation error, with the toasts off", async () => {
        const {tx} = fake((o) => { o.onSuccess?.({height: 1, txhash: "H1", code: 0}); return true; });
        await sendDaoTx(tx, MSGS);
        expect(tx).toHaveBeenCalledWith(MSGS, expect.objectContaining({...daoTxOptions, toasts: false}));
    });

    it("returns the hash of a transaction the chain accepted", async () => {
        const {tx} = fake((o) => { o.onBroadcast?.("H1"); o.onSuccess?.({height: 1, txhash: "H1", code: 0}); return true; });
        expect(await sendDaoTx(tx, MSGS)).toMatchObject({ok: true, txHash: "H1"});
    });

    it("a simulation failure is the mapped reason at the prepare stage: nothing was broadcast, so it is not unconfirmed", async () => {
        const {tx} = failing("This proposal is already finished. Refresh the page.", {stage: "prepare", rawLog: "dao: the proposal is finished"});
        expect(await sendDaoTx(tx, MSGS)).toEqual({ok: false, stage: "prepare", error: "This proposal is already finished. Refresh the page.", txHash: undefined, unconfirmed: false});
    });

    it("a wallet that refuses is a failure that can be retried", async () => {
        const {tx} = failing("Request rejected", {stage: "sign"});
        expect(await sendDaoTx(tx, MSGS)).toMatchObject({ok: false, stage: "sign", unconfirmed: false});
    });

    it("a chain verdict (a code) is final, even with a hash", async () => {
        const {tx} = failing("Voting on this proposal is closed.", {stage: "chain", txHash: "H2", code: 1124}, "H2");
        expect(await sendDaoTx(tx, MSGS)).toMatchObject({ok: false, stage: "chain", txHash: "H2", unconfirmed: false});
    });

    it("a confirmation timeout may still land: unconfirmed, with its hash", async () => {
        const {tx} = failing("not found within timeout", {stage: "timeout", txHash: "H3"}, "H3");
        expect(await sendDaoTx(tx, MSGS)).toMatchObject({ok: false, stage: "timeout", txHash: "H3", unconfirmed: true});
    });

    it("an error after the broadcast without a chain verdict is unconfirmed too", async () => {
        const {tx} = failing("socket closed", {stage: "chain", txHash: "H4"}, "H4");
        expect(await sendDaoTx(tx, MSGS)).toMatchObject({unconfirmed: true, txHash: "H4"});
    });

    it("a tx that throws after the broadcast is unconfirmed; before it, not", async () => {
        const late: SignAndSend = async (_m, o) => { o?.onBroadcast?.("H5"); throw new Error("boom"); };
        expect(await sendDaoTx(late, MSGS)).toMatchObject({ok: false, unconfirmed: true, txHash: "H5", error: "boom"});
        const early: SignAndSend = async () => { throw new Error("no client"); };
        expect(await sendDaoTx(early, MSGS)).toMatchObject({ok: false, stage: "prepare", unconfirmed: false});
    });
});

describe("cleanupBatchResult", () => {
    const response = (events: unknown[]) => ({height: 1, txhash: "H", code: 0, events});
    const cleaned = (attrs: Record<string, string>) => response([{type: "message", attributes: []}, {type: "bze.dao.EventProposalCleaned", attributes: Object.entries(attrs).map(([key, value]) => ({key, value}))}]);

    it("reads completed and processed from the typed event (JSON values)", () => {
        expect(cleanupBatchResult(cleaned({id: '"7"', processed: '"100"', completed: "false"}))).toEqual({completed: false, processed: 100});
        expect(cleanupBatchResult(cleaned({id: '"7"', processed: '"3"', completed: "true"}))).toEqual({completed: true, processed: 3});
    });

    it("is null when the events are missing or not in that shape, never a guess", () => {
        expect(cleanupBatchResult(undefined)).toBeNull();
        expect(cleanupBatchResult(response([]))).toBeNull();
        expect(cleanupBatchResult({height: 1, txhash: "H", code: 0})).toBeNull();
        expect(cleanupBatchResult(cleaned({processed: '"3"'}))).toBeNull();
        expect(cleanupBatchResult(cleaned({completed: "maybe"}))).toBeNull();
    });
});

describe("createTxLookup", () => {
    const lookup = (status: number, body: unknown = null) => {
        const getJson = vi.fn(async () => ({status, body}));
        return {getJson, find: createTxLookup(() => "https://lcd.test/", getJson)};
    };

    it("asks the node's tx route for the hash", async () => {
        const {getJson, find} = lookup(200, {tx_response: {code: 0}});
        await find("AB12");
        expect(getJson).toHaveBeenCalledWith("https://lcd.test/cosmos/tx/v1beta1/txs/AB12");
    });

    it("code 0 is found and succeeded", async () => {
        expect(await lookup(200, {tx_response: {code: 0}}).find("H")).toEqual({state: "found", ok: true});
    });

    it("a refused transaction is found and failed, with the mapped reason", async () => {
        const out = await lookup(200, {tx_response: {code: 1124, raw_log: "failed to execute message; dao: the proposal is not open for voting"}}).find("H");
        expect(out).toMatchObject({state: "found", ok: false, error: expect.stringContaining("closed")});
    });

    it("only a 404 is missing", async () => {
        expect(await lookup(404).find("H")).toEqual({state: "missing"});
    });

    it("any other answer is an error, never 'missing'", async () => {
        await expect(lookup(500).find("H")).rejects.toThrow();
        await expect(lookup(200, {}).find("H")).rejects.toThrow();
        const failing = createTxLookup(() => "https://lcd.test", async () => { throw new Error("offline"); });
        await expect(failing("H")).rejects.toThrow("offline");
    });
});
