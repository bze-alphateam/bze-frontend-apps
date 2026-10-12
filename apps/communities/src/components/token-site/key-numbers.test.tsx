import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Asset} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const TOKEN = "factory/bze1owner/upage";

// The key numbers' data comes from ui-kit hooks and queries plus the app's burn history; all mocked.
const useAsset = vi.fn();
const useAssetPrice = vi.fn();
const useAssetLiquidityPools = vi.fn();
const getDenomReward = vi.fn();
const getStakingRewards = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => useAsset(denom),
    useAssetPrice: (denom: string) => useAssetPrice(denom),
    useAssetLiquidityPools: (denom: string) => useAssetLiquidityPools(denom),
    getDenomReward: (denom: string) => getDenomReward(denom),
    getStakingRewards: () => getStakingRewards(),
}));

const useBurningHistory = vi.fn();
vi.mock("@/hooks/useBurningHistory", () => ({
    useBurningHistory: (denom: string) => useBurningHistory(denom),
}));

import {KeyNumbers} from "./key-numbers";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: TOKEN, decimals: 6, name: "Page Token", ticker: "PAGE",
    logo: "", stable: false, verified: false, supply: 2_000_000_000_000n, // 2M PAGE
};

const POOL = {id: `${TOKEN}_ubze`, base: TOKEN, quote: "ubze"};

const program = (staking_denom: string, staked_amount: string, payouts: number, duration = 10) =>
    ({reward_id: `${staking_denom}-${payouts}`, staking_denom, staked_amount, payouts, duration});

function renderNumbers() {
    return render(<KeyNumbers denom={TOKEN}/>, {
        wrapper: ({children}: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
}

const stat = (key: string) => screen.queryByTestId(`key-number-${key}`);

beforeEach(() => {
    useAsset.mockReturnValue({asset: ASSET, isLoading: false});
    useAssetPrice.mockReturnValue({price: new BigNumber("0.5"), change: 0, hasPrice: true});
    useAssetLiquidityPools.mockReturnValue({
        assetPools: [POOL],
        assetPoolsData: new Map([[POOL.id, {poolId: POOL.id, usdVolume: new BigNumber(1500)}]]),
    });
    useBurningHistory.mockReturnValue({
        burnHistory: [{amount: new BigNumber(1000)}, {amount: new BigNumber(250)}],
        isLoading: false,
    });
    // Holders pool: 300 PAGE. Programs: 100 PAGE active on PAGE, a finished one and one on another token.
    getDenomReward.mockResolvedValue({staking_denom: TOKEN, staked_amount: "300000000"});
    getStakingRewards.mockResolvedValue({list: [
        program(TOKEN, "100000000", 3),
        program(TOKEN, "900000000", 10),
        program("ubze", "700000000", 1),
    ]});
});

describe("KeyNumbers", () => {
    it("shows market cap, supply, staked, burned and 24h volume", async () => {
        renderNumbers();

        expect(stat("cap")).toHaveTextContent("Market cap$1M");
        expect(stat("supply")).toHaveTextContent("Supply2M");
        expect(stat("burned")).toHaveTextContent("Burned1.25K");
        expect(stat("volume")).toHaveTextContent("24h volume$1.5K");
        // Holders pool + the active program staking PAGE only.
        await waitFor(() => expect(stat("staked")).toHaveTextContent("Staked400"));
        expect(getDenomReward).toHaveBeenCalledWith(TOKEN);
    });

    it("hides the market cap when the token has no USD price", () => {
        useAssetPrice.mockReturnValue({price: new BigNumber(0), change: 0, hasPrice: false});
        renderNumbers();

        expect(stat("cap")).not.toBeInTheDocument();
        expect(stat("supply")).toBeInTheDocument();
    });

    it("hides the 24h volume when no pool holds the token, and shows $0 for an idle pool", () => {
        useAssetLiquidityPools.mockReturnValue({assetPools: [], assetPoolsData: new Map()});
        const {unmount} = renderNumbers();
        expect(stat("volume")).not.toBeInTheDocument();
        unmount();

        useAssetLiquidityPools.mockReturnValue({
            assetPools: [POOL],
            assetPoolsData: new Map([[POOL.id, {poolId: POOL.id, usdVolume: new BigNumber(0)}]]),
        });
        renderNumbers();
        expect(stat("volume")).toHaveTextContent("24h volume$0");
    });

    it("counts a token without a holders pool or programs as 0 staked", async () => {
        getDenomReward.mockResolvedValue(undefined);
        getStakingRewards.mockResolvedValue({list: []});
        renderNumbers();

        await waitFor(() => expect(stat("staked")).toHaveTextContent("Staked0"));
    });

    it("hides staked when the holders pool can't be read", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        getDenomReward.mockRejectedValue(new Error("501 Not Implemented"));
        renderNumbers();

        await waitFor(() => expect(console.error).toHaveBeenCalled());
        expect(stat("staked")).not.toBeInTheDocument();
    });

    it("hides burned while the burn history loads", () => {
        useBurningHistory.mockReturnValue({burnHistory: [], isLoading: true});
        renderNumbers();

        expect(stat("burned")).not.toBeInTheDocument();
    });
});
