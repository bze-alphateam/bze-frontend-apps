import {describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import type {EncodeObject} from "@bze/bzejs/types";
import {useActionFlow, type ActionFlowDeps} from "./useActionFlow";
import {sendDaoTx, type SignAndSend, type TxLookup, type TxOutcome} from "@/lib/dao-tx";

const MSGS: EncodeObject[] = [{typeUrl: "/bze.dao.MsgSettleProposal", value: {}}];
const OK: TxOutcome = {ok: true, txHash: "H1"};

const setup = (over: Partial<ActionFlowDeps> = {}) => {
    const deps: ActionFlowDeps = {
        send: vi.fn(async () => OK),
        refresh: vi.fn(async () => "ok" as const),
        isGone: vi.fn(async () => false),
        fingerprint: () => "VOTING|1|0|0",
        lookupTx: vi.fn(async (): Promise<TxLookup> => ({state: "missing"})),
        ...over,
    };
    return {deps, hook: renderHook(() => useActionFlow(deps))};
};

describe("useActionFlow", () => {
    it("sends, re-reads the proposal, and says it is sent", async () => {
        const {deps, hook} = setup();
        await act(async () => { await hook.result.current.run("settle", MSGS); });

        expect(deps.send).toHaveBeenCalledWith(MSGS);
        expect(deps.refresh).toHaveBeenCalledTimes(1);
        expect(hook.result.current.state).toEqual({phase: "sent", kind: "settle", txHash: "H1", reread: "ok", batches: 0});
        expect(hook.result.current.locked).toBe(false);
    });

    it("a failed re-read keeps the actions locked until the proposal has been read again", async () => {
        let result: "ok" | "failed" = "failed";
        const {hook} = setup({refresh: async () => result});
        await act(async () => { await hook.result.current.run("vote", MSGS); });
        expect(hook.result.current.locked).toBe(true);

        result = "ok";
        await act(async () => { await hook.result.current.recheck(); });
        expect(hook.result.current.locked).toBe(false);
        expect(hook.result.current.state).toMatchObject({phase: "sent", reread: "ok"});
    });

    it("a simulation failure (reported at the prepare stage with the DAO sign options) shows the mapped reason and reopens the actions", async () => {
        // ui-kit's useTx test proves nothing is signed or broadcast on a simulation failure with abortOnSimulationError;
        // here the mocked `tx` ends the way it does (reports at the prepare stage) and the flow must show the reason
        const tx: SignAndSend = async (_msgs, options) => {
            expect(options).toMatchObject({useDirectSign: true, abortOnSimulationError: true});
            options?.onFailure?.("This proposal is already finished. Refresh the page.", {stage: "prepare"});
            return false;
        };
        const {deps, hook} = setup({send: (msgs) => sendDaoTx(tx, msgs)});
        await act(async () => { await hook.result.current.run("settle", MSGS); });

        expect(hook.result.current.state).toEqual({phase: "failed", kind: "settle", error: "This proposal is already finished. Refresh the page.", batches: 0});
        expect(hook.result.current.locked).toBe(false);
        expect(deps.refresh).not.toHaveBeenCalled();
    });

    it("a confirmation timeout locks the actions with the hash, refuses a second send, and 'check again' reopens them", async () => {
        const send = vi.fn(async (): Promise<TxOutcome> => ({ok: false, stage: "timeout", error: "slow", txHash: "H9", unconfirmed: true}));
        const {hook} = setup({send});
        await act(async () => { await hook.result.current.run("vote", MSGS); });

        expect(hook.result.current.state).toMatchObject({phase: "unconfirmed", txHash: "H9"});
        expect(hook.result.current.locked).toBe(true);

        await act(async () => { await hook.result.current.run("vote", MSGS); });
        expect(send).toHaveBeenCalledTimes(1);

        await act(async () => { await hook.result.current.recheck(); });
        // the proposal reads fine but shows nothing new and the node does not know the hash: open again, at the user's risk
        expect(hook.result.current.state).toEqual({phase: "rechecked", kind: "vote", txHash: "H9"});
        expect(hook.result.current.locked).toBe(false);
    });

    describe("check again after a confirmation timeout", () => {
        const timeout = async (): Promise<TxOutcome> => ({ok: false, stage: "timeout", error: "slow", txHash: "H9", unconfirmed: true});
        const timedOut = async (over: Partial<ActionFlowDeps>, kind: "settle" | "vote" = "settle") => {
            const made = setup({send: timeout, ...over});
            await act(async () => { await made.hook.result.current.run(kind, MSGS); });
            await act(async () => { await made.hook.result.current.recheck(); });
            return made;
        };

        it("a proposal read that shows nothing new does not reopen the actions: the transaction is looked up", async () => {
            const {deps, hook} = await timedOut({});
            expect(deps.lookupTx).toHaveBeenCalledWith("H9");
            // not found yet: open again, saying so
            expect(hook.result.current.state).toEqual({phase: "rechecked", kind: "settle", txHash: "H9"});
        });

        it("the proposal moved as the action moves it: done, without asking the node", async () => {
            let status = "VOTING|1|0|0";
            const {deps, hook} = setup({send: timeout, fingerprint: () => status, refresh: async () => { status = "EXECUTED|1|0|0"; return "ok" as const; }});
            await act(async () => { await hook.result.current.run("settle", MSGS); });
            await act(async () => { await hook.result.current.recheck(); });
            expect(hook.result.current.state).toMatchObject({phase: "sent", kind: "settle", txHash: "H9", reread: "ok"});
            expect(deps.lookupTx).not.toHaveBeenCalled();
        });

        it("a vote is judged by the transaction, not by a tally other voters move too", async () => {
            let tally = "VOTING|1|0|0";
            const lookupTx = vi.fn(async (): Promise<TxLookup> => ({state: "missing"}));
            const {hook} = setup({send: timeout, lookupTx, fingerprint: () => tally, refresh: async () => { tally = "VOTING|2|0|0"; return "ok" as const; }});
            await act(async () => { await hook.result.current.run("vote", MSGS); });
            await act(async () => { await hook.result.current.recheck(); });
            expect(lookupTx).toHaveBeenCalled();
            expect(hook.result.current.state.phase).toBe("rechecked");
        });

        it("found and succeeded: sent", async () => {
            const {hook} = await timedOut({lookupTx: async () => ({state: "found", ok: true})});
            expect(hook.result.current.state).toMatchObject({phase: "sent", txHash: "H9", reread: "ok"});
            expect(hook.result.current.locked).toBe(false);
        });

        it("found and failed: the mapped error, actions open", async () => {
            const {hook} = await timedOut({lookupTx: async () => ({state: "found", ok: false, error: "Voting on this proposal is closed."})});
            expect(hook.result.current.state).toMatchObject({phase: "failed", error: "Voting on this proposal is closed."});
            expect(hook.result.current.locked).toBe(false);
        });

        it("a node that cannot be read keeps the lock and says so", async () => {
            const {hook} = await timedOut({lookupTx: async () => { throw new Error("down"); }});
            expect(hook.result.current.state).toMatchObject({phase: "unconfirmed", note: expect.stringMatching(/could not be asked/)});
            expect(hook.result.current.locked).toBe(true);
        });

        it("a proposal that cannot be read keeps the lock and never asks the node", async () => {
            const {deps, hook} = await timedOut({refresh: async () => "failed"});
            expect(hook.result.current.state).toMatchObject({phase: "unconfirmed", note: expect.stringMatching(/could not be read/)});
            expect(deps.lookupTx).not.toHaveBeenCalled();
        });
    });

    it("a check that cannot read the chain keeps the lock", async () => {
        const send = async (): Promise<TxOutcome> => ({ok: false, stage: "timeout", error: "slow", txHash: "H9", unconfirmed: true});
        const {hook} = setup({send, refresh: async () => "failed"});
        await act(async () => { await hook.result.current.run("vote", MSGS); });
        await act(async () => { await hook.result.current.recheck(); });
        expect(hook.result.current.locked).toBe(true);
    });

    it("ignores a second click while one transaction is being signed", async () => {
        let release: (o: TxOutcome) => void = () => undefined;
        const send = vi.fn(() => new Promise<TxOutcome>((resolve) => { release = resolve; }));
        const {hook} = setup({send});
        let first: Promise<void> = Promise.resolve();
        act(() => { first = hook.result.current.run("settle", MSGS); });
        await act(async () => { await hook.result.current.run("settle", MSGS); });
        expect(send).toHaveBeenCalledTimes(1);
        await act(async () => { release(OK); await first; });
        expect(hook.result.current.state.phase).toBe("sent");
    });

    it("cleans up in batches until the chain no longer has the proposal, then re-reads it", async () => {
        const gone = [false, true];
        const {deps, hook} = setup({isGone: async () => gone.shift()!, refresh: vi.fn(async () => "gone" as const)});
        await act(async () => { await hook.result.current.runCleanup(MSGS[0]); });

        expect(deps.send).toHaveBeenCalledTimes(2);
        expect(deps.refresh).toHaveBeenCalledTimes(1);
        expect(hook.result.current.state).toMatchObject({phase: "sent", kind: "cleanup", batches: 2});
    });

    it("a clean-up whose chain cannot be read afterwards stops locked and says so, never 'done'", async () => {
        const {hook} = setup({isGone: async () => { throw new Error("down"); }});
        await act(async () => { await hook.result.current.runCleanup(MSGS[0]); });
        expect(hook.result.current.state).toMatchObject({phase: "unconfirmed", kind: "cleanup", batches: 1});
        expect(hook.result.current.locked).toBe(true);
    });

    it("a refused clean-up batch reopens the actions and says how many went through", async () => {
        const outcomes: TxOutcome[] = [OK, {ok: false, stage: "chain", error: "refused", txHash: "H2", unconfirmed: false}];
        const {hook} = setup({send: async () => outcomes.shift()!});
        await act(async () => { await hook.result.current.runCleanup(MSGS[0]); });
        expect(hook.result.current.state).toMatchObject({phase: "failed", kind: "cleanup", batches: 1, error: "refused"});
        expect(hook.result.current.locked).toBe(false);
    });
});
