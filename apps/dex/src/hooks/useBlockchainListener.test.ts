import {beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {blockchainEventManager, type TendermintEvent, ORDER_BOOK_CHANGED_EVENT, SUPPLY_CHANGED_EVENT, SWAP_EXECUTED_EVENT} from "@bze/bze-ui-kit";

// The hook's NewBlock handler is captured here so each test can push a notification into it.
const subscriptions = vi.hoisted(() => new Map<string, (result: unknown) => void>());

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getSettings: () => ({endpoints: {rpcEndpoint: "wss://rpc.example.com"}}),
    subscribeToBlockchainEvents: async (_endpoint: string, query: string, handler: (result: unknown) => void) => {
        subscriptions.set(query, handler);
        return () => subscriptions.delete(query);
    },
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
});
