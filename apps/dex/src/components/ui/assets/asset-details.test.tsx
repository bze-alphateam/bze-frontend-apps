import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";
import { rulesFor } from "@/test-support/css-rules";

// The details read the asset's markets and pools and each row's assets through ui-kit.
// Those hooks are fed one BZE/USDC market and one BZE/USDC pool; the logos stay real.
const { BZE, USDC } = vi.hoisted(() => {
    const asset = (denom: string, ticker: string) => ({
        type: "Native", denom, decimals: 6, name: ticker, ticker, logo: "", stable: false, verified: true, supply: 1000n,
    });
    return { BZE: asset("ubze", "BZE"), USDC: asset("uusdc", "USDC") };
});

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, unknown> = { ubze: BZE, uusdc: USDC };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssetMarkets: () => ({
            assetMarketsData: [],
            asset24hTradedVolume: new BigNumber(0),
            assetMarkets: [{ base: "ubze", quote: "uusdc" }],
        }),
        useAssetLiquidityPools: () => ({
            assetPools: [{ id: "ubze_uusdc", base: "ubze", quote: "uusdc", reserve_base: "0", reserve_quote: "0" }],
            asset24HoursVolume: new BigNumber(0),
            assetPoolsData: new Map(),
        }),
        useMarket: () => ({
            marketSymbol: "BZE/USDC",
            market: { base: "ubze", quote: "uusdc" },
            marketData: undefined,
            isLoading: false,
        }),
    };
});

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ toLpPage: vi.fn(), toMarketPage: vi.fn() }),
}));

import { AssetDetails } from "./asset-details";

function renderDetails() {
    return render(
        <ChakraProvider value={defaultSystem}>
            <AssetDetails asset={BZE as unknown as Asset} />
        </ChakraProvider>,
    );
}

describe("AssetDetails pair logos", () => {
    it("draws an order book market's pair like the markets list, untiled", () => {
        renderDetails();

        const logo = within(screen.getByRole("button", { name: "BZE/USDC market" })).getByTestId("pair-logo");
        const token = logo.firstElementChild!.firstElementChild as HTMLElement;
        expect(rulesFor(token)).toMatch(/width:\s*var\(--chakra-sizes-8\)/);
        // The old row framed a smaller pair in its own bordered tile.
        expect(rulesFor(logo.parentElement as HTMLElement)).not.toMatch(/border-width/);
    });

    it("draws a liquidity pool's pair the same way", () => {
        renderDetails();

        const logo = within(screen.getByRole("button", { name: "BZE/USDC liquidity pool" })).getByTestId("pair-logo");
        const token = logo.firstElementChild!.firstElementChild as HTMLElement;
        expect(rulesFor(token)).toMatch(/width:\s*var\(--chakra-sizes-8\)/);
    });
});
