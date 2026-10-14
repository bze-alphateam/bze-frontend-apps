import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {type Asset, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const TICKERS: Record<string, string> = {[T]: "PAGE", ubze: "BZE", uusdc: "USDC", uatom: "ATOM", uosmo: "OSMO"};
const PRICES: Record<string, number> = {ubze: 0.001, uusdc: 1, uatom: 5, uosmo: 0.5};

// Every hook the tab reads is mocked; the values below are per test.
const tx = vi.fn();
const findOptimalRoute = vi.fn();
const useMaxSpendable = vi.fn();
let balances: Record<string, BigNumber> = {};
let pools: { base: string; quote: string }[] = [];
let feeMessage = "";

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    ammRouter: {updatePools: vi.fn(), findOptimalRoute: (...args: unknown[]) => findOptimalRoute(...args)},
    useBalances: () => ({
        assetsBalances: Object.entries(balances).map(([denom, amount]) => ({
            denom, amount, ticker: TICKERS[denom], decimals: 6,
            USDValue: amount.dividedBy(1e6).multipliedBy(PRICES[denom] ?? 0),
        })),
    }),
    useLiquidityPools: () => ({pools, isLoading: false}),
    useAssets: () => ({denomDecimals: () => 6, denomTicker: (denom: string) => TICKERS[denom] ?? denom}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useMaxSpendable: (denom: string, spec: unknown) => useMaxSpendable(denom, spec),
    useGasFeeEstimate: () => ({displayAmount: new BigNumber("0.02"), ticker: "BZE", isLoading: false}),
    useCanAffordTx: () => ({canAfford: feeMessage === "", message: feeMessage, isLoading: false}),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status: WalletState.Connected, address: ME}),
}));
type FeeMode = {isLoading: boolean; eligible: boolean; needsBze: boolean; feeDenom: string; optOut: boolean; setOptOut: (optOut: boolean) => void};
let feeMode: FeeMode = {isLoading: false, eligible: true, needsBze: false, feeDenom: "", optOut: false, setOptOut: vi.fn()};
vi.mock("@/hooks/token-site/useTokenFeeMode", () => ({
    useFeeMode: () => feeMode,
}));

import {TokenWalletProvider} from "@/hooks/token-site/useTokenWallet";
import {TokenSiteTheme} from "../kit";
import {GetTab} from "./get-tab";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n,
};

function renderTab() {
    const user = userEvent.setup();
    render(<GetTab asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><TokenWalletProvider>{children}</TokenWalletProvider></TokenSiteTheme></ChakraProvider>
        ),
    });
    return user;
}

const route = (pools: string[], expectedOutput: string) => ({
    route: pools, path: [], pools: [], expectedOutput: new BigNumber(expectedOutput), priceImpact: new BigNumber("0.42"),
    totalFees: new BigNumber(0), feesPerHop: [],
});

const amountField = () => screen.getByLabelText("You pay");
const getButton = () => screen.getByRole("button", {name: "Get PAGE"});

beforeEach(() => {
    vi.clearAllMocks();
    feeMode = {isLoading: false, eligible: true, needsBze: false, feeDenom: T, optOut: false, setOptOut: vi.fn()};
    // T/BZE and BZE/USDC: USDC pays through BZE; OSMO has no pool at all.
    pools = [{base: T, quote: "ubze"}, {base: "ubze", quote: "uusdc"}];
    balances = {
        ubze: new BigNumber("5000000000"), // 5,000 BZE ≈ $5
        uusdc: new BigNumber("40000000"), // 40 USDC
        [T]: new BigNumber("9000000"),
        uatom: new BigNumber(0),
        uosmo: new BigNumber("900000000"), // $450 but no route
    };
    feeMessage = "";
    findOptimalRoute.mockReturnValue(route(["pool-usdc-bze", "pool-bze-page"], "1234567.9"));
    useMaxSpendable.mockImplementation((denom: string) => {
        // Paying the fee in BZE keeps 0.02 BZE back.
        const amount = denom === "ubze" ? balances.ubze.minus(20000) : balances[denom] ?? new BigNumber(0);
        return {amount, inputValue: amount.dividedBy(1e6).toFixed(), isLoading: false};
    });
    tx.mockResolvedValue(true);
});

describe("GetTab", () => {
    it("says nothing about BZE fees while T pays its own", () => {
        renderTab();
        expect(screen.queryByTestId("bze-fee-notice")).not.toBeInTheDocument();
    });

    it("shows the BZE notice above the button in low-liquidity mode", () => {
        feeMode = {...feeMode, eligible: false, needsBze: true, feeDenom: "ubze"};
        renderTab();

        expect(screen.getByTestId("bze-fee-notice")).toHaveTextContent("PAGE runs on the BeeZee network. Each transaction needs a small amount of BZE for the network fee.");
    });

    it("pays with held tokens that route to T, the most valuable preselected", () => {
        renderTab();

        const select = screen.getByRole("combobox", {name: "Pay with"});
        expect(select).toHaveValue("uusdc");
        expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["USDC", "BZE"]);
    });

    it("swaps USDC into T through BZE with the minimum output rounded down", async () => {
        const user = renderTab();

        await user.type(amountField(), "10");

        expect(findOptimalRoute).toHaveBeenLastCalledWith("uusdc", T, new BigNumber("10000000"), 3);
        expect(screen.getByTestId("get-quote")).toHaveTextContent("1.23 PAGE");
        expect(screen.getByTestId("get-quote")).toHaveTextContent("Price impact0.42%");
        expect(screen.getByTestId("get-quote")).toHaveTextContent("Network fee≈ 0.02 BZE");

        await user.click(getButton());

        expect(tx).toHaveBeenCalledTimes(1);
        const [msg] = tx.mock.calls[0][0];
        expect(msg.typeUrl).toBe("/bze.tradebin.MsgMultiSwap");
        expect(msg.value).toEqual({
            creator: ME,
            routes: ["pool-usdc-bze", "pool-bze-page"],
            input: {denom: "uusdc", amount: "10000000"},
            minOutput: {denom: T, amount: "1222222"},
        });
        await waitFor(() => expect(amountField()).toHaveValue(""));
    });

    it("swaps BZE into T with the slippage picked", async () => {
        findOptimalRoute.mockReturnValue(route(["pool-bze-page"], "1000"));
        const user = renderTab();

        await user.selectOptions(screen.getByRole("combobox", {name: "Pay with"}), "ubze");
        await user.type(amountField(), "2.5");
        await user.click(screen.getByRole("button", {name: "2%"}));
        await user.click(getButton());

        expect(tx.mock.calls[0][0][0].value).toEqual({
            creator: ME,
            routes: ["pool-bze-page"],
            input: {denom: "ubze", amount: "2500000"},
            minOutput: {denom: T, amount: "980"},
        });
    });

    it("keeps the network fee back on Max when paying with the fee token", async () => {
        const user = renderTab();

        await user.selectOptions(screen.getByRole("combobox", {name: "Pay with"}), "ubze");
        await user.click(screen.getByRole("button", {name: "Max"}));

        expect(amountField()).toHaveValue("4999.98");
        expect(useMaxSpendable).toHaveBeenLastCalledWith("ubze", {kind: "swap", count: 2});
    });

    it("says T is not tradable yet when it sits in no pool", () => {
        pools = [{base: "ubze", quote: "uusdc"}];
        renderTab();

        expect(screen.getByTestId("get-not-tradable")).toHaveTextContent("Not tradable yet");
        expect(screen.queryByRole("button", {name: "Get PAGE"})).not.toBeInTheDocument();
    });

    it("refuses an amount without a route", async () => {
        findOptimalRoute.mockReturnValue(null);
        const user = renderTab();

        await user.type(amountField(), "10");

        expect(screen.getByRole("alert")).toHaveTextContent("No route for this amount");
        expect(getButton()).toBeDisabled();
    });

    it("refuses more than the balance", async () => {
        const user = renderTab();

        await user.type(amountField(), "41");

        expect(screen.getByRole("alert")).toHaveTextContent("Insufficient USDC balance");
        expect(getButton()).toBeDisabled();
        await user.click(getButton());
        expect(tx).not.toHaveBeenCalled();
    });

    it("refuses an amount that leaves nothing for the network fee", async () => {
        feeMessage = "Not enough BZE left for the network fee (≈ 0.02 BZE)";
        const user = renderTab();

        await user.type(amountField(), "10");

        expect(screen.getByRole("alert")).toHaveTextContent("Not enough BZE left for the network fee");
        expect(getButton()).toBeDisabled();
    });
});
