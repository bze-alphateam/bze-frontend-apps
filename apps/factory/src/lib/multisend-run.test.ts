import { describe, it, expect, beforeEach } from "vitest";
import { setInLocalStorage } from "@bze/bze-ui-kit";
import {
    MULTISEND_RUN_KEY,
    canSendBatch,
    clearMultiSendRun,
    isRunDone,
    listFingerprint,
    loadMultiSendRun,
    markBroadcast,
    markPending,
    markSending,
    markSent,
    markUnknown,
    nextBatch,
    planBatches,
    reportCsv,
    resumeState,
    saveMultiSendRun,
    sentCount,
    settleInterrupted,
    startRun,
} from "./multisend-run";
import type { Recipient } from "./multisend";

const recipients = (n: number, amount = "1000000"): Recipient[] =>
    Array.from({ length: n }, (_, i) => ({ address: `bze1w${i}`, amount }));

const run3 = () => startRun("fp", "utok", planBatches(recipients(250)), 1_000);

beforeEach(() => localStorage.clear());

describe("planBatches", () => {
    it.each([
        [1, [1]],
        [100, [100]],
        [101, [100, 1]],
        [5_000, Array.from({ length: 50 }, () => 100)],
    ])("%i wallets → batches of %j", (n, sizes) => {
        const batches = planBatches(recipients(n));
        expect(batches.map(b => b.outputs.length)).toEqual(sizes);
        expect(batches.map(b => b.id)).toEqual(sizes.map((_, i) => i + 1));
        // In list order, every wallet exactly once.
        expect(batches.flatMap(b => b.outputs.map(o => o.address))).toEqual(recipients(n).map(r => r.address));
    });

    it("an empty list has no batches", () => {
        expect(planBatches([])).toEqual([]);
    });
});

describe("listFingerprint", () => {
    it("is stable for the same list and changes with one amount, the order or the token", async () => {
        const list = recipients(3);
        const fp = await listFingerprint("utok", list);
        expect(fp).toMatch(/^[0-9a-f]{64}$/);
        expect(await listFingerprint("utok", recipients(3))).toBe(fp);

        const oneAmount = recipients(3);
        oneAmount[1] = { ...oneAmount[1], amount: "1000001" };
        expect(await listFingerprint("utok", oneAmount)).not.toBe(fp);
        expect(await listFingerprint("utok", [...list].reverse())).not.toBe(fp);
        expect(await listFingerprint("ubze", list)).not.toBe(fp);
    });
});

describe("run state", () => {
    it("starts with every batch pending, with its count and total", () => {
        const run = run3();
        expect(run).toMatchObject({ fingerprint: "fp", denom: "utok", startedAt: 1_000 });
        expect(run.batches).toEqual([
            { id: 1, count: 100, total: "100000000", status: "pending" },
            { id: 2, count: 100, total: "100000000", status: "pending" },
            { id: 3, count: 50, total: "50000000", status: "pending" },
        ]);
        expect(nextBatch(run)?.id).toBe(1);
    });

    it("pending → sending → sent", () => {
        let run = markSending(run3(), 1, "bze1me");
        expect(run.batches[0]).toMatchObject({ status: "sending", sender: "bze1me" });
        expect(nextBatch(run)?.id).toBe(2);
        run = markBroadcast(run, 1, "H1");
        expect(run.batches[0]).toMatchObject({ status: "sending", txHash: "H1" });
        run = markSent(run, 1, "H1");
        expect(run.batches[0]).toMatchObject({ status: "sent", txHash: "H1" });
        expect(sentCount(run)).toBe(1);
    });

    it("pending → sending → pending (rejected in the wallet)", () => {
        const run = markPending(markSending(run3(), 1, "bze1me"), 1);
        expect(run.batches[0]).toEqual({ id: 1, count: 100, total: "100000000", status: "pending" });
        expect(nextBatch(run)?.id).toBe(1);
    });

    it("pending → sending → unknown, and an unknown batch is not sendable until the check found nothing", () => {
        let run = markUnknown(markBroadcast(markSending(run3(), 1, "bze1me"), 1, "H1"), 1);
        expect(run.batches[0]).toMatchObject({ status: "unknown", txHash: "H1" });
        expect(canSendBatch(run.batches[0])).toBe(false);
        // Not offered as the next transaction, and markSending refuses it.
        expect(nextBatch(run)?.id).toBe(2);
        expect(markSending(run, 1, "bze1me")).toEqual(run);

        run = markUnknown(run, 1, true);
        expect(canSendBatch(run.batches[0])).toBe(true);
        run = markSending(run, 1, "bze1me");
        expect(run.batches[0]).toEqual({ id: 1, count: 100, total: "100000000", status: "sending", sender: "bze1me" });
    });

    it("a sent batch is final", () => {
        const sent = markSent(markSending(run3(), 1, "bze1me"), 1, "H1");
        expect(markSending(sent, 1, "bze1me")).toEqual(sent);
        expect(markPending(sent, 1)).toEqual(sent);
        expect(markUnknown(sent, 1)).toEqual(sent);
    });

    it("on load, a batch still sending (page closed) becomes unknown", () => {
        const run = settleInterrupted(markSending(run3(), 2, "bze1me"));
        expect(run.batches.map(b => b.status)).toEqual(["pending", "unknown", "pending"]);
    });

    it("is done when every batch is sent", () => {
        let run = run3();
        for (const id of [1, 2, 3]) run = markSent(markSending(run, id, "bze1me"), id, `H${id}`);
        expect(isRunDone(run)).toBe(true);
        expect(nextBatch(run)).toBeUndefined();
    });
});

describe("resumeState", () => {
    it("resumes the same list and asks before replacing a changed one", async () => {
        const list = recipients(150);
        const fp = await listFingerprint("utok", list);
        const run = startRun(fp, "utok", planBatches(list));

        expect(resumeState(undefined, fp)).toBe("none");
        expect(resumeState(run, undefined)).toBe("checking");
        expect(resumeState(run, await listFingerprint("utok", recipients(150)))).toBe("same");
        expect(resumeState(run, await listFingerprint("utok", recipients(151)))).toBe("changed");
    });
});

describe("reportCsv", () => {
    it("lists every wallet in display units with its batch status and hash", () => {
        const list: Recipient[] = [
            { address: "bze1a", amount: "1500000" },
            { address: "bze1b", amount: "2000000" },
            { address: "bze1c", amount: "1" },
            { address: "bze1d", amount: "3000000" },
        ];
        const batches = planBatches(list, 1);
        let run = startRun("fp", "utok", batches);
        run = markSent(markSending(run, 1, "bze1me"), 1, "H1");
        run = markUnknown(markSending(run, 2, "bze1me"), 2);
        run = markSending(run, 3, "bze1me");

        expect(reportCsv(run, batches, 6, "TOK")).toBe([
            "address,amount,ticker,status,tx_hash",
            "bze1a,1.5,TOK,sent,H1",
            "bze1b,2,TOK,check,",
            "bze1c,0.000001,TOK,check,",
            "bze1d,3,TOK,not sent,",
        ].join("\n") + "\n");
    });
});

describe("storage", () => {
    it("saves, loads and clears the one run", () => {
        const run = markBroadcast(markSending(run3(), 1, "bze1me"), 1, "H1");
        saveMultiSendRun(run);
        expect(loadMultiSendRun()).toEqual(run);
        clearMultiSendRun();
        expect(loadMultiSendRun()).toBeUndefined();
    });

    it("ignores a record it can't read", () => {
        setInLocalStorage(MULTISEND_RUN_KEY, "not json", 60);
        expect(loadMultiSendRun()).toBeUndefined();
        setInLocalStorage(MULTISEND_RUN_KEY, JSON.stringify({ fingerprint: "fp", denom: "utok", batches: [{ id: 1, status: "lost" }] }), 60);
        expect(loadMultiSendRun()).toBeUndefined();
    });
});
