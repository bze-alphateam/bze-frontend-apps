import {describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import type {TxFailureDetails, TxOptions, TxSuccessResponse} from "@bze/bze-ui-kit";
import {daoTxOptions} from "@bze/bze-ui-kit";
import type {DraftStorage} from "@/lib/propose/draft";
import {pendingKey, loadPending} from "@/lib/propose/pending";
import {useProposalSubmit, type ProposalSubmitDeps, type SignAndBroadcast} from "./useProposalSubmit";

const MSG = {typeUrl: "/bze.dao.MsgSubmitProposal", value: {}};
const HASH = "A".repeat(64);

const memory = (): DraftStorage & {data: Map<string, string>} => {
    const data = new Map<string, string>();
    return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)};
};

/** The hook with a node that knows nothing unless a test says so. */
const useIt = (sign: SignAndBroadcast, over: Partial<ProposalSubmitDeps> = {}) =>
    useProposalSubmit({sign, daoId: "4", storage: null, getTxLanding: async () => "notfound", fetchTxEvents: async () => [], readTimeoutMs: 50, ...over});

/** A signer that reports through the callbacks the way useTx does. */
const signer = (run: (o: TxOptions) => void | Promise<void>): SignAndBroadcast & ReturnType<typeof vi.fn> =>
    vi.fn(async (_msgs, options) => {
        await run(options!);
        return false;
    });

const refuse = (message: string, details: TxFailureDetails) => signer((o) => o.onFailure?.(message, details));

describe("useProposalSubmit", () => {
    it("signs one message with direct signing, the simulation required and no toasts", async () => {
        const sign = signer((o) => o.onSuccess?.({height: 5, txhash: "AB", code: 0}));
        const {result} = renderHook(() => useIt(sign));
        await act(async () => { await result.current.submit(MSG); });
        expect(sign).toHaveBeenCalledTimes(1);
        const [msgs, options] = sign.mock.calls[0];
        expect(msgs).toEqual([MSG]);
        expect(options).toMatchObject({...daoTxOptions, toasts: false});
    });

    it("done: the proposal id comes from the EventProposalSubmitted event", async () => {
        const res: TxSuccessResponse = {height: 5, txhash: "AB", code: 0, events: [{type: "bze.dao.EventProposalSubmitted", attributes: [{key: "id", value: '"31"'}]}]};
        const {result} = renderHook(() => useIt(signer((o) => o.onSuccess?.(res))));
        await act(async () => { await result.current.submit(MSG); });
        expect(result.current.state).toEqual({phase: "done", hash: "AB", proposalId: "31"});
    });

    it("done without the event still reports the hash", async () => {
        const {result} = renderHook(() => useIt(signer((o) => o.onSuccess?.({height: 5, txhash: "AB", code: 0}))));
        await act(async () => { await result.current.submit(MSG); });
        expect(result.current.state).toEqual({phase: "done", hash: "AB", proposalId: null});
    });

    it.each([
        ["1118", "Only this DAO's voters can submit proposals to it."],
        ["1120", "This DAO already has the most proposals open it allows."],
    ])("a simulation the chain refuses (%s): the mapped message is shown and nothing was signed", async (_code, message) => {
        const sign = refuse(message, {stage: "prepare", rawLog: "simulation failed"});
        const {result} = renderHook(() => useIt(sign));
        await act(async () => { await result.current.submit(MSG); });
        expect(result.current.state).toEqual({phase: "failed", message});
        // nothing broadcast, so sending again is allowed at once
        await act(async () => { await result.current.submit(MSG); });
        expect(sign).toHaveBeenCalledTimes(2);
    });

    it("a rejection in the wallet is a plain failure", async () => {
        const {result} = renderHook(() => useIt(refuse("Request rejected", {stage: "sign"})));
        await act(async () => { await result.current.submit(MSG); });
        expect(result.current.state).toEqual({phase: "failed", message: "Request rejected"});
    });

    it("a chain refusal after the broadcast keeps the hash and allows another try", async () => {
        const sign = refuse("message failed", {stage: "chain", txHash: "CD", code: 5});
        const {result} = renderHook(() => useIt(sign));
        await act(async () => { await result.current.submit(MSG); });
        expect(result.current.state).toEqual({phase: "failed", message: "message failed", hash: "CD"});
        await act(async () => { await result.current.submit(MSG); });
        expect(sign).toHaveBeenCalledTimes(2);
    });

    describe("a confirmation timeout: the transaction may still land", () => {
        const timeout = () => signer((o) => {
            o.onBroadcast?.("EF");
            o.onFailure?.("not found within timeout", {stage: "timeout", txHash: "EF"});
        });

        it("shows the hash and refuses a second submit until the user says it did not land", async () => {
            const sign = timeout();
            const {result} = renderHook(() => useIt(sign));
            await act(async () => { await result.current.submit(MSG); });
            expect(result.current.state).toEqual({phase: "unconfirmed", message: "not found within timeout", hash: "EF"});

            await act(async () => { await result.current.submit(MSG); });
            expect(sign).toHaveBeenCalledTimes(1);
            expect(result.current.state.phase).toBe("unconfirmed");

            act(() => result.current.allowResubmit());
            expect(result.current.state).toEqual({phase: "idle"});
            await act(async () => { await result.current.submit(MSG); });
            expect(sign).toHaveBeenCalledTimes(2);
        });

        it("an error after the broadcast without a chain code is just as uncertain", async () => {
            const sign = signer((o) => {
                o.onBroadcast?.("GH");
                o.onFailure?.("socket closed", {stage: "chain", txHash: "GH"});
            });
            const {result} = renderHook(() => useIt(sign));
            await act(async () => { await result.current.submit(MSG); });
            expect(result.current.state).toMatchObject({phase: "unconfirmed", hash: "GH"});
        });

        it("a timeout without a hash is still unconfirmed", async () => {
            const {result} = renderHook(() => useIt(refuse("timeout", {stage: "timeout"})));
            await act(async () => { await result.current.submit(MSG); });
            expect(result.current.state).toEqual({phase: "unconfirmed", message: "timeout", hash: null});
        });
    });

    it("a second click while the first is in flight sends nothing", async () => {
        let release: () => void = () => undefined;
        const sign = signer((o) => new Promise<void>((resolve) => { release = () => { o.onSuccess?.({height: 1, txhash: "AA", code: 0}); resolve(); }; }));
        const {result} = renderHook(() => useIt(sign));
        let first: Promise<void> = Promise.resolve();
        act(() => { first = result.current.submit(MSG); });
        expect(result.current.state).toEqual({phase: "working"});
        await act(async () => { await result.current.submit(MSG); });
        expect(sign).toHaveBeenCalledTimes(1);
        await act(async () => { release(); await first; });
        expect(result.current.state.phase).toBe("done");
    });

    it("done blocks a further submit", async () => {
        const sign = signer((o) => o.onSuccess?.({height: 1, txhash: "AA", code: 0}));
        const {result} = renderHook(() => useIt(sign));
        await act(async () => { await result.current.submit(MSG); });
        await act(async () => { await result.current.submit(MSG); });
        expect(sign).toHaveBeenCalledTimes(1);
    });

    describe("the proposal's id", () => {
        const event = {type: "bze.dao.EventProposalSubmitted", attributes: [{key: "id", value: '"41"'}]};

        it("is read from the node's copy of the transaction when the response carries no events", async () => {
            const fetchTxEvents = vi.fn(async () => [event]);
            const {result} = renderHook(() => useIt(signer((o) => o.onSuccess?.({height: 1, txhash: HASH, code: 0})), {fetchTxEvents}));
            await act(async () => { await result.current.submit(MSG); });
            expect(fetchTxEvents).toHaveBeenCalledWith(HASH);
            expect(result.current.state).toEqual({phase: "done", hash: HASH, proposalId: "41"});
        });

        it("a node that cannot be asked leaves the proposal created but unread, never a failure", async () => {
            const fetchTxEvents = vi.fn(async () => { throw new Error("down"); });
            const {result} = renderHook(() => useIt(signer((o) => o.onSuccess?.({height: 1, txhash: HASH, code: 0})), {fetchTxEvents}));
            await act(async () => { await result.current.submit(MSG); });
            expect(result.current.state).toEqual({phase: "done", hash: HASH, proposalId: null});
        });
    });

    describe("an unconfirmed transaction survives a reload", () => {
        const timeout = () => signer((o) => {
            o.onBroadcast?.(HASH);
            o.onFailure?.("not found within timeout", {stage: "timeout", txHash: HASH});
        });

        it("remembers the hash, comes back locked, and a node that saw it lands the proposal", async () => {
            const storage = memory();
            const first = renderHook(() => useIt(timeout(), {storage}));
            await act(async () => { await first.result.current.submit(MSG); });
            expect(loadPending(storage, "4")).toBe(HASH);
            first.unmount();

            const sign = signer(() => undefined);
            const getTxLanding = vi.fn(async () => "landed" as const);
            const fetchTxEvents = vi.fn(async () => [{type: "bze.dao.EventProposalSubmitted", attributes: [{key: "id", value: '"52"'}]}]);
            const reopened = renderHook(() => useIt(sign, {storage, getTxLanding, fetchTxEvents}));
            expect(reopened.result.current.state).toMatchObject({phase: "unconfirmed", hash: HASH});

            await act(async () => { await reopened.result.current.submit(MSG); });
            expect(sign).not.toHaveBeenCalled();

            await act(async () => { await reopened.result.current.check(); });
            expect(getTxLanding).toHaveBeenCalledWith(HASH);
            expect(reopened.result.current.state).toEqual({phase: "done", hash: HASH, proposalId: "52"});
            expect(storage.data.has(pendingKey("4"))).toBe(false);
        });

        it("a node that says the chain refused it frees the submit", async () => {
            const storage = memory();
            storage.setItem(pendingKey("4"), JSON.stringify({v: 1, hash: HASH}));
            const sign = signer((o) => o.onSuccess?.({height: 1, txhash: "B".repeat(64), code: 0}));
            const {result} = renderHook(() => useIt(sign, {storage, getTxLanding: async () => "failed"}));
            await act(async () => { await result.current.check(); });
            expect(result.current.state).toMatchObject({phase: "failed", hash: HASH});
            expect(storage.data.size).toBe(0);
            await act(async () => { await result.current.submit(MSG); });
            expect(sign).toHaveBeenCalledTimes(1);
        });

        it("a node that does not know it yet, or cannot be asked, keeps the lock and says so", async () => {
            const storage = memory();
            storage.setItem(pendingKey("4"), JSON.stringify({v: 1, hash: HASH}));
            let answer: () => Promise<"notfound"> = async () => "notfound";
            const {result} = renderHook(() => useIt(signer(() => undefined), {storage, getTxLanding: () => answer()}));
            await act(async () => { await result.current.check(); });
            expect(result.current.state).toMatchObject({phase: "unconfirmed", note: expect.stringContaining("does not know")});
            answer = async () => { throw new Error("down"); };
            await act(async () => { await result.current.check(); });
            expect(result.current.state).toMatchObject({phase: "unconfirmed", note: expect.stringContaining("could not be asked")});
            expect(loadPending(storage, "4")).toBe(HASH);
        });

        it("the user's word clears the memory", async () => {
            const storage = memory();
            storage.setItem(pendingKey("4"), JSON.stringify({v: 1, hash: HASH}));
            const {result} = renderHook(() => useIt(signer(() => undefined), {storage}));
            act(() => result.current.allowResubmit());
            expect(storage.data.size).toBe(0);
            expect(result.current.state).toEqual({phase: "idle"});
        });

        it("another DAO's pending transaction does not lock this one", () => {
            const storage = memory();
            storage.setItem(pendingKey("5"), JSON.stringify({v: 1, hash: HASH}));
            const {result} = renderHook(() => useIt(signer(() => undefined), {storage}));
            expect(result.current.state).toEqual({phase: "idle"});
        });

        it("a definite failure leaves nothing remembered", async () => {
            const storage = memory();
            const {result} = renderHook(() => useIt(refuse("message failed", {stage: "chain", txHash: HASH, code: 5}), {storage}));
            await act(async () => { await result.current.submit(MSG); });
            expect(storage.data.size).toBe(0);
        });
    });

    it("a signer that throws is a failure, and one that reports nothing is too", async () => {
        const throwing = vi.fn(async () => { throw new Error("boom"); });
        const a = renderHook(() => useIt(throwing));
        await act(async () => { await a.result.current.submit(MSG); });
        expect(a.result.current.state).toEqual({phase: "failed", message: "boom"});

        const silent = signer(() => undefined);
        const b = renderHook(() => useIt(silent));
        await act(async () => { await b.result.current.submit(MSG); });
        expect(b.result.current.state).toEqual({phase: "failed", message: "The transaction was not sent."});
    });

    it("broadcast without a verdict is unconfirmed", async () => {
        const sign = signer((o) => o.onBroadcast?.("ZZ"));
        const {result} = renderHook(() => useIt(sign));
        await act(async () => { await result.current.submit(MSG); });
        expect(result.current.state).toMatchObject({phase: "unconfirmed", hash: "ZZ"});
    });
});
