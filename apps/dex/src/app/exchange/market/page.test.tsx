import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The trading page reads the market, assets, balances, the gas engine, the order book queries
// and the halted list through ui-kit. Those are fed directly; the badge and notice stay real.
const { mocks, HALTED, MARKET, MARKET_ID } = vi.hoisted(() => {
    const HALTED = "factory/bze1creator/uhalt";
    return {
        mocks: { halted: new Set<string>(), tx: vi.fn(), myOrders: [] as unknown[], balance: new BigNumber(0) },
        HALTED,
        MARKET: { base: HALTED, quote: "ubze" },
        MARKET_ID: `${HALTED}/ubze`,
    };
});

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: "bze1owner" }),
}));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigationWithParams: () => ({ idParam: MARKET_ID, toExchangePage: vi.fn() }),
}));

vi.mock("@/components/ui/trading/chart", () => ({ LightweightChart: () => null }));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const asset = (denom: string, ticker: string): Asset => ({
        type: "Factory", denom, decimals: 6, name: ticker, ticker, logo: "", stable: false, verified: true, supply: 1000n,
    });
    const assets: Record<string, Asset> = { [HALTED]: asset(HALTED, "HALT"), ubze: asset("ubze", "BZE") };
    const gasFee = { denom: "ubze", amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE", isNative: true, isLoading: false };
    return {
        ...actual,
        useMarket: () => ({ market: MARKET, marketId: MARKET_ID, marketData: undefined }),
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: new BigNumber(0) } }),
        useBalances: () => ({ getBalanceByDenom: (denom: string) => ({ denom, amount: mocks.balance }) }),
        useAssetPrice: () => ({ totalUsdValue: () => new BigNumber(0), hasPrice: false }),
        useBZETx: () => ({ tx: mocks.tx }),
        useTradingFees: () => ({ fees: {}, isLoading: false }),
        useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
        useConnectionType: () => ({ connectionType: undefined }),
        useMaxSpendable: () => ({ inputValue: "0", displayAmount: new BigNumber(0), amount: new BigNumber(0), gasFee, isLoading: false }),
        useGasFeeEstimator: () => ({ estimate: () => gasFee }),
        useFeeEstimate: () => ({ isPreferredSelected: false, isLoading: false }),
        useHaltedDenoms: () => ({
            haltedDenoms: mocks.halted,
            isDenomHalted: (denom: string) => mocks.halted.has(denom),
            isMarketHalted: (m: { base: string; quote: string }) => !!m && (mocks.halted.has(m.base) || mocks.halted.has(m.quote)),
            isPoolHalted: () => false,
            isLoading: false,
        }),
        getMarketBuyOrders: async () => ({ list: [] }),
        getMarketSellOrders: async () => ({ list: [] }),
        getMarketHistory: async () => ({ list: [] }),
        getAddressHistory: async () => [],
        getAddressFullMarketOrders: async () => mocks.myOrders,
        getTradingViewIntervals: async () => [],
        FeeEstimateRow: () => null,
    };
});

import { rulesFor } from "@/test-support/css-rules";
import TradingPage from "./page";

const ORDER = {
    id: "7", market_id: MARKET_ID, order_type: "sell", amount: "1000000", price: "2", owner: "bze1owner", created_at: "1700000000",
};

function renderPage() {
    return render(<TradingPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    mocks.halted = new Set();
    mocks.tx.mockReset();
    mocks.myOrders = [ORDER];
    mocks.balance = new BigNumber(0);
});

describe("trading page on a governance-halted market", () => {
    it("replaces the buy/sell forms with the notice and badges the market", async () => {
        mocks.halted = new Set([HALTED]);
        renderPage();

        expect(await screen.findByText("HALT is no longer tradeable on BZE")).toBeInTheDocument();
        expect(screen.getByText("Trading halted")).toBeInTheDocument();
        expect(screen.getByText(/Resting orders on this market will not execute/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Buy HALT" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Sell HALT" })).toBeNull();
    });

    it("keeps the owner's orders cancellable", async () => {
        mocks.halted = new Set([HALTED]);
        renderPage();

        const cancelAll = await screen.findByRole("button", { name: "Cancel All" });
        fireEvent.click(cancelAll);

        await waitFor(() => expect(mocks.tx).toHaveBeenCalledTimes(1));
        const msgs = mocks.tx.mock.calls[0][0];
        expect(msgs[0].typeUrl).toBe("/bze.tradebin.MsgCancelOrder");
        expect(msgs[0].value).toMatchObject({ marketId: MARKET_ID, orderId: "7" });
    });

    it("shows the forms and no halt UI when nothing is halted", async () => {
        renderPage();

        expect(await screen.findByRole("button", { name: "Buy HALT" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Sell HALT" })).toBeInTheDocument();
        expect(screen.queryByText("Trading halted")).toBeNull();
        expect(screen.queryByText(/no longer tradeable/)).toBeNull();
    });
});

// The order guards used isPositive(), which is true for 0. Pasting an amount after a tiny total
// rounds the derived price down to "0", and the sell then went out as MsgCreateOrder with price
// "0", failing the chain's ValidateBasic after the user had signed.
describe("order guards", () => {
    const fill = (form: HTMLElement, label: string, value: string) =>
        fireEvent.change(within(form).getByLabelText(label), { target: { value } });

    it("sends no order whose price rounds to 0", async () => {
        mocks.balance = new BigNumber("1000000000000");
        renderPage();

        // A valid buy first: proves the book has loaded and the form reaches tx().
        const buy = await screen.findByRole("group", { name: "Buy HALT" });
        fill(buy, "Price", "1");
        fill(buy, "Amount", "2");
        fireEvent.click(within(buy).getByRole("button", { name: "Buy HALT" }));
        await waitFor(() => expect(mocks.tx).toHaveBeenCalledTimes(1));
        expect(mocks.tx.mock.calls[0][0][0].typeUrl).toBe("/bze.tradebin.MsgCreateOrder");
        expect(mocks.tx.mock.calls[0][0][0].value).toMatchObject({ orderType: "buy", price: "1", amount: "2000000" });
        await waitFor(() => expect(within(buy).getByRole("button", { name: "Buy HALT" })).toBeEnabled());

        const sell = screen.getByRole("group", { name: "Sell HALT" });
        fill(sell, "Total", "0.000001");
        fill(sell, "Amount", "1000");
        expect(within(sell).getByLabelText("Price")).toHaveValue("0");

        fireEvent.click(within(sell).getByRole("button", { name: "Sell HALT" }));
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(mocks.tx).toHaveBeenCalledTimes(1);
    });
});

describe("market header", () => {
    it("keeps the back button, the pair logo and the pair on one row on phones", async () => {
        renderPage();

        const title = await screen.findByTestId("market-title");
        const row = rulesFor(title.parentElement as HTMLElement);

        expect(row).toMatch(/flex-wrap:\s*nowrap/);
        expect(rulesFor(screen.getByRole("heading", { level: 1 }))).toMatch(/font-size:\s*18px/);
    });

    it("draws the pair logo the way the markets and pools lists do, untiled", async () => {
        renderPage();

        const logo = await screen.findByTestId("pair-logo");
        const token = logo.firstElementChild!.firstElementChild as HTMLElement;
        expect(rulesFor(token)).toMatch(/width:\s*var\(--chakra-sizes-8\)/);
        // The old header framed a smaller pair in its own bordered tile.
        expect(rulesFor(logo.parentElement as HTMLElement)).not.toMatch(/border-width/);
    });

    it("stacks the order book rows tightly, as the old book did", async () => {
        renderPage();

        const book = await screen.findByRole("region", { name: "Order Book" });
        expect(rulesFor(book)).toMatch(/gap:\s*1px/);
    });

    it("draws the back arrow icon-only and flush on phones, leaving the price its room", async () => {
        renderPage();

        const back = await screen.findByTestId("market-back");
        const css = rulesFor(back);

        expect(back.getAttribute("aria-label")).toBe("Back to markets");
        expect(css).toMatch(/padding-inline:\s*0(px)?[;\s}]/);
        expect(css).toMatch(/min-width:\s*24px/);
    });
});
