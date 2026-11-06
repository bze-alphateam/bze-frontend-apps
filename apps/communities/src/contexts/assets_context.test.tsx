import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {act, renderHook, waitFor} from "@testing-library/react";

// Every chain read the provider makes is mocked; only the burner ones matter here.
const queries = vi.hoisted(() => ({
    getAllBurnedCoins: vi.fn(),
    getNextBurning: vi.fn(),
    getChainAssets: vi.fn(),
    getAddressBalances: vi.fn(),
}));
const wallet = vi.hoisted(() => ({address: undefined as string | undefined}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getChainAssets: queries.getChainAssets,
    getMarkets: async () => [],
    getAllTickers: async () => [],
    getEpochsInfo: async () => ({epochs: []}),
    getLiquidityPools: async () => [],
    getAddressBalances: queries.getAddressBalances,
    getAllBurnedCoins: queries.getAllBurnedCoins,
    getNextBurning: queries.getNextBurning,
    addDebounce: () => {},
}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: wallet.address})}));

import {AssetsProvider} from "./assets_context";
import {useCommunitiesContext} from "@/hooks/useCommunitiesContext";

const wrapper = ({children}: { children: ReactNode }) => <AssetsProvider>{children}</AssetsProvider>;

beforeEach(() => {
    wallet.address = undefined;
    queries.getChainAssets.mockReset().mockResolvedValue({assets: new Map(), ibcData: new Map()});
    queries.getAddressBalances.mockReset().mockResolvedValue([]);
});

describe("AssetsProvider loading", () => {
    it("stays loading until the assets arrive, even when the wallet balances come back first", async () => {
        wallet.address = "bze1holder";
        let resolveAssets: (value: unknown) => void = () => {};
        queries.getChainAssets.mockReturnValue(new Promise((resolve) => { resolveAssets = resolve; }));
        queries.getAllBurnedCoins.mockResolvedValue({burnedCoins: []});
        queries.getNextBurning.mockResolvedValue(undefined);

        const {result} = renderHook(() => useCommunitiesContext(), {wrapper});
        await waitFor(() => expect(queries.getAddressBalances).toHaveBeenCalledWith("bze1holder"));
        // The balances read is done; the assets map is still empty, so this is not "loaded" yet.
        await act(async () => {});
        expect(result.current.assetsMap.size).toBe(0);
        expect(result.current.isLoading).toBe(true);

        const asset = {denom: "factory/bze1creator/vdl"};
        await act(async () => resolveAssets({assets: new Map([[asset.denom, asset]]), ibcData: new Map()}));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.assetsMap.get(asset.denom)).toEqual(asset);
    });
});

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
