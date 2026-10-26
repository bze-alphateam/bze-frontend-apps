import { describe, it, expect, vi } from "vitest";
import { TxReader, checkTxStatus, restTxReader } from "./tx-lookup";

const response = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function fakeReader(getTx: TxReader["getTx"]): TxReader {
    return { getTx: vi.fn(getTx), searchTxs: vi.fn(async () => []) };
}

describe("restTxReader", () => {
    it("reads a tx by hash with its height and raw log, and an unknown hash as null", async () => {
        const fetchFn = vi.fn(async (url: string) => url.endsWith("/H1")
            ? response(200, {
                tx: { body: { messages: [{ "@type": "/bze.tokenfactory.MsgMint" }] } },
                tx_response: { txhash: "H1", code: 5, height: "1234", raw_log: "insufficient funds" },
            })
            : response(404));
        const reader = restTxReader("https://rest.test/", fetchFn);

        expect(await reader.getTx("H1")).toEqual({
            txhash: "H1", code: 5, height: 1234, rawLog: "insufficient funds",
            messages: [{ "@type": "/bze.tokenfactory.MsgMint" }],
        });
        expect(fetchFn).toHaveBeenCalledWith("https://rest.test/cosmos/tx/v1beta1/txs/H1");
        expect(await reader.getTx("NOPE")).toBeNull();
    });

    it("throws on node errors", async () => {
        const reader = restTxReader("https://rest.test", async () => response(502));
        await expect(reader.getTx("H1")).rejects.toThrow("HTTP 502");
        await expect(reader.searchTxs("x", 5)).rejects.toThrow("HTTP 502");
    });

    it("searches with the SDK 0.50 query form, newest first", async () => {
        const fetchFn = vi.fn(async () => response(200, { txs: [{}], tx_responses: [{ txhash: "A", code: 0, height: "7" }] }));
        const reader = restTxReader("https://rest.test", fetchFn);

        expect(await reader.searchTxs("message.sender='bze1me'", 5)).toEqual([{ txhash: "A", code: 0, height: 7, rawLog: undefined, messages: [] }]);
        const url = new URL((fetchFn.mock.calls[0] as unknown as [string])[0]);
        expect(url.searchParams.get("query")).toBe("message.sender='bze1me'");
        expect(url.searchParams.get("order_by")).toBe("2");
        expect(url.searchParams.get("limit")).toBe("5");
    });
});

describe("checkTxStatus", () => {
    it("confirmed with its block", async () => {
        const reader = fakeReader(async () => ({ txhash: "H1", code: 0, height: 99, messages: [] }));
        expect(await checkTxStatus(reader, "H1")).toEqual({ result: "confirmed", txHash: "H1", height: 99 });
    });

    it("failed with the chain's raw log", async () => {
        const reader = fakeReader(async () => ({ txhash: "H1", code: 11, height: 99, rawLog: "out of gas", messages: [] }));
        expect(await checkTxStatus(reader, "H1")).toEqual({ result: "failed", txHash: "H1", height: 99, rawLog: "out of gas" });
    });

    it("not found while the node doesn't know the hash", async () => {
        expect(await checkTxStatus(fakeReader(async () => null), "H1")).toEqual({ result: "not-found" });
    });

    it("a node error is never 'not found'", async () => {
        expect(await checkTxStatus(fakeReader(async () => { throw new Error("502"); }), "H1")).toEqual({ result: "error" });
    });
});
