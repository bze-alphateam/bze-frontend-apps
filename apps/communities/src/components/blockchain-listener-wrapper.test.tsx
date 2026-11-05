import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, render} from "@testing-library/react";
import {
    blockchainEventManager,
    BURNER_COINS_BURNED_EVENT,
    NEXT_BURN_CHANGED_EVENT,
    SUPPLY_CHANGED_EVENT,
    SWAP_EXECUTED_EVENT,
} from "@bze/bze-ui-kit";

// The feed is driven by the test; the context's refreshers are spies.
const feed = vi.hoisted(() => ({isConnected: true}));
const context = vi.hoisted(() => ({
    updateBalances: vi.fn(),
    updateMarketsData: vi.fn(),
    updateConnectionType: vi.fn(),
    updateAssets: vi.fn(),
    updateEpochs: vi.fn(),
    updateNextBurn: vi.fn(),
    updateBurnHistory: vi.fn(),
    updateLiquidityPools: vi.fn(),
}));

vi.mock("@/hooks/useBlockchainListener", () => ({useBlockchainListener: () => ({isConnected: feed.isConnected})}));
vi.mock("@/hooks/useCommunitiesContext", () => ({useCommunitiesContext: () => context}));
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useTabResume: () => {},
    useWalletHealthCheck: () => {},
}));

import {BlockchainListenerWrapper} from "./blockchain-listener-wrapper";

describe("BlockchainListenerWrapper burner refresh", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.values(context).forEach((fn) => fn.mockReset());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("reads the next burn again when the burner's balance changes", () => {
        feed.isConnected = true;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            blockchainEventManager.emit(NEXT_BURN_CHANGED_EVENT);
            vi.advanceTimersByTime(1500);
        });

        expect(context.updateNextBurn).toHaveBeenCalledTimes(1);
    });

    it("reads the next burn and the burn history again after the periodic burn", () => {
        feed.isConnected = true;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            blockchainEventManager.emit(BURNER_COINS_BURNED_EVENT);
            vi.advanceTimersByTime(1500);
        });

        expect(context.updateNextBurn).toHaveBeenCalledTimes(1);
        expect(context.updateBurnHistory).toHaveBeenCalledTimes(1);
    });

    it("leaves the burn history alone for other supply changes (a fund to the burner included)", () => {
        feed.isConnected = true;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            blockchainEventManager.emit(SUPPLY_CHANGED_EVENT);
            vi.advanceTimersByTime(1500);
        });

        expect(context.updateAssets).toHaveBeenCalledTimes(1);
        expect(context.updateBurnHistory).not.toHaveBeenCalled();
    });

    it("polls the next burn, but not the burn history, while the feed is down", () => {
        feed.isConnected = false;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            vi.advanceTimersByTime(20_500);
        });

        expect(context.updateNextBurn).toHaveBeenCalled();
        expect(context.updateBurnHistory).not.toHaveBeenCalled();
    });

    it("catches up the burn history once when the feed recovers", () => {
        feed.isConnected = true;
        const {rerender} = render(<BlockchainListenerWrapper/>);
        feed.isConnected = false;
        rerender(<BlockchainListenerWrapper/>);
        expect(context.updateBurnHistory).not.toHaveBeenCalled();

        feed.isConnected = true;
        rerender(<BlockchainListenerWrapper/>);

        expect(context.updateBurnHistory).toHaveBeenCalledTimes(1);
        expect(context.updateNextBurn).toHaveBeenCalled();
    });
});

describe("BlockchainListenerWrapper pool refresh", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.values(context).forEach((fn) => fn.mockReset());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("reads the pools' reserves again after a swap", () => {
        feed.isConnected = true;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            blockchainEventManager.emit(SWAP_EXECUTED_EVENT);
            vi.advanceTimersByTime(2000);
        });

        expect(context.updateLiquidityPools).toHaveBeenCalled();
        expect(context.updateAssets).not.toHaveBeenCalled();
    });

    it("polls the pools' reserves while the feed is down", () => {
        feed.isConnected = false;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            vi.advanceTimersByTime(10_500);
        });

        expect(context.updateLiquidityPools).toHaveBeenCalledTimes(1);
    });

    it("catches up the pools' reserves when the feed recovers", () => {
        feed.isConnected = true;
        const {rerender} = render(<BlockchainListenerWrapper/>);
        feed.isConnected = false;
        rerender(<BlockchainListenerWrapper/>);

        feed.isConnected = true;
        rerender(<BlockchainListenerWrapper/>);

        expect(context.updateLiquidityPools).toHaveBeenCalledTimes(1);
    });
});
