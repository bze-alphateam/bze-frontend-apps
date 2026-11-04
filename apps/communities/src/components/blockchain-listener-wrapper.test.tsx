import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, render} from "@testing-library/react";
import {blockchainEventManager, NEXT_BURN_CHANGED_EVENT, SUPPLY_CHANGED_EVENT} from "@bze/bze-ui-kit";

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

    it("reads the next burn and the burn history again after a burn", () => {
        feed.isConnected = true;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            blockchainEventManager.emit(SUPPLY_CHANGED_EVENT);
            vi.advanceTimersByTime(1500);
        });

        expect(context.updateNextBurn).toHaveBeenCalledTimes(1);
        expect(context.updateBurnHistory).toHaveBeenCalledTimes(1);
    });

    it("polls the next burn while the feed is down", () => {
        feed.isConnected = false;
        render(<BlockchainListenerWrapper/>);

        act(() => {
            vi.advanceTimersByTime(10_500);
        });

        expect(context.updateNextBurn).toHaveBeenCalled();
    });
});
