import {beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {blockchainEventManager, type TendermintEvent, EPOCH_START_EVENT, SUPPLY_CHANGED_EVENT} from "@bze/bze-ui-kit";

// The hook's NewBlock handler is captured here so each test can push a notification into it.
const subscriptions = vi.hoisted(() => new Map<string, (result: unknown) => void>());
// A fake ChainFeed: subscriptions are captured for the tests, the status is driven by feedStatus.
const feedStatus = vi.hoisted(() => ({current: "connecting" as "connecting" | "live" | "down", listeners: new Set<(s: "connecting" | "live" | "down") => void>()}));
const fakeFeed = vi.hoisted(() => ({
    subscribe: (query: string, handler: (result: unknown) => void) => {
        subscriptions.set(query, handler);
        return () => { subscriptions.delete(query); };
    },
    onStatus: (listener: (s: "connecting" | "live" | "down") => void) => {
        feedStatus.listeners.add(listener);
        listener(feedStatus.current);
        return () => { feedStatus.listeners.delete(listener); };
    },
}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getSettings: () => ({endpoints: {rpcEndpoint: "wss://rpc.example.com"}}),
    getChainFeed: () => fakeFeed,
}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: undefined})}));

import {useBlockchainListener} from "./useBlockchainListener";

const event = (type: string, attributes: Record<string, string> = {}): TendermintEvent => ({
    type,
    attributes: Object.entries(attributes).map(([key, value]) => ({key, value, index: true})),
});

// A NewBlock notification as CometBFT 0.38 sends it: tx results live inside result_finalize_block.
const newBlock = (blockEvents: TendermintEvent[], txEvents: TendermintEvent[][]) => ({
    query: "tm.event='NewBlock'",
    data: {
        type: "tendermint/event/NewBlock",
        value: {block: {}, block_id: {}, result_finalize_block: {events: blockEvents, tx_results: txEvents.map(events => ({code: 0, events}))}},
    },
});

const tokenMint = event("coinbase", {minter: "bze1module", amount: "1000000factory/bze1creator/utoken"});

const pushNewBlock = async (result: unknown) => {
    await vi.waitFor(() => expect(subscriptions.has("tm.event='NewBlock'")).toBe(true));
    act(() => subscriptions.get("tm.event='NewBlock'")!(result));
};

describe("useBlockchainListener NewBlock events", () => {
    let emit: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        subscriptions.clear();
        feedStatus.current = "connecting";
        feedStatus.listeners.clear();
        emit = vi.spyOn(blockchainEventManager, "emit");
        emit.mockClear();
    });

    it("refreshes supply when a tx in the block mints a token", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[event("message", {action: "/bze.tokenfactory.MsgMint"}), tokenMint]]));

        expect(emit).toHaveBeenCalledWith(SUPPLY_CHANGED_EVENT);
    });

    it("ignores a block whose txs only mint the native coin", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[event("coinbase", {amount: "5ubze"})]]));

        expect(emit).not.toHaveBeenCalledWith(SUPPLY_CHANGED_EVENT);
    });

    it("still reads the block's own events", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([event("bze.epochs.EpochStartEvent", {identifier: "hour"})], []));

        expect(emit).toHaveBeenCalledWith(EPOCH_START_EVENT);
    });
});


describe("useBlockchainListener connection status", () => {
    const setFeedStatus = (status: "connecting" | "live" | "down") => {
        feedStatus.current = status;
        act(() => feedStatus.listeners.forEach(listener => listener(status)));
    };

    beforeEach(() => {
        subscriptions.clear();
        feedStatus.current = "connecting";
        feedStatus.listeners.clear();
    });

    it("is connected only while the feed is live", () => {
        const {result} = renderHook(() => useBlockchainListener());
        expect(result.current.isConnected).toBe(false);

        setFeedStatus("live");
        expect(result.current.isConnected).toBe(true);

        setFeedStatus("down");
        expect(result.current.isConnected).toBe(false);
    });

    it("is not connected just because a block handler ran", async () => {
        const {result} = renderHook(() => useBlockchainListener());
        await vi.waitFor(() => expect(subscriptions.has("tm.event='NewBlock'")).toBe(true));

        act(() => subscriptions.get("tm.event='NewBlock'")!({data: {value: {result_finalize_block: {events: [], tx_results: []}}}}));

        expect(result.current.isConnected).toBe(false);
    });
});
