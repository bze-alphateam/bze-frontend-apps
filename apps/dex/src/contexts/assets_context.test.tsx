import { describe, it, expect, vi, beforeEach } from "vitest";
import { useContext } from "react";
import { act, render, screen } from "@testing-library/react";

// The provider's first load and a connected wallet's balances are fetched through ui-kit.
// Each call is held open or answered by the test, so their order is under its control.
const { calls } = vi.hoisted(() => ({
    calls: { initial: [] as Array<{ resolve: (value: unknown) => void; value: unknown }>, balances: vi.fn() },
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: "bze1owner" }),
}));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const held = (value: unknown) => () => new Promise(resolve => calls.initial.push({ resolve, value }));
    return {
        ...actual,
        getChainAssets: held({ assets: new Map(), ibcData: new Map() }),
        getMarkets: held([]),
        getAllTickers: held([]),
        getEpochsInfo: held({ epochs: [] }),
        getLiquidityPools: held([]),
        getAddressBalances: () => calls.balances(),
        addDebounce: () => {},
    };
});

import { AssetsContext } from "@bze/bze-ui-kit";
import { AssetsProvider } from "./assets_context";

const Probe = () => {
    const ctx = useContext(AssetsContext);
    return <span data-testid="loading">{String(ctx?.isLoading)}</span>;
};

beforeEach(() => {
    calls.initial = [];
    calls.balances.mockReset();
    calls.balances.mockResolvedValue([]);
});

describe("AssetsProvider loading flag", () => {
    it("stays loading until the first load lands, even when the wallet's balances come back first", async () => {
        render(<AssetsProvider><Probe /></AssetsProvider>);

        // Balances answer at once; markets, pools and the rest are still in flight.
        await act(async () => {});
        expect(calls.balances).toHaveBeenCalled();
        expect(screen.getByTestId("loading").textContent).toBe("true");

        await act(async () => {
            for (const call of calls.initial) call.resolve(call.value);
        });
        expect(screen.getByTestId("loading").textContent).toBe("false");
    });
});
