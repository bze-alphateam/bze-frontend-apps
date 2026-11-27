import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The trading page reads the market, assets, balances, the gas engine, the order book queries
// and the halted list through ui-kit. Those are fed directly; the badge and notice stay real.
const { mocks, HALTED, MARKET, MARKET_ID } = vi.hoisted(() => {
    const HALTED = "factory/bze1creator/uhalt";
    return {
        mocks: { halted: new Set<string>(), tx: vi.fn(), myOrders: [] as unknown[], balance: "0", paused: [] as string[], info: vi.fn(), fetchOrders: vi.fn() },
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
        useBalances: () => ({ getBalanceByDenom: (denom: string) => ({ denom, amount: new BigNumber(mocks.balance) }) }),
        useAssetPrice: () => ({ totalUsdValue: () => new BigNumber(0), hasPrice: false }),
        useBZETx: () => ({ tx: mocks.tx }),
        useTradingFees: () => ({ fees: {}, isLoading: false }),
        useToast: () => ({ toast: { error: vi.fn(), success: vi.fn(), info: mocks.info } }),
        useConnectionType: () => ({ connectionType: undefined }),
        useMaxSpendable: () => ({ inputValue: "0", displayAmount: new BigNumber(0), amount: new BigNumber(0), gasFee, isLoading: false }),
        useGasFeeEstimator: () => ({ estimate: () => gasFee }),
        useFeeEstimate: () => ({ isPreferredSelected: false, isLoading: false }),
        usePausedMessages: (urls: string[]) => {
            const paused = urls.filter(u => mocks.paused.includes(u));
            return { paused, isPaused: paused.length > 0 };
        },
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
        getAddressFullMarketOrders: async () => { mocks.fetchOrders(); return mocks.myOrders; },
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
    mocks.paused = [];
    mocks.tx.mockReset();
    mocks.myOrders = [ORDER];
    mocks.balance = "0";
    mocks.info.mockReset();
    mocks.fetchOrders.mockReset();
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
        mocks.balance = "1000000000000";
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

describe("order book after the v8.3.0 in-tx execution", () => {
    const fill = (form: HTMLElement, label: string, value: string) =>
        fireEvent.change(within(form).getByLabelText(label), { target: { value } });
    const MERGE = /You already have an order at this price/;

    it("hints that a new order merges into the user's resting order at an equal price", async () => {
        renderPage();

        const sell = await screen.findByRole("group", { name: "Sell HALT" });
        await waitFor(() => expect(mocks.fetchOrders).toHaveBeenCalled());
        fill(sell, "Price", "2.000");

        expect(await within(sell).findByText(MERGE)).toBeInTheDocument();
        expect(within(sell).getByText(/moves to the back of the queue at this price/)).toBeInTheDocument();
    });

    it("shows no hint at another price or on the other side", async () => {
        renderPage();

        const sell = await screen.findByRole("group", { name: "Sell HALT" });
        const buy = screen.getByRole("group", { name: "Buy HALT" });
        await waitFor(() => expect(mocks.fetchOrders).toHaveBeenCalled());
        fill(sell, "Price", "3");
        fill(buy, "Price", "2");
        // positive control: the same sell price as the resting order does show the hint
        fill(sell, "Price", "2");
        expect(await within(sell).findByText(MERGE)).toBeInTheDocument();

        // only the sell form shows it, the buy form at the same price does not
        expect(screen.getAllByText(MERGE)).toHaveLength(1);
        fill(sell, "Price", "3");
        await waitFor(() => expect(screen.queryByText(MERGE)).toBeNull());
    });

    it("tells the user when part of an order was returned for hitting the fill cap", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ params: { maxFillsPerOrder: "250" } }) })));
        mocks.balance = "1000000000000";
        mocks.tx.mockImplementation(async (_msgs: unknown, options?: { onSuccess?: (r: unknown) => void }) => {
            options?.onSuccess?.({
                txhash: "H", height: 1, code: 0,
                events: [{ type: "bze.tradebin.OrderMessageRefundedEvent", attributes: [{ key: "reason", value: "\"max_fills_reached\"", index: true }] }],
            });
            return true;
        });
        renderPage();

        const buy = await screen.findByRole("group", { name: "Buy HALT" });
        fill(buy, "Price", "1");
        fill(buy, "Amount", "2");
        fireEvent.click(within(buy).getByRole("button", { name: "Buy HALT" }));

        await waitFor(() => expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("at most 250 resting orders")));
        vi.unstubAllGlobals();
    });

    it("reads the events from the node when the tx response carries none", async () => {
        const refund = { type: "bze.tradebin.OrderMessageRefundedEvent", attributes: [{ key: "reason", value: "\"max_fills_reached\"", index: true }] };
        vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
            ok: true,
            json: async () => (url.includes("/cosmos/tx/v1beta1/txs/H")
                ? { tx_response: { events: [refund] } }
                : { params: { maxFillsPerOrder: "250" } }),
        })));
        mocks.balance = "1000000000000";
        mocks.tx.mockImplementation(async (_msgs: unknown, options?: { onSuccess?: (r: unknown) => void }) => {
            options?.onSuccess?.({ txhash: "H", height: 1, code: 0, events: [] });
            return true;
        });
        renderPage();

        const buy = await screen.findByRole("group", { name: "Buy HALT" });
        fill(buy, "Price", "1");
        fill(buy, "Amount", "2");
        fireEvent.click(within(buy).getByRole("button", { name: "Buy HALT" }));

        await waitFor(() => expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("at most 250 resting orders")));
        vi.unstubAllGlobals();
    });

    it("stays quiet when no order was returned for the fill cap", async () => {
        mocks.balance = "1000000000000";
        mocks.tx.mockImplementation(async (_msgs: unknown, options?: { onSuccess?: (r: unknown) => void }) => {
            options?.onSuccess?.({ txhash: "H", height: 1, code: 0, events: [{ type: "bze.tradebin.OrderSavedEvent", attributes: [] }] });
            return true;
        });
        renderPage();

        const buy = await screen.findByRole("group", { name: "Buy HALT" });
        fill(buy, "Price", "1");
        fill(buy, "Amount", "2");
        fireEvent.click(within(buy).getByRole("button", { name: "Buy HALT" }));

        await waitFor(() => expect(mocks.tx).toHaveBeenCalledTimes(1));
        // the success handler ran inside tx(); let its promises settle before asserting
        await act(async () => { await Promise.resolve(); });
        expect(mocks.info).not.toHaveBeenCalled();
    });

    it("reloads Your Orders after a cancel the chain refused (order merged away)", async () => {
        mocks.tx.mockResolvedValue(false);
        renderPage();

        const cancelAll = await screen.findByRole("button", { name: "Cancel All" });
        await waitFor(() => expect(mocks.fetchOrders).toHaveBeenCalled());
        const before = mocks.fetchOrders.mock.calls.length;
        fireEvent.click(cancelAll);

        await waitFor(() => expect(mocks.fetchOrders.mock.calls.length).toBeGreaterThan(before));
    });
});

describe("trading page with paused message types", () => {
    const NOTICE = "This action is paused on BeeZee for now.";

    it("disables the buy and sell buttons and shows the notice when MsgCreateOrder is paused", async () => {
        mocks.paused = ["/bze.tradebin.MsgCreateOrder"];
        renderPage();

        expect(await screen.findByRole("button", { name: "Buy HALT" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Sell HALT" })).toBeDisabled();
        expect(screen.getAllByText(NOTICE).length).toBe(1);
    });

    it("disables cancelling when MsgCancelOrder is paused, and leaves the order forms alone", async () => {
        mocks.paused = ["/bze.tradebin.MsgCancelOrder"];
        renderPage();

        expect(await screen.findByRole("button", { name: "Cancel All" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Buy HALT" })).toBeEnabled();
        expect(screen.getAllByText(NOTICE).length).toBe(1);
    });

    it("shows nothing and keeps every button enabled when nothing is paused", async () => {
        renderPage();

        expect(await screen.findByRole("button", { name: "Buy HALT" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Cancel All" })).toBeEnabled();
        expect(screen.queryByText(NOTICE)).toBeNull();
    });
});
