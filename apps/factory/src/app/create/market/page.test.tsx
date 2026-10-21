import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// Choose a DEX market (BFE-260): both options, the shared tradebin fee, the DEX link and the pair
// handed on to the wizard.
const m = vi.hoisted(() => ({
    query: new URLSearchParams(),
    fees: {} as Record<string, unknown>,
    feesLoading: false,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/create/market",
    useSearchParams: () => m.query,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useCreationFees: () => ({ fees: m.fees, isLoading: m.feesLoading }),
    useAsset: (denom: string) => ({ asset: denom === "ubze" ? { denom, ticker: "BZE", decimals: 6 } : undefined, isLoading: false }),
    getDexApp: () => ({ href: "https://dex.example" }),
}));

import ChooseMarketPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<ChooseMarketPage />, { wrapper });
const card = (name: string) => within(screen.getByRole("region", { name }));

beforeEach(() => {
    m.query = new URLSearchParams();
    m.fees = { createMarketFee: { denom: "ubze", amount: "25000000000" } };
    m.feesLoading = false;
});

describe("Choose a DEX market", () => {
    it("asks how people should trade it, under Create / DEX market", () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How should people trade it?");
        const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
        expect(crumbs.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/");
        expect(crumbs.getByText("DEX market")).toHaveAttribute("aria-current", "page");
    });

    it("offers a liquidity pool first, with its care line, the creation fee and the way in", () => {
        renderPage();
        const pool = card("Liquidity pool");
        expect(pool.getByText("Most common first step")).toBeInTheDocument();
        expect(pool.getByText("Your first deposit stays in the pool forever. You get no withdrawable share for it.")).toBeInTheDocument();
        expect(pool.getByTestId("fee-line")).toHaveTextContent("Creation fee 25,000 BZE + network fee");
        expect(pool.getByRole("link", { name: /Create liquidity pool/ })).toHaveAttribute("href", "/pool/new");
    });

    it("offers an order-book market with the same fee", () => {
        renderPage();
        const market = card("Order-book market");
        expect(market.getByText("A new market is empty. Nothing trades until people place orders.")).toBeInTheDocument();
        expect(market.getByTestId("fee-line")).toHaveTextContent("Creation fee 25,000 BZE + network fee");
        expect(market.getByRole("link", { name: /Create order-book market/ })).toHaveAttribute("href", "/market/new");
    });

    it("says Fee unavailable when the chain gave no fee, never free", () => {
        m.fees = {};
        renderPage();
        for (const fee of screen.getAllByTestId("fee-line")) expect(fee).toHaveTextContent("Fee unavailable");
    });

    it("hands a picked pair on to either wizard", () => {
        m.query = new URLSearchParams({ base: "factory/bze1x/uhoney", quote: "ubze", other: "x" });
        renderPage();
        const q = "base=factory%2Fbze1x%2Fuhoney&quote=ubze";
        expect(card("Liquidity pool").getByRole("link", { name: /Create liquidity pool/ })).toHaveAttribute("href", `/pool/new?${q}`);
        expect(card("Order-book market").getByRole("link", { name: /Create order-book market/ })).toHaveAttribute("href", `/market/new?${q}`);
    });

    it("hands the way back to a token page on as well", () => {
        m.query = new URLSearchParams({ base: "factory/bze1x/uhoney", return: "/tokens/token?denom=factory%2Fbze1x%2Fuhoney", returnLabel: "HONEY" });
        renderPage();
        const href = card("Liquidity pool").getByRole("link", { name: /Create liquidity pool/ }).getAttribute("href") ?? "";
        const params = new URLSearchParams(href.split("?")[1]);
        expect(href.startsWith("/pool/new?")).toBe(true);
        expect(params.get("base")).toBe("factory/bze1x/uhoney");
        expect(params.get("return")).toBe("/tokens/token?denom=factory%2Fbze1x%2Fuhoney");
        expect(params.get("returnLabel")).toBe("HONEY");
    });

    it("sends existing pools to the DEX", () => {
        renderPage();
        expect(screen.getByText("Want to add to a pool that already exists, or take your liquidity out?")).toBeInTheDocument();
        expect(screen.getByTestId("app-link")).toHaveAttribute("href", "https://dex.example/pools");
    });
});
