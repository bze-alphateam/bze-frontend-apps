import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {act, renderHook, waitFor} from "@testing-library/react";

// Every chain read the provider makes is mocked; only the burner ones matter here.
const queries = vi.hoisted(() => ({
    getAllBurnedCoins: vi.fn(),
    getNextBurning: vi.fn(),
}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getChainAssets: async () => ({assets: new Map(), ibcData: new Map()}),
    getMarkets: async () => [],
    getAllTickers: async () => [],
    getEpochsInfo: async () => ({epochs: []}),
    getLiquidityPools: async () => [],
    getAddressBalances: async () => [],
    getAllBurnedCoins: queries.getAllBurnedCoins,
    getNextBurning: queries.getNextBurning,
    addDebounce: () => {},
}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: undefined})}));

import {AssetsProvider} from "./assets_context";
import {useCommunitiesContext} from "@/hooks/useCommunitiesContext";

const wrapper = ({children}: { children: ReactNode }) => <AssetsProvider>{children}</AssetsProvider>;

describe("AssetsProvider burn history", () => {
    beforeEach(() => {
        queries.getAllBurnedCoins.mockReset().mockResolvedValue({burnedCoins: [{burned: "1ubze", height: "10"}]});
        queries.getNextBurning.mockReset().mockResolvedValue(undefined);
    });

    it("loads the history once from the cache-friendly read", async () => {
        renderHook(() => useCommunitiesContext(), {wrapper});

        await waitFor(() => expect(queries.getAllBurnedCoins).toHaveBeenCalledTimes(1));
        expect(queries.getAllBurnedCoins.mock.calls[0]).toEqual([]);
    });

    it("re-reads the history past the local cache on refresh, and serves the new records", async () => {
        const {result} = renderHook(() => useCommunitiesContext(), {wrapper});
        await waitFor(() => expect(result.current.burnHistory).toHaveLength(1));

        const latest = [{burned: "5ubze", height: "20"}, {burned: "1ubze", height: "10"}];
        queries.getAllBurnedCoins.mockResolvedValue({burnedCoins: latest});
        await act(() => result.current.updateBurnHistory());

        expect(queries.getAllBurnedCoins).toHaveBeenLastCalledWith({fresh: true});
        expect(result.current.burnHistory).toEqual(latest);
    });
});
