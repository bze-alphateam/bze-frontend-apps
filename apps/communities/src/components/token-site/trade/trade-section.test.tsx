import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {type Asset, DEFAULT_DENOM_BRANDING, type TradeViewChart} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const TICKERS: Record<string, string> = {[T]: "PAGE", ubze: "BZE", uusdc: "USDC", uatom: "ATOM"};
const PRICES: Record<string, number> = {ubze: 0.001, uusdc: 1, uatom: 5};

// Every hook the section reads is mocked; the values below are per test.
const tx = vi.fn();
const connect = vi.fn();
const findOptimalRoute = vi.fn();
const getTradingViewIntervals = vi.fn();
let balances: Record<string, BigNumber> = {};
let pools: { id: string; base: string; quote: string }[] = [];
let poolUsd: Record<string, number> = {};
let walletStatus = WalletState.Connected;

const asset = (denom: string) => (TICKERS[denom] ? {denom, ticker: TICKERS[denom], decimals: 6} : undefined);

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getTradingViewIntervals: (...args: unknown[]) => getTradingViewIntervals(...args),
    ammRouter: {updatePools: vi.fn(), findOptimalRoute: (...args: unknown[]) => findOptimalRoute(...args)},
    useBalances: () => ({
        assetsBalances: Object.entries(balances).map(([denom, amount]) => ({
            denom, amount, ticker: TICKERS[denom], decimals: 6,
            USDValue: amount.dividedBy(1e6).multipliedBy(PRICES[denom] ?? 0),
        })),
    }),
    useLiquidityPools: () => ({
        pools,
        isLoading: false,
        poolsDataMap: new Map(Object.entries(poolUsd).map(([id, usd]) => [id, {usdValue: new BigNumber(usd)}])),
    }),
    useAssets: () => ({denomDecimals: () => 6, denomTicker: (denom: string) => TICKERS[denom] ?? denom, getAsset: asset}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useMaxSpendable: (denom: string) => {
        const amount = balances[denom] ?? new BigNumber(0);
        return {amount, inputValue: amount.dividedBy(1e6).toFixed(), isLoading: false};
    },
    useGasFeeEstimate: () => ({displayAmount: new BigNumber("0.02"), ticker: "BZE", isLoading: false}),
    useTradingFees: () => ({fees: {}, isLoading: false}),
    useFeeEstimate: () => ({isLoading: false, maxSpendReserve: () => undefined}),
    useCanAffordTx: () => ({canAfford: true, message: "", isLoading: false}),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: walletStatus, address: walletStatus === WalletState.Connected ? ME : undefined, connect}),
}));

// The pools table has its own suite (liquidity-pools.test.tsx).
vi.mock("./liquidity-pools", () => ({LiquidityPools: () => <div data-testid="liquidity-pools"/>}));
const feeMode = {isLoading: false, eligible: true, needsBze: false, feeDenom: "", optOut: false, setOptOut: vi.fn()};
vi.mock("@/hooks/token-site/useTokenFeeMode", () => ({
    useFeeMode: () => feeMode,
}));

import {TokenSiteTheme} from "../kit";
import {TradeSection} from "./trade-section";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n,
};

function renderSection() {
    const user = userEvent.setup();
    render(<TradeSection asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><div data-testid="page">{children}</div></TokenSiteTheme>
            </ChakraProvider>
        ),
    });
    return user;
}

const candle = (time: string, close: number): TradeViewChart => ({time, close, open: close, high: close, low: close, value: 1});

const route = (ids: string[], expectedOutput: string) => ({
    route: ids, path: [], pools: [], expectedOutput: new BigNumber(expectedOutput), priceImpact: new BigNumber("0.42"),
    totalFees: new BigNumber(0), feesPerHop: [],
});

const pool = (base: string, quote: string) => ({id: `${base}_${quote}`, base, quote});
const PAGE_BZE = pool(T, "ubze");
const ATOM_PAGE = pool("uatom", T);

beforeEach(() => {
    vi.clearAllMocks();
    walletStatus = WalletState.Connected;
    // PAGE/BZE, ATOM/PAGE (PAGE is the quote) and BZE/USDC; ATOM/PAGE holds the most liquidity.
    pools = [PAGE_BZE, ATOM_PAGE, pool("ubze", "uusdc")];
    poolUsd = {[PAGE_BZE.id]: 1_000, [ATOM_PAGE.id]: 5_000};
    balances = {ubze: new BigNumber("5000000000"), uusdc: new BigNumber("40000000"), [T]: new BigNumber("9000000")};
    getTradingViewIntervals.mockResolvedValue([candle("t1", 4), candle("t2", 5)]);
    findOptimalRoute.mockReturnValue(route(["pool-page-bze"], "1234567.9"));
});

describe("TradeSection", () => {
    it("is not rendered while T sits in no pool", () => {
        pools = [pool("ubze", "uusdc")];
        renderSection();

        expect(screen.getByTestId("page")).toBeEmptyDOMElement();
    });

    it("titles the section and shows the chart next to the swap panel", async () => {
        renderSection();

        expect(screen.getByRole("heading", {level: 2, name: "Buy and sell PAGE"})).toBeInTheDocument();
        expect(screen.getByTestId("swap-panel")).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId("pool-chart-line")).toBeInTheDocument());
    });
});

describe("PoolChart", () => {
    it("charts the most liquid pool over 30D, inverted when T is the quote", async () => {
        renderSection();

        expect(getTradingViewIntervals).toHaveBeenCalledWith(ATOM_PAGE.id, 240, 180);
        // ATOM/PAGE closes at 5 PAGE per ATOM, so PAGE is worth 0.2 ATOM.
        await waitFor(() => expect(screen.getByTestId("pool-chart-price")).toHaveTextContent("0.2 ATOM"));
        expect(screen.getByRole("img", {name: "PAGE price in ATOM, last 30D"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "PAGE / ATOM"})).toHaveAttribute("aria-pressed", "true");
    });

    it("refetches when the range or the pool changes", async () => {
        const user = renderSection();
        await screen.findByTestId("pool-chart-line");

        await user.click(screen.getByRole("button", {name: "7D"}));
        expect(getTradingViewIntervals).toHaveBeenLastCalledWith(ATOM_PAGE.id, 60, 168);

        await user.click(screen.getByRole("button", {name: "PAGE / BZE"}));
        expect(getTradingViewIntervals).toHaveBeenLastCalledWith(PAGE_BZE.id, 60, 168);
        // PAGE is the base here: the close is already BZE per PAGE.
        await waitFor(() => expect(screen.getByTestId("pool-chart-price")).toHaveTextContent("5 BZE"));

        await user.click(screen.getByRole("button", {name: "90D"}));
        expect(getTradingViewIntervals).toHaveBeenLastCalledWith(PAGE_BZE.id, 1440, 90);
    });

    it("says so when the range has no trades", async () => {
        getTradingViewIntervals.mockResolvedValue([]);
        renderSection();

        expect(await screen.findByText("No trades in this range yet")).toBeInTheDocument();
        expect(screen.queryByTestId("pool-chart-line")).not.toBeInTheDocument();
    });

    it("hides the pool chips when T sits in one pool only", async () => {
        pools = [PAGE_BZE];
        renderSection();

        await screen.findByTestId("pool-chart-line");
        expect(screen.queryByRole("group", {name: "Pool"})).not.toBeInTheDocument();
        expect(getTradingViewIntervals).toHaveBeenCalledWith(PAGE_BZE.id, 240, 180);
    });
});

describe("SwapPanel", () => {
    it("asks for a wallet when none is connected", async () => {
        walletStatus = WalletState.Disconnected;
        const user = renderSection();

        const prompt = screen.getByTestId("trade-connect-prompt");
        expect(prompt).toHaveTextContent("Connect a wallet to buy PAGE");
        expect(screen.queryByTestId("trade-form")).not.toBeInTheDocument();

        await user.click(within(prompt).getByRole("button", {name: "Connect wallet"}));
        expect(connect).toHaveBeenCalledTimes(1);
    });

    it("buys T with the most valuable payable token", async () => {
        const user = renderSection();

        const select = screen.getByLabelText("Pay with");
        expect(select).toHaveValue("uusdc");
        expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["USDC", "BZE"]);

        await user.type(screen.getByLabelText("You pay"), "10");
        expect(findOptimalRoute).toHaveBeenLastCalledWith("uusdc", T, new BigNumber("10000000"), 3);
        expect(screen.getByTestId("trade-quote")).toHaveTextContent("1.23 PAGE");

        await user.click(screen.getByRole("button", {name: "Buy PAGE"}));

        const [msg] = tx.mock.calls[0][0];
        expect(msg.typeUrl).toBe("/bze.tradebin.MsgMultiSwap");
        expect(msg.value).toEqual({
            creator: ME,
            routes: ["pool-page-bze"],
            input: {denom: "uusdc", amount: "10000000"},
            minOutput: {denom: T, amount: "1222222"},
        });
    });

    it("sells T into BZE by default, offering every token T reaches", async () => {
        const user = renderSection();

        await user.click(screen.getByRole("tab", {name: "Sell"}));

        const select = screen.getByLabelText("Receive");
        expect(select).toHaveValue("ubze");
        // BZE first, then by ticker; USDC is reached through BZE.
        expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["BZE", "ATOM", "USDC"]);
        expect(screen.getByTestId("trade-form")).toHaveTextContent("Balance 9 PAGE");

        await user.type(screen.getByLabelText("You sell"), "2.5");
        expect(findOptimalRoute).toHaveBeenLastCalledWith(T, "ubze", new BigNumber("2500000"), 3);
        expect(screen.getByTestId("trade-quote")).toHaveTextContent("You receive1.23");

        await user.click(screen.getByRole("button", {name: "Sell PAGE"}));

        const [msg] = tx.mock.calls[0][0];
        expect(msg.value).toEqual({
            creator: ME,
            routes: ["pool-page-bze"],
            input: {denom: T, amount: "2500000"},
            minOutput: {denom: "ubze", amount: "1222222"},
        });
    });

    it("never asks for a zero minimum output, which the chain rejects", async () => {
        // A route paying 1 base unit: 1 % under it rounds down to 0, so the minimum is clamped to 1.
        findOptimalRoute.mockReturnValue(route(["pool-page-bze"], "1"));
        const user = renderSection();

        await user.type(screen.getByLabelText("You pay"), "10");
        await user.click(screen.getByRole("button", {name: "Buy PAGE"}));

        const [msg] = tx.mock.calls[0][0];
        expect(msg.value.minOutput).toEqual({denom: T, amount: "1"});
    });

    it("sells into the token picked", async () => {
        const user = renderSection();
        await user.click(screen.getByRole("tab", {name: "Sell"}));

        await user.selectOptions(screen.getByLabelText("Receive"), "uatom");
        await user.type(screen.getByLabelText("You sell"), "1");

        expect(findOptimalRoute).toHaveBeenLastCalledWith(T, "uatom", new BigNumber("1000000"), 3);
    });

    it("blocks selling more T than the wallet holds", async () => {
        const user = renderSection();
        await user.click(screen.getByRole("tab", {name: "Sell"}));

        await user.type(screen.getByLabelText("You sell"), "10");

        expect(screen.getByRole("alert")).toHaveTextContent("Insufficient PAGE balance");
        expect(screen.getByRole("button", {name: "Sell PAGE"})).toBeDisabled();
    });

    it("blocks a swap without a route", async () => {
        findOptimalRoute.mockReturnValue(null);
        const user = renderSection();

        await user.type(screen.getByLabelText("You pay"), "10");

        expect(screen.getByRole("alert")).toHaveTextContent("No route for this amount");
        expect(screen.getByRole("button", {name: "Buy PAGE"})).toBeDisabled();
    });

    it("starts the other side afresh", async () => {
        const user = renderSection();

        await user.type(screen.getByLabelText("You pay"), "10");
        await user.click(screen.getByRole("tab", {name: "Sell"}));

        expect(screen.getByLabelText("You sell")).toHaveValue("");
    });
});
