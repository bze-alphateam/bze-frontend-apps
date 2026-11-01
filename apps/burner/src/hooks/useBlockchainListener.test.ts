import {beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {
    blockchainEventManager, type TendermintEvent, EPOCH_START_EVENT, LOCK_CHANGED_EVENT, NEXT_BURN_CHANGED_EVENT,
    RAFFLE_CHANGED_EVENT, SUPPLY_CHANGED_EVENT, getBurnerModuleAddress, getHardcodedLockAddress, getRaffleModuleAddress,
} from "@bze/bze-ui-kit";

// The hook's NewBlock handler is captured here so each test can push a notification into it.
const subscriptions = vi.hoisted(() => new Map<string, (result: unknown) => void>());
const wallet = vi.hoisted(() => ({address: undefined as string | undefined}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getSettings: () => ({endpoints: {rpcEndpoint: "wss://rpc.example.com"}}),
    subscribeToBlockchainEvents: async (_endpoint: string, query: string, handler: (result: unknown) => void) => {
        subscriptions.set(query, handler);
        return () => subscriptions.delete(query);
    },
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
        wallet.address = undefined;
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

    it("refreshes raffles when a tx in the block emits a raffle event", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[event("bze.burner.RaffleWinnerEvent", {denom: "factory/bze1creator/utoken"})]]));

        expect(emit).toHaveBeenCalledWith(RAFFLE_CHANGED_EVENT);
    });

    it("refreshes the locked balance when a tx sends coins to the lock address", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [[
            event("transfer", {recipient: getHardcodedLockAddress(), sender: "bze1someone", amount: "5ulp_1"}),
        ]]));

        expect(emit).toHaveBeenCalledWith(LOCK_CHANGED_EVENT);
    });

    it("refreshes the locked balance when the block's burn moves coins to the lock address", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([
            event("transfer", {recipient: getHardcodedLockAddress(), sender: getBurnerModuleAddress(), amount: "5ulp_1"}),
        ], []));

        expect(emit).toHaveBeenCalledWith(LOCK_CHANGED_EVENT);
        expect(emit).toHaveBeenCalledWith(NEXT_BURN_CHANGED_EVENT);
    });

    it("refreshes the next burn and the raffles on transfers to their module addresses", async () => {
        renderHook(() => useBlockchainListener());

        await pushNewBlock(newBlock([], [
            [event("transfer", {recipient: getBurnerModuleAddress(), sender: "bze1someone", amount: "5ubze"})],
            [event("transfer", {recipient: getRaffleModuleAddress(), sender: "bze1someone", amount: "5ubze"})],
        ]));

        expect(emit).toHaveBeenCalledWith(NEXT_BURN_CHANGED_EVENT);
        expect(emit).toHaveBeenCalledWith(RAFFLE_CHANGED_EVENT);
        expect(emit).not.toHaveBeenCalledWith(LOCK_CHANGED_EVENT);
    });

    it("stays within the node's 5 subscriptions per client with a wallet connected", async () => {
        wallet.address = "bze1wallet";
        renderHook(() => useBlockchainListener());

        await vi.waitFor(() => expect(subscriptions.size).toBe(3));
        expect([...subscriptions.keys()]).toEqual([
            "tm.event='NewBlock'",
            "tm.event='Tx' AND transfer.recipient='bze1wallet'",
            "tm.event='Tx' AND transfer.sender='bze1wallet'",
        ]);
    });
});
