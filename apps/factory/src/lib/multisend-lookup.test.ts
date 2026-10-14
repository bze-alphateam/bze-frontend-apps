import { describe, it, expect, vi } from "vitest";
import { ChainTx, TxLookup, checkBatchOnChain, restTxLookup } from "./multisend-lookup";

const outputs = [
    { address: "bze1a", amount: "100" },
    { address: "bze1b", amount: "200" },
];
const chainOutputs = (denom = "utok", list = outputs) =>
    list.map(o => ({ address: o.address, coins: [{ denom, amount: o.amount }] }));
const chainTx = (txhash: string, code = 0, multiSends = [chainOutputs()]): ChainTx => ({ txhash, code, multiSends });

function fakeLookup(over: Partial<TxLookup> = {}): TxLookup {
    return {
        getTx: vi.fn(async () => null),
        recentMultiSends: vi.fn(async () => []),
        ...over,
    };
}

describe("checkBatchOnChain", () => {
    const batch = { sender: "bze1me", denom: "utok", outputs };

    it("finds a batch by its hash", async () => {
        const lookup = fakeLookup({ getTx: vi.fn(async () => chainTx("H1")) });
        expect(await checkBatchOnChain(lookup, { ...batch, txHash: "H1" })).toEqual({ result: "sent", txHash: "H1" });
        expect(lookup.getTx).toHaveBeenCalledWith("H1");
        expect(lookup.recentMultiSends).not.toHaveBeenCalled();
    });

    it("a hash that failed on chain can be sent again", async () => {
        const lookup = fakeLookup({ getTx: vi.fn(async () => chainTx("H1", 5)) });
        expect(await checkBatchOnChain(lookup, { ...batch, txHash: "H1" })).toEqual({ result: "failed" });
    });

    it("without a hash, matches the sender's recent multi-sends by the exact outputs", async () => {
        const lookup = fakeLookup({
            recentMultiSends: vi.fn(async () => [
                chainTx("OTHER", 0, [chainOutputs("utok", [outputs[0]])]),
                chainTx("WRONG_DENOM", 0, [chainOutputs("ubze")]),
                chainTx("FAILED", 7),
                chainTx("MINE"),
            ]),
        });
        expect(await checkBatchOnChain(lookup, batch)).toEqual({ result: "sent", txHash: "MINE" });
        expect(lookup.getTx).not.toHaveBeenCalled();
        expect(lookup.recentMultiSends).toHaveBeenCalledWith("bze1me");
    });

    it("falls back to the search when the node doesn't know the hash", async () => {
        const lookup = fakeLookup({ recentMultiSends: vi.fn(async () => [chainTx("MINE")]) });
        expect(await checkBatchOnChain(lookup, { ...batch, txHash: "H1" })).toEqual({ result: "sent", txHash: "MINE" });
    });

    it("reports not found when neither finds it", async () => {
        const lookup = fakeLookup({ recentMultiSends: vi.fn(async () => [chainTx("OTHER", 0, [chainOutputs("utok", [outputs[1], outputs[0]])])]) });
        expect(await checkBatchOnChain(lookup, { ...batch, txHash: "H1" })).toEqual({ result: "not-found" });
    });

    it("a node error is never 'not found'", async () => {
        const lookup = fakeLookup({ getTx: vi.fn(async () => { throw new Error("502"); }) });
        expect(await checkBatchOnChain(lookup, { ...batch, txHash: "H1" })).toEqual({ result: "error" });
    });
});

describe("restTxLookup", () => {
    const response = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

    it("reads a tx by hash and reports an unknown hash as null", async () => {
        const fetchFn = vi.fn(async (url: string) => url.endsWith("/H1")
            ? response(200, {
                tx: { body: { messages: [{ "@type": "/cosmos.bank.v1beta1.MsgMultiSend", inputs: [], outputs: chainOutputs() }] } },
                tx_response: { txhash: "H1", code: 0 },
            })
            : response(404, { code: 5, message: "tx not found" }));
        const lookup = restTxLookup("https://rest.test/", fetchFn);

        expect(await lookup.getTx("H1")).toEqual(chainTx("H1"));
        expect(fetchFn).toHaveBeenCalledWith("https://rest.test/cosmos/tx/v1beta1/txs/H1");
        expect(await lookup.getTx("NOPE")).toBeNull();
    });

    it("throws on node errors", async () => {
        const lookup = restTxLookup("https://rest.test", async () => response(502));
        await expect(lookup.getTx("H1")).rejects.toThrow("HTTP 502");
        await expect(lookup.recentMultiSends("bze1me")).rejects.toThrow("HTTP 502");
    });

    it("searches the sender's multi-sends with the SDK 0.50 query form, newest first", async () => {
        const fetchFn = vi.fn(async () => response(200, {
            txs: [
                { body: { messages: [{ "@type": "/cosmos.bank.v1beta1.MsgMultiSend", outputs: chainOutputs() }] } },
                { body: { messages: [{ "@type": "/cosmos.bank.v1beta1.MsgSend" }] } },
            ],
            tx_responses: [{ txhash: "A", code: 0 }, { txhash: "B", code: 3 }],
        }));
        const lookup = restTxLookup("https://rest.test", fetchFn);

        expect(await lookup.recentMultiSends("bze1me")).toEqual([chainTx("A"), { txhash: "B", code: 3, multiSends: [] }]);
        const url = new URL((fetchFn.mock.calls[0] as unknown as [string])[0]);
        expect(url.pathname).toBe("/cosmos/tx/v1beta1/txs");
        expect(url.searchParams.get("query")).toBe("message.sender='bze1me' AND message.action='/cosmos.bank.v1beta1.MsgMultiSend'");
        expect(url.searchParams.get("order_by")).toBe("2");
        expect(url.searchParams.get("limit")).toBe("20");
    });
});
