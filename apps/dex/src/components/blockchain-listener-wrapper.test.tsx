import {beforeEach, describe, expect, it, vi} from "vitest";
import {render} from "@testing-library/react";

const listener = vi.hoisted(() => ({isConnected: false}));
const assets = vi.hoisted(() => ({
    updateBalances: vi.fn(),
    updateMarketsData: vi.fn(),
    updateConnectionType: vi.fn(),
    updateAssets: vi.fn(),
    updateLiquidityPools: vi.fn(),
}));

vi.mock("@/hooks/useBlockchainListener", () => ({useBlockchainListener: () => ({isConnected: listener.isConnected})}));
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAssetsContext: () => assets,
    useWalletHealthCheck: () => {},
}));

import {BlockchainListenerWrapper} from "./blockchain-listener-wrapper";

const refreshCalls = () => assets.updateBalances.mock.calls.length;

describe("BlockchainListenerWrapper recovery refresh", () => {
    beforeEach(() => {
        Object.values(assets).forEach(fn => fn.mockClear());
        listener.isConnected = false;
    });

    const setConnected = (view: ReturnType<typeof render>, connected: boolean) => {
        listener.isConnected = connected;
        view.rerender(<BlockchainListenerWrapper/>);
    };

    it("does not refresh everything on the first live", () => {
        const view = render(<BlockchainListenerWrapper/>);

        setConnected(view, true);

        expect(refreshCalls()).toBe(0);
        view.unmount();
    });

    it("refreshes everything once when the feed recovers after having been live", () => {
        const view = render(<BlockchainListenerWrapper/>);
        setConnected(view, true);
        setConnected(view, false);
        expect(refreshCalls()).toBe(0);

        setConnected(view, true);

        expect(refreshCalls()).toBe(1);
        expect(assets.updateMarketsData).toHaveBeenCalledTimes(1);
        expect(assets.updateAssets).toHaveBeenCalledTimes(1);
        expect(assets.updateLiquidityPools).toHaveBeenCalledTimes(1);
        view.unmount();
    });
});
