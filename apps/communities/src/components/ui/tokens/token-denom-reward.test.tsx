import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {
    AssetsContext,
    SettingsProvider,
    setInLocalStorage,
    type Asset,
    type AssetsContextType,
    type UseTokenDenomRewardResult,
} from "@bze/bze-ui-kit";

// The section's data hook is mocked; everything else (panels, gas engine, formatting) is the real
// ui-kit, with assets and balances coming through its context as in the app.
const useTokenDenomReward = vi.fn<(denom: string, address?: string) => UseTokenDenomRewardResult>();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useTokenDenomReward: (denom: string, address?: string) => useTokenDenomReward(denom, address),
}));

let walletAddress: string | undefined = "bze1test";
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({
        address: walletAddress,
        status: walletAddress ? WalletState.Connected : WalletState.Disconnected,
        wallet: undefined,
        chain: undefined,
        getSigningClient: vi.fn(),
        signingClientError: undefined,
        disconnect: vi.fn(),
        getRpcEndpoint: vi.fn(),
    }),
}));

import {TokenDenomReward} from "./token-denom-reward";

beforeAll(() => {
    setInLocalStorage("tradebin_params", JSON.stringify({
        minNativeLiquidityForModuleSwap: "100000000000",
        createMarketFee: {denom: "ubze", amount: "1000000"},
        marketMakerFee: {denom: "ubze", amount: "1000"},
        marketTakerFee: {denom: "ubze", amount: "2000"},
    }), 60_000);
    setInLocalStorage("txfeecollector_params", JSON.stringify({
        validatorMinGasFee: {denom: "ubze", amount: "0.02"},
    }), 60_000);
});

const TOKEN_DENOM = "factory/bze1creator/tok";

function makeAsset(ticker: string, denom: string): Asset {
    return {
        type: denom === "ubze" ? "native" : "factory",
        denom, decimals: 6, name: `${ticker} Token`, ticker, logo: "", stable: false, verified: true, supply: 1_000_000n,
    } as Asset;
}

const BZE = makeAsset("BZE", "ubze");
const TOK = makeAsset("TOK", TOKEN_DENOM);
const noop = () => {};

function assetsContext(tokBalance: BigNumber): AssetsContextType {
    return {
        assetsMap: new Map([[BZE.denom, BZE], [TOK.denom, TOK]]),
        updateAssets: async () => new Map(),
        marketsMap: new Map(),
        updateMarkets: noop,
        marketsDataMap: new Map(),
        updateMarketsData: async () => new Map(),
        poolsMap: new Map(),
        poolsDataMap: new Map(),
        updateLiquidityPools: async () => {},
        balancesMap: new Map([
            [BZE.denom, {denom: BZE.denom, amount: new BigNumber(10).shiftedBy(6)}],
            [TOK.denom, {denom: TOK.denom, amount: tokBalance}],
        ]),
        updateBalances: noop,
        usdPricesMap: new Map(),
        isLoading: false,
        isLoadingPrices: false,
        ibcChains: [],
        epochs: new Map(),
        updateEpochs: noop,
        connectionType: "none",
        updateConnectionType: noop,
    } as unknown as AssetsContextType;
}

function renderSection(tokBalance = new BigNumber(50).shiftedBy(6)) {
    return render(<TokenDenomReward asset={TOK}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <SettingsProvider>
                    <AssetsContext.Provider value={assetsContext(tokBalance)}>{children}</AssetsContext.Provider>
                </SettingsProvider>
            </ChakraProvider>
        ),
    });
}

// min stake 10 TOK, 7-day lock, 1000 TOK staked in total, pays 5 BZE a day
const DR = {staking_denom: TOKEN_DENOM, lock: 7, min_stake: "10000000", staked_amount: "1000000000"};
const PAYS = [{denom: "ubze", amount: "5000000"}];
const positionOf = (amount: string, pending = [{denom: "ubze", amount: "1500000"}]) => ({
    participant: {address: "bze1test", staking_denom: TOKEN_DENOM, amount}, pending,
});

const hookResult = (extra: Partial<UseTokenDenomRewardResult> = {}): UseTokenDenomRewardResult => ({
    item: {denomReward: DR, dailyPrizes: PAYS, unlocks: []},
    prizeDenoms: ["ubze"],
    isLoading: false,
    hasError: false,
    reload: vi.fn(async () => {}),
    ...extra,
});

beforeEach(() => {
    walletAddress = "bze1test";
    useTokenDenomReward.mockReset();
});

describe("TokenDenomReward", () => {
    it("reads the DR of this token for the connected wallet", () => {
        useTokenDenomReward.mockReturnValue(hookResult());
        renderSection();
        expect(useTokenDenomReward).toHaveBeenCalledWith(TOKEN_DENOM, "bze1test");
    });

    it("shows the summary and Stake only to a wallet without a position", () => {
        useTokenDenomReward.mockReturnValue(hookResult());
        renderSection();

        expect(screen.getByTestId("token-denom-reward")).toHaveTextContent("Paying daily");
        expect(screen.getByText("5 BZE")).toBeInTheDocument();
        expect(screen.getByText("1K TOK")).toBeInTheDocument();
        expect(screen.getByText("7 days")).toBeInTheDocument();
        expect(screen.getByText("10 TOK")).toBeInTheDocument();
        expect(screen.getByTestId("token-denom-reward-prizes")).toHaveTextContent("BZE");
        expect(screen.getByRole("button", {name: "Stake"})).toBeEnabled();
        expect(screen.queryByRole("button", {name: "Claim"})).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Exit"})).not.toBeInTheDocument();
    });

    it("shows my stake and the chain's pending prizes, with Add, Claim and Exit", () => {
        useTokenDenomReward.mockReturnValue(hookResult({
            item: {denomReward: DR, dailyPrizes: PAYS, position: positionOf("20000000"), unlocks: []},
        }));
        renderSection();

        expect(screen.getByTestId("token-denom-reward-my-stake")).toHaveTextContent("20 TOK");
        expect(screen.getByTestId("token-denom-reward-pending")).toHaveTextContent("1.5 BZE");
        expect(screen.getByRole("button", {name: "Add"})).toBeEnabled();
        expect(screen.getByRole("button", {name: "Claim"})).toBeEnabled();
        expect(screen.getByRole("button", {name: "Exit"})).toBeEnabled();
    });

    it("disables Claim while nothing is pending and says why", () => {
        useTokenDenomReward.mockReturnValue(hookResult({
            item: {denomReward: DR, dailyPrizes: PAYS, position: positionOf("20000000", [{denom: "ubze", amount: "0"}]), unlocks: []},
        }));
        renderSection();

        expect(screen.getByTestId("token-denom-reward-pending")).toHaveTextContent("Nothing to claim yet.");
        expect(screen.getByRole("button", {name: "Claim"})).toBeDisabled();
        expect(screen.getByTestId("token-denom-reward-blockers")).toHaveTextContent("Nothing to claim yet.");
    });

    it("explains a disabled Stake below the minimum and labels an airdrops-only DR", () => {
        useTokenDenomReward.mockReturnValue(hookResult({item: {denomReward: DR, dailyPrizes: [], unlocks: []}}));
        renderSection(new BigNumber(1_000_000));

        expect(screen.getByText(/airdrops only/)).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Stake"})).toBeDisabled();
        expect(screen.getByTestId("token-denom-reward-blockers")).toHaveTextContent(/below the minimum stake/);
    });

    it("opens the shared stake panel with the top-up disclosure", () => {
        useTokenDenomReward.mockReturnValue(hookResult({
            item: {denomReward: DR, dailyPrizes: PAYS, position: positionOf("20000000"), unlocks: []},
        }));
        renderSection();

        fireEvent.click(screen.getByRole("button", {name: "Add"}));

        expect(screen.getByText("Add to your TOK stake")).toBeInTheDocument();
        expect(screen.getByText(/Adding pays out your pending prizes first/)).toBeInTheDocument();
    });

    it("shows a quiet empty state with the Factory link when the token has no DR", () => {
        useTokenDenomReward.mockReturnValue(hookResult({item: undefined, prizeDenoms: []}));
        renderSection();

        expect(screen.getByTestId("token-denom-reward-empty")).toHaveTextContent("No denom reward for TOK yet.");
        expect(screen.getByRole("link", {name: /Factory/})).toHaveAttribute(
            "href", "https://factory.getbze.com/manage/token?denom=factory%2Fbze1creator%2Ftok",
        );
        expect(screen.queryByTestId("token-denom-reward")).not.toBeInTheDocument();
    });

    it("offers a retry when the DR cannot be read", () => {
        const result = hookResult({item: undefined, hasError: true});
        useTokenDenomReward.mockReturnValue(result);
        renderSection();

        fireEvent.click(screen.getByRole("button", {name: /Retry/}));
        expect(result.reload).toHaveBeenCalled();
    });
});
