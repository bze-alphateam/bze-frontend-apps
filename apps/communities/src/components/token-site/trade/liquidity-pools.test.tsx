import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {type Asset, DEFAULT_DENOM_BRANDING, type LiquidityPoolData} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const ABC = "factory/bze1abc/uabc";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const TICKERS: Record<string, string> = {[T]: "PAGE", ubze: "BZE", uusdc: "USDC", [ABC]: "ABC"};

const pool = (base: string, quote: string, reserveBase: string, reserveQuote: string): LiquidityPoolSDKType => ({
    id: `${base}_${quote}`, base, quote, lp_denom: `ulp_${base}_${quote}`, creator: "bze1creator",
    fee: "0.003", fee_dest: {treasury: "0", burner: "0", providers: "1", liquidity: "0"},
    reserve_base: reserveBase, reserve_quote: reserveQuote, stable: false,
});

// 1,000 PAGE / 4,000 BZE (PAGE is the base); 2,000 ABC / 500 PAGE (PAGE is the quote); one pool without PAGE.
const PAGE_BZE = pool(T, "ubze", "1000000000", "4000000000");
const ABC_PAGE = pool(ABC, T, "2000000000", "500000000");
const BZE_USDC = pool("ubze", "uusdc", "1", "1");

const stats = (id: string, usdValue: number, usdVolume: number, apr: string): LiquidityPoolData => ({
    poolId: id, base: "", quote: "", usdValue: new BigNumber(usdValue), usdVolume: new BigNumber(usdVolume),
    usdFees: new BigNumber(0), isComplete: true, apr, baseVolume: new BigNumber(0), quoteVolume: new BigNumber(0),
});

// Every hook the table reads is mocked; the values below are per test.
const tx = vi.fn();
const connect = vi.fn();
const updateBalances = vi.fn();
const updateLiquidityPools = vi.fn();
let walletStatus = WalletState.Connected;
let balances: Record<string, BigNumber> = {};
let shares: Record<string, BigNumber> = {};
const TOTAL_SHARES = new BigNumber("1000000000");

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useLiquidityPools: () => ({
        pools: [BZE_USDC, PAGE_BZE, ABC_PAGE],
        poolsDataMap: new Map([
            [PAGE_BZE.id, stats(PAGE_BZE.id, 8000, 0, "0.00")],
            [ABC_PAGE.id, stats(ABC_PAGE.id, 12000, 640, "5.84")],
            [BZE_USDC.id, stats(BZE_USDC.id, 1e9, 1e6, "99.00")],
        ]),
        isLoading: false,
        updateLiquidityPools,
    }),
    useLiquidityPool: (poolId: string) => ({userShares: shares[poolId] ?? new BigNumber(0), totalShares: TOTAL_SHARES}),
    useAssets: () => ({denomTicker: (denom: string) => TICKERS[denom] ?? denom, denomDecimals: () => 6}),
    useAssetsContext: () => ({updateBalances}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useMaxSpendable: (denom: string) => {
        const balance = balances[denom] ?? new BigNumber(0);
        return {amount: balance, balance, inputValue: balance.dividedBy(1e6).toFixed(), isLoading: false};
    },
    useCanAffordTx: () => ({
        canAfford: true, message: "", isLoading: false, gasFee: {displayAmount: new BigNumber("0.02"), ticker: "BZE"},
    }),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: walletStatus, address: walletStatus === WalletState.Connected ? ME : undefined, connect}),
}));

import {TokenSiteTheme} from "../kit";
import {LiquidityPools} from "./liquidity-pools";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n,
};

function renderTable() {
    const user = userEvent.setup();
    render(<LiquidityPools asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return user;
}

const row = (p: LiquidityPoolSDKType) => screen.getByTestId(`liquidity-pool-${p.id}`);

beforeEach(() => {
    vi.clearAllMocks();
    walletStatus = WalletState.Connected;
    balances = {[T]: new BigNumber(500e6), ubze: new BigNumber(1000e6), [ABC]: new BigNumber(1000e6)};
    shares = {};
    tx.mockResolvedValue(true);
});

describe("LiquidityPools", () => {
    it("lists exactly the pools containing PAGE, the most liquidity first, with their numbers", () => {
        shares = {[ABC_PAGE.id]: new BigNumber(25e6)};
        renderTable();

        expect(screen.getByRole("heading", {name: "Liquidity pools"})).toBeInTheDocument();
        const rows = screen.getAllByTestId(/^liquidity-pool-/);
        expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual([`liquidity-pool-${ABC_PAGE.id}`, `liquidity-pool-${PAGE_BZE.id}`]);

        // T always comes first in the pair, whichever side of the pool it is.
        const abc = row(ABC_PAGE);
        expect(abc).toHaveTextContent("PAGE / ABC");
        expect(within(abc).getByTestId("pool-liquidity")).toHaveTextContent("$12,000.00");
        expect(within(abc).getByTestId("pool-volume")).toHaveTextContent("$640.00");
        expect(within(abc).getByTestId("pool-apr")).toHaveTextContent("5.8%");
        expect(within(abc).getByTestId("pool-share")).toHaveTextContent("2.5%");

        // No volume, no APR; no shares, no share.
        const bze = row(PAGE_BZE);
        expect(bze).toHaveTextContent("PAGE / BZE");
        expect(within(bze).getByTestId("pool-volume")).toHaveTextContent("$0.00");
        expect(within(bze).getByTestId("pool-apr")).toHaveTextContent("—");
        expect(within(bze).getByTestId("pool-share")).toHaveTextContent("—");
    });

    it("offers Remove only on the pools the viewer has shares in", () => {
        shares = {[ABC_PAGE.id]: new BigNumber(25e6)};
        renderTable();

        expect(within(row(ABC_PAGE)).getByRole("button", {name: "Remove liquidity from PAGE / ABC"})).toBeInTheDocument();
        expect(within(row(PAGE_BZE)).queryByRole("button", {name: /^Remove/})).not.toBeInTheDocument();
        expect(within(row(PAGE_BZE)).getByRole("button", {name: "Add liquidity to PAGE / BZE"})).toBeInTheDocument();
    });

    it("asks for a wallet when adding liquidity without one", async () => {
        walletStatus = WalletState.Disconnected;
        const user = renderTable();

        await user.click(screen.getByRole("button", {name: "Add liquidity to PAGE / BZE"}));

        const prompt = screen.getByTestId("liquidity-connect-prompt");
        expect(prompt).toHaveTextContent("Connect a wallet to add liquidity to the PAGE / BZE pool.");
        expect(screen.queryByTestId("add-liquidity-form")).not.toBeInTheDocument();
        await user.click(within(prompt).getByRole("button", {name: "Connect wallet"}));
        expect(connect).toHaveBeenCalled();
    });

    it("opens one form at a time and closes it again", async () => {
        const user = renderTable();

        await user.click(screen.getByRole("button", {name: "Add liquidity to PAGE / BZE"}));
        expect(screen.getByTestId("add-liquidity-form")).toBeInTheDocument();

        await user.click(screen.getByRole("button", {name: "Add liquidity to PAGE / ABC"}));
        expect(screen.getAllByTestId("add-liquidity-form")).toHaveLength(1);
        expect(screen.getByRole("button", {name: "Close adding to PAGE / ABC"})).toHaveAttribute("aria-expanded", "true");

        await user.click(screen.getByRole("button", {name: "Close adding to PAGE / ABC"}));
        expect(screen.queryByTestId("add-liquidity-form")).not.toBeInTheDocument();
    });

    it("keeps the pool ratio both ways and adds PAGE as the base of PAGE/BZE", async () => {
        const user = renderTable();
        await user.click(screen.getByRole("button", {name: "Add liquidity to PAGE / BZE"}));
        const form = screen.getByTestId("add-liquidity-form");
        const page = within(form).getByLabelText("PAGE");
        const bze = within(form).getByLabelText("BZE");

        await user.type(bze, "80");
        expect(page).toHaveValue("20");

        await user.clear(page);
        await user.type(page, "10");
        expect(bze).toHaveValue("40");
        // 10 PAGE of 1,000 mints 1% of 1e9 shares: 10M of 1.01B after the deposit.
        expect(within(form).getByTestId("add-liquidity-share")).toHaveTextContent("you'd own ≈0.99% of the pool");

        await user.click(within(form).getByRole("button", {name: "Add liquidity"}));

        expect(tx).toHaveBeenCalledTimes(1);
        expect(tx.mock.calls[0][0]).toEqual([{
            typeUrl: "/bze.tradebin.MsgAddLiquidity",
            value: {creator: ME, poolId: PAGE_BZE.id, baseAmount: "10000000", quoteAmount: "40000000", minLpTokens: "9900000"},
        }]);
        await waitFor(() => expect(screen.queryByTestId("add-liquidity-form")).not.toBeInTheDocument());
        expect(updateBalances).toHaveBeenCalled();
        expect(updateLiquidityPools).toHaveBeenCalled();
    });

    it("sends PAGE as the quote of ABC/PAGE, with the chosen slippage", async () => {
        const user = renderTable();
        await user.click(screen.getByRole("button", {name: "Add liquidity to PAGE / ABC"}));
        const form = screen.getByTestId("add-liquidity-form");

        // 2,000 ABC per 500 PAGE: 5 PAGE pairs with 20 ABC.
        await user.type(within(form).getByLabelText("PAGE"), "5");
        expect(within(form).getByLabelText("ABC")).toHaveValue("20");
        await user.click(within(form).getByRole("button", {name: "2%"}));
        await user.click(within(form).getByRole("button", {name: "Add liquidity"}));

        expect(tx.mock.calls[0][0]).toEqual([{
            typeUrl: "/bze.tradebin.MsgAddLiquidity",
            value: {creator: ME, poolId: ABC_PAGE.id, baseAmount: "20000000", quoteAmount: "5000000", minLpTokens: "9800000"},
        }]);
    });

    it("won't add more than the wallet holds", async () => {
        balances = {[T]: new BigNumber(500e6), ubze: new BigNumber(30e6)};
        const user = renderTable();
        await user.click(screen.getByRole("button", {name: "Add liquidity to PAGE / BZE"}));
        const form = screen.getByTestId("add-liquidity-form");

        await user.type(within(form).getByLabelText("PAGE"), "10");

        expect(within(form).getByRole("alert")).toHaveTextContent("Insufficient BZE balance");
        expect(within(form).getByLabelText("BZE")).toHaveAttribute("aria-invalid", "true");
        expect(within(form).getByRole("button", {name: "Add liquidity"})).toBeDisabled();
    });

    it("fills both sides from Max on one side", async () => {
        balances = {[T]: new BigNumber(500e6), ubze: new BigNumber(4000e6)};
        const user = renderTable();
        await user.click(screen.getByRole("button", {name: "Add liquidity to PAGE / BZE"}));
        const form = screen.getByTestId("add-liquidity-form");

        await user.click(within(form).getByRole("button", {name: "Max PAGE"}));

        expect(within(form).getByLabelText("PAGE")).toHaveValue("500");
        expect(within(form).getByLabelText("BZE")).toHaveValue("2000");
    });

    it("removes a part of the viewer's shares, expecting at least the estimate minus the slippage", async () => {
        // 100M of 1B shares: 10% of the ABC/PAGE reserves.
        shares = {[ABC_PAGE.id]: new BigNumber(100e6)};
        const user = renderTable();
        await user.click(screen.getByRole("button", {name: "Remove liquidity from PAGE / ABC"}));
        const form = screen.getByTestId("remove-liquidity-form");
        expect(within(form).getByRole("button", {name: "Remove liquidity"})).toBeDisabled();

        await user.click(within(form).getByRole("button", {name: "50%"}));

        const estimate = within(form).getByTestId("remove-liquidity-estimate");
        expect(estimate).toHaveTextContent("PAGE25");
        expect(estimate).toHaveTextContent("ABC100");

        await user.click(within(form).getByRole("button", {name: "Remove liquidity"}));

        expect(tx.mock.calls[0][0]).toEqual([{
            typeUrl: "/bze.tradebin.MsgRemoveLiquidity",
            value: {creator: ME, poolId: ABC_PAGE.id, lpTokens: "50000000", minBase: "99000000", minQuote: "24750000"},
        }]);
        await waitFor(() => expect(screen.queryByTestId("remove-liquidity-form")).not.toBeInTheDocument());
    });
});
