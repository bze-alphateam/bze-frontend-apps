import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";

// The pools page reads three ui-kit hooks (pools, ticker lookup, balances) plus
// the app's navigation hook. We mock those to feed state directly — no wallet or
// chain providers — and keep the rest of ui-kit (formatters, logos, HighlightText)
// real. vi.hoisted guarantees the mock fns exist before the factories run.
const { useLiquidityPoolsMock, useAssetsMock, useBalancesMock } = vi.hoisted(() => ({
    useLiquidityPoolsMock: vi.fn(),
    useAssetsMock: vi.fn(),
    useBalancesMock: vi.fn(),
}));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useLiquidityPools: () => useLiquidityPoolsMock(),
        useAssets: () => useAssetsMock(),
        useBalances: () => useBalancesMock(),
        // Cards resolve each side's asset; a benign stub keeps them rendering.
        useAsset: (denom: string) => ({
            asset: {
                denom,
                ticker: denom,
                name: denom,
                logo: "",
                decimals: 6,
                type: "factory",
                verified: false,
                stable: false,
                supply: 0n,
            },
        }),
    };
});

// Navigation touches next/navigation; the page only ever calls toLpPage on click.
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => new Proxy({}, { get: () => vi.fn() }),
}));

import LiquidityPoolsPage from "./page";

const POOLS = [
    { id: "1", base: "ubze", quote: "uusdc", lp_denom: "ulp/1" },
    { id: "2", base: "uatom", quote: "ubze", lp_denom: "ulp/2" },
] as unknown as LiquidityPoolSDKType[];

const TICKERS: Record<string, string> = { ubze: "BZE", uusdc: "USDC", uatom: "ATOM" };

function renderPools() {
    return render(<LiquidityPoolsPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useLiquidityPoolsMock.mockReset();
    useAssetsMock.mockReset();
    useBalancesMock.mockReset();

    // Stable across tests: ticker lookups and "no LP balance" for every pool.
    useAssetsMock.mockReturnValue({ denomTicker: (denom: string) => TICKERS[denom] ?? denom });
    useBalancesMock.mockReturnValue({ getBalanceByDenom: () => undefined });
});

describe("Liquidity pools page", () => {
    it("shows the created-nothing empty state when there are no pools", () => {
        useLiquidityPoolsMock.mockReturnValue({ pools: [], poolsData: new Map() });
        renderPools();

        expect(screen.getByText("No pools created yet")).toBeInTheDocument();
        expect(screen.queryByText("No pools found")).not.toBeInTheDocument();
    });

    it("lists pools with the total count and a footer summary", () => {
        useLiquidityPoolsMock.mockReturnValue({ pools: POOLS, poolsData: new Map() });
        renderPools();

        expect(screen.getByText(/2 liquidity pools/)).toBeInTheDocument();
        expect(screen.getByText(/Showing 2 of 2 pools/)).toBeInTheDocument();
        // No user balances, so both pools land in the "All Pools" section
        // (rendered once for desktop and once for mobile).
        expect(screen.getAllByText("All Pools").length).toBeGreaterThan(0);
        expect(screen.queryByText("No pools created yet")).not.toBeInTheDocument();
    });

    it("filters by ticker as the user types, and can clear an empty result", async () => {
        const user = userEvent.setup();
        useLiquidityPoolsMock.mockReturnValue({ pools: POOLS, poolsData: new Map() });
        renderPools();

        const search = screen.getByPlaceholderText(/Search pools/i);

        // "atom" matches only the ATOM/BZE pool.
        await user.type(search, "atom");
        expect(screen.getByText(/Showing 1 of 2 pools/)).toBeInTheDocument();

        // A term matching nothing shows the "no results" state, not the list.
        await user.clear(search);
        await user.type(search, "zzz");
        expect(screen.getByText("No pools found")).toBeInTheDocument();
        expect(screen.queryByText(/Showing .* pools/)).not.toBeInTheDocument();

        // Clearing the search restores the full list.
        await user.click(screen.getByRole("button", { name: /Clear Search/i }));
        expect(screen.getByText(/Showing 2 of 2 pools/)).toBeInTheDocument();
    });
});
