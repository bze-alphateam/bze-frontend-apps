import {beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {blockchainEventManager, CURRENT_WALLET_BALANCE_EVENT, type TendermintEvent, getHardcodedLockAddress, LOCK_CHANGED_EVENT, ORDER_BOOK_CHANGED_EVENT, SUPPLY_CHANGED_EVENT, SWAP_EXECUTED_EVENT} from "@bze/bze-ui-kit";

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

const wallet = vi.hoisted(() => ({address: undefined as string | undefined}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getSettings: () => ({endpoints: {rpcEndpoint: "wss://rpc.example.com"}}),
    getChainFeed: () => fakeFeed,
}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: wallet.address})}));

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

    it("refreshes pools when a tx in the block swaps", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[event("bze.tradebin.SwapEvent", {pool_id: "\"ubze_uusdc\""})]]));

        expect(emit).toHaveBeenCalledWith(SWAP_EXECUTED_EVENT);
    });

    it("still reads the block's own events", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([event("bze.tradebin.OrderSavedEvent", {market_id: "\"ubze/uusdc\""})], []));

        expect(emit).toHaveBeenCalledWith(ORDER_BOOK_CHANGED_EVENT, {marketId: "ubze/uusdc"});
    });

    it("refreshes the locked liquidity when a tx sends LP coins to the lock address", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[
            event("transfer", {recipient: getHardcodedLockAddress(), sender: "bze1someone", amount: "5ulp_1"}),
        ]]));

        expect(emit).toHaveBeenCalledWith(LOCK_CHANGED_EVENT);
    });

    it("leaves the locked liquidity alone for other transfers", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[event("transfer", {recipient: "bze1other", sender: "bze1someone", amount: "5ubze"})]]));

        expect(emit).not.toHaveBeenCalledWith(LOCK_CHANGED_EVENT);
    });
});

describe("useBlockchainListener wallet balance", () => {
    let emit: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        subscriptions.clear();
        feedStatus.current = "connecting";
        feedStatus.listeners.clear();
        wallet.address = undefined;
        emit = vi.spyOn(blockchainEventManager, "emit");
        emit.mockClear();
    });

    const transfer = (recipient: string, sender = "bze1someone") => event("transfer", {recipient, sender, amount: "5ubze"});

    it("subscribes only to NewBlock, with and without a wallet", async () => {
        const {unmount} = renderHook(() => useBlockchainListener());
        await vi.waitFor(() => expect(subscriptions.size).toBe(1));
        expect([...subscriptions.keys()]).toEqual(["tm.event='NewBlock'"]);
        unmount();
        subscriptions.clear();

        wallet.address = "bze1wallet";
        renderHook(() => useBlockchainListener());
        await vi.waitFor(() => expect(subscriptions.size).toBe(1));
        expect([...subscriptions.keys()]).toEqual(["tm.event='NewBlock'"]);
    });

    it("refreshes the balance for a transfer to the wallet in the block's own events (EndBlock fill)", async () => {
        wallet.address = "bze1wallet";
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([transfer("bze1wallet", "bze1module")], []));

        expect(emit).toHaveBeenCalledWith(CURRENT_WALLET_BALANCE_EVENT);
    });

    it("refreshes the balance for a transfer from the wallet inside a tx", async () => {
        wallet.address = "bze1wallet";
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[transfer("bze1other", "bze1wallet")]]));

        expect(emit).toHaveBeenCalledWith(CURRENT_WALLET_BALANCE_EVENT);
    });

    it("leaves the balance alone for transfers between other addresses", async () => {
        wallet.address = "bze1wallet";
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([transfer("bze1a", "bze1b")], [[transfer("bze1c", "bze1d")]]));

        expect(emit).not.toHaveBeenCalledWith(CURRENT_WALLET_BALANCE_EVENT);
    });

    it("follows a wallet that changes after mount, without resubscribing", async () => {
        wallet.address = "bze1old";
        const {rerender} = renderHook(() => useBlockchainListener());
        await vi.waitFor(() => expect(subscriptions.size).toBe(1));
        const handler = subscriptions.get("tm.event='NewBlock'");

        wallet.address = "bze1new";
        rerender();

        act(() => subscriptions.get("tm.event='NewBlock'")!(newBlock([], [[transfer("bze1old")]])));
        expect(emit).not.toHaveBeenCalledWith(CURRENT_WALLET_BALANCE_EVENT);

        act(() => subscriptions.get("tm.event='NewBlock'")!(newBlock([], [[transfer("bze1new")]])));
        expect(emit).toHaveBeenCalledWith(CURRENT_WALLET_BALANCE_EVENT);
        expect(subscriptions.get("tm.event='NewBlock'")).toBe(handler);
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
