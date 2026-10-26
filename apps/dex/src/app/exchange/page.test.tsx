import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The markets list reads the markets, assets, prices and the halted list through ui-kit. Those
// are fed directly; the logos, badges and rows stay real.
const { mocks } = vi.hoisted(() => ({
    mocks: { halted: new Set<string>() },
}));

const MARKETS = [
    { base: "uflix", quote: "uusdcn" },
    { base: "ubze", quote: "uusdc" },
];

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const tickers: Record<string, string> = { uflix: "FLIX", uusdcn: "USDC.n", ubze: "BZE", uusdc: "USDC" };
    const asset = (denom: string): Asset => ({
        type: "IBC", denom, decimals: 6, name: tickers[denom], ticker: tickers[denom], logo: "", stable: false,
        verified: true, supply: 1000n, halted: mocks.halted.has(denom),
    });
    return {
        ...actual,
        useMarkets: () => ({ markets: MARKETS, getMarketData: () => undefined, isLoading: false }),
        useAssets: () => ({ isVerifiedAsset: () => true, denomTicker: (denom: string) => tickers[denom] ?? denom }),
        useAssetsValue: () => ({ compareValues: () => 0, isLoading: false }),
        useAsset: (denom: string) => ({ asset: asset(denom), isLoading: false }),
        useAssetPrice: () => ({ totalUsdValue: () => new BigNumber(0), isUSDC: false }),
        useHaltedDenoms: () => ({
            haltedDenoms: mocks.halted,
            isDenomHalted: (denom: string) => mocks.halted.has(denom),
            isMarketHalted: (m: { base: string; quote: string }) => mocks.halted.has(m.base) || mocks.halted.has(m.quote),
            isPoolHalted: () => false,
            isLoading: false,
        }),
    };
});

vi.mock("@/hooks/useNavigation", () => ({
    marketPagePath: (base: string, quote: string) => `/exchange/market?id=${base}/${quote}`,
}));

import { rulesFor } from "@/test-support/css-rules";
import ExchangePage from "./page";

function renderPage() {
    return render(<ExchangePage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const row = (pair: string) => screen.getByRole("link", { name: `Trade ${pair}` });

beforeEach(() => {
    mocks.halted = new Set();
});

describe("exchange markets list", () => {
    it("badges a market whose quote is halted, and lists it after the tradeable ones", () => {
        mocks.halted = new Set(["uusdcn"]);
        renderPage();

        expect(within(row("FLIX/USDC.n")).getAllByText("Trading halted").length).toBeGreaterThan(0);
        expect(within(row("BZE/USDC")).queryByText("Trading halted")).toBeNull();
        expect(screen.getAllByTestId("market-row").map(r => r.getAttribute("aria-label")))
            .toEqual(["Trade BZE/USDC", "Trade FLIX/USDC.n"]);
    });

    it("shows no halted badge when nothing is halted", () => {
        renderPage();

        expect(screen.queryByText("Trading halted")).toBeNull();
    });

    it("draws each pair's logos at the pools list size, on desktop and on phones", () => {
        renderPage();

        const logos = within(row("BZE/USDC")).getAllByTestId("pair-logo");
        // One for the desktop grid and one for the phone layout.
        expect(logos).toHaveLength(2);
        for (const logo of logos) {
            const token = logo.firstElementChild!.firstElementChild as HTMLElement;
            expect(rulesFor(token)).toMatch(/width:\s*var\(--chakra-sizes-8\)/);
        }
    });
});
