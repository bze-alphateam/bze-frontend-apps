import React from "react";
import {describe, expect, it, vi} from "vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

import {MSG, type ScanClient, ScanError, type ScanPage, type ScanTransfer, type ScanTx} from "@/lib/token-activity";

import {ScanClientProvider} from "./scan-client";
import {useTokenActivity} from "./useTokenActivity";

const DENOM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const TOKEN = {denom: DENOM, symbol: "NOAD", exponent: 6};
const TRADER = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const DEX = "bze18mhtjwczlzqqgvw84uz8lrdv4hqule3jp8allp";

const hash = (n: number) => n.toString(16).toUpperCase().padStart(64, "0");

const move = (n: number, over: Partial<ScanTransfer> = {}): ScanTransfer => ({
    height: 1000 - n, tx_index: 0, tx_hash: hash(n), time: "2026-11-05T21:09:16Z", seq: 1, msg_index: 0,
    msg_type: MSG.multiSwap, kind: "transfer", sender: TRADER, sender_label: null, recipient: DEX,
    recipient_label: {name: "DEX", kind: "module"}, denom: DENOM, amount: "10000000", symbol: "NOAD", exponent: 6, ...over,
});

const blockRow = (n: number): ScanTransfer => move(n, {tx_hash: null, tx_index: -1, msg_index: null, msg_type: null});

const txOf = (txHash: string): ScanTx => ({
    height: 1, tx_index: 0, hash: txHash, time: "", success: true, msg_count: 1, msg_types: [], fee: [{denom: "ubze", amount: "3823"}],
    signer: TRADER, signers: [TRADER], fee_payer: TRADER, memo: null, code: 0, error_log: null, gas_wanted: 0, gas_used: 0, messages: [],
    transfers: [{seq: 0, msg_index: null, kind: "transfer", sender: TRADER, sender_label: null, recipient: "bze1fee", recipient_label: null, denom: "ubze", amount: "3823", symbol: "BZE", exponent: 6}],
    dex: null, ibc_transfers: null,
});

/** A mock client serving `pages` of transfers in order (by cursor "1", "2"…). */
function mockClient(pages: (ScanPage<ScanTransfer> | Error)[]): ScanClient & { tokenTransfers: ReturnType<typeof vi.fn> } {
    const tokenTransfers = vi.fn(async (_denom: string, params?: { cursor?: string | null }) => {
        const page = pages[params?.cursor ? Number(params.cursor) : 0];
        if (page instanceof Error) throw page;
        return page;
    });

    return {
        tokenTransfers,
        tx: vi.fn(async (txHash: string) => txOf(txHash)),
        token: vi.fn(), tokenEvents: vi.fn(), tokenHolders: vi.fn(), account: vi.fn(), accountActivity: vi.fn(), modules: vi.fn(),
    } as unknown as ScanClient & { tokenTransfers: ReturnType<typeof vi.fn> };
}

function render(client: ScanClient, rows = 5) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false, retryDelay: 0}}});
    const wrapper = ({children}: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ScanClientProvider client={client}>{children}</ScanClientProvider>
        </QueryClientProvider>
    );

    return renderHook(() => useTokenActivity(TOKEN, {rows}), {wrapper});
}

describe("useTokenActivity", () => {
    it("shows rows at once, then fills each fee in from its transaction", async () => {
        const client = mockClient([{items: [move(1), move(2)], next_cursor: null}]);
        const {result} = render(client);

        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(result.current.rows).toHaveLength(2));
        await waitFor(() => expect(result.current.rows.every((row) => row.detailed)).toBe(true));

        expect(result.current.rows[0]).toMatchObject({tag: "Swap", title: "Sold NOAD", fee: [{amount: "3823", symbol: "BZE"}]});
        expect(result.current).toMatchObject({isLoading: false, isError: false, hasMore: false});
        expect(client.tokenTransfers).toHaveBeenCalledWith(DENOM, {cursor: null, limit: 100}, expect.anything());
    });

    it("reads more pages while block rows leave fewer transactions than wanted", async () => {
        const client = mockClient([
            {items: [blockRow(1), blockRow(2), move(3)], next_cursor: "1"},
            {items: [blockRow(4), move(5)], next_cursor: "2"},
            {items: [move(6)], next_cursor: null},
        ]);
        const {result} = render(client, 2);

        await waitFor(() => expect(result.current.rows.map((row) => row.txHash)).toEqual([hash(3), hash(5)]));
        expect(result.current.isLoading).toBe(false);
        // Tx 5 only counted as complete once the page after it arrived.
        expect(client.tokenTransfers).toHaveBeenCalledTimes(3);
        expect(result.current.hasMore).toBe(true);
    });

    it("is loading, not empty, while every row so far is block-level", async () => {
        let release: (page: ScanPage<ScanTransfer>) => void = () => undefined;
        const client = mockClient([{items: [blockRow(1)], next_cursor: "1"}]);
        client.tokenTransfers.mockImplementationOnce(async () => ({items: [blockRow(1)], next_cursor: "1"}))
            .mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
        const {result} = render(client);

        await waitFor(() => expect(client.tokenTransfers).toHaveBeenCalledTimes(2));
        expect(result.current).toMatchObject({rows: [], isLoading: true});

        act(() => release({items: [], next_cursor: null}));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.rows).toEqual([]);
    });

    it("reports a failed first read and reads again on retry", async () => {
        const client = mockClient([new ScanError("BZE Scan unreachable", 0)]);
        const {result} = render(client);

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.isLoading).toBe(false);

        client.tokenTransfers.mockResolvedValueOnce({items: [move(1)], next_cursor: null});
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.rows).toHaveLength(1));
        expect(result.current.isError).toBe(false);
    });

    it("keeps the rows shown when reading more fails, and retries that page", async () => {
        const client = mockClient([{items: [move(1), move(2)], next_cursor: "1"}, new ScanError("BZE Scan answered 502", 502)]);
        const {result} = render(client, 1);

        await waitFor(() => expect(result.current.rows).toHaveLength(1));
        act(() => result.current.loadMore());
        await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));
        expect(result.current.rows).toHaveLength(1);

        client.tokenTransfers.mockResolvedValueOnce({items: [move(3)], next_cursor: null});
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.rows.map((row) => row.txHash)).toEqual([hash(1), hash(2)]));
        expect(result.current.isLoadMoreError).toBe(false);
    });
});
