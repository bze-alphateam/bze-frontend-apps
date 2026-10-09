import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The trading page reads the market, assets, balances, the gas engine, the order book queries
// and the halted list through ui-kit. Those are fed directly; the badge and notice stay real.
const { mocks, HALTED, MARKET, MARKET_ID } = vi.hoisted(() => {
    const HALTED = "factory/bze1creator/uhalt";
    return {
        mocks: { halted: new Set<string>(), tx: vi.fn(), myOrders: [] as unknown[] },
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
        useBalances: () => ({ getBalanceByDenom: (denom: string) => ({ denom, amount: new BigNumber(0) }) }),
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
