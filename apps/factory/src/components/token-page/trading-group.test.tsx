import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// The Trading group on mocked pools, markets, assets and wallet: each pool row links to the DEX
// pool and to the simple reward form, staking that pool's LP shares.
const m = vi.hoisted(() => ({
    pools: [] as Record<string, string>[],
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1me" }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const tickers: Record<string, string> = { uhoney: "HONEY", ubze: "BZE", uusdc: "USDC", uhalt: "HALT" };
    return {
        ...actual,
        useAsset: (denom: string) => ({
            asset: tickers[denom] ? { denom, ticker: tickers[denom], decimals: 6, halted: denom === "uhalt" } : undefined,
            isLoading: false,
        }),
        useLiquidityPools: () => ({ pools: m.pools, isLoading: false }),
        useMarkets: () => ({ markets: [], isLoading: false }),
        getDexApp: () => ({ href: "https://dex.test" }),
    };
});

import { TradingGroup } from "./trading-group";

const pool = (id: string, base: string, quote: string, lpDenom: string) => ({
    id, base, quote, lp_denom: lpDenom, creator: "bze1other", reserve_base: "1000000", reserve_quote: "2000000",
});
const BACK = { href: "/tokens/token?denom=uhoney", label: "HONEY" };
const asset = (over: Partial<Asset> = {}) => ({ denom: "uhoney", ticker: "HONEY", name: "Honey", decimals: 6, logo: "", ...over }) as Asset;

const renderGroup = (a = asset()) => render(
    <TradingGroup asset={a} access="none" back={BACK} />,
    { wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider> },
);

const rewardLink = (poolId: string) => within(screen.getByTestId(`trading-pool-${poolId}`)).getByRole("link", { name: "Reward LPs" });

beforeEach(() => {
    m.pools = [
        // A legacy LP denom and a hashed one: the row uses the pool's stored lp_denom either way.
        pool("uhoney_ubze", "uhoney", "ubze", "ulp_uhoney_ubze"),
        pool("uusdc_uhoney", "uusdc", "uhoney", "ulp/9f86d081"),
        // Not the page's token: no row.
        pool("ubze_uusdc", "ubze", "uusdc", "ulp_ubze_uusdc"),
    ];
});

describe("TradingGroup pool rows", () => {
    it("links every pool of the token to the reward form, staking its LP shares, paying the token, and back", () => {
        renderGroup();
        for (const [id, lpDenom] of [["uhoney_ubze", "ulp_uhoney_ubze"], ["uusdc_uhoney", "ulp/9f86d081"]]) {
            const href = rewardLink(id).getAttribute("href") ?? "";
            const [path, query] = href.split("?");
            const params = new URLSearchParams(query);
            expect(path).toBe("/reward/new");
            expect(params.get("staking")).toBe(lpDenom);
            expect(params.get("prize")).toBe("uhoney");
            expect(params.get("return")).toBe(BACK.href);
            expect(params.get("returnLabel")).toBe(BACK.label);
        }
        expect(screen.getAllByRole("link", { name: "Reward LPs" })).toHaveLength(2);
        expect(screen.queryByTestId("trading-pool-ubze_uusdc")).not.toBeInTheDocument();
    });

    it("keeps the DEX link next to it", () => {
        renderGroup();
        const dex = within(screen.getByTestId("trading-pool-uusdc_uhoney")).getByRole("link", { name: "DEX" });
        expect(dex.getAttribute("href")).toBe("https://dex.test/pools/details?id=uusdc_uhoney");
    });

    it("offers no reward for a halted token, like every other create button", () => {
        renderGroup(asset({ halted: true } as Partial<Asset>));
        expect(screen.getByTestId("trading-pool-uhoney_ubze")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Reward LPs" })).not.toBeInTheDocument();
    });

    it("offers no reward on a pool whose other side is halted", () => {
        m.pools = [pool("uhoney_uhalt", "uhoney", "uhalt", "ulp_uhoney_uhalt"), ...m.pools];
        renderGroup();
        expect(within(screen.getByTestId("trading-pool-uhoney_uhalt")).queryByRole("link", { name: "Reward LPs" })).not.toBeInTheDocument();
        expect(rewardLink("uhoney_ubze")).toBeInTheDocument();
    });
});
