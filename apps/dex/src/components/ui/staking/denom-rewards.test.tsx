import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {
    AssetsContext,
    DenomRewardExitPanel,
    DenomRewardStakePanel,
    SettingsProvider,
    setInLocalStorage,
    type Asset,
    type AssetsContextType,
    type DenomRewardHolderItem,
} from "@bze/bze-ui-kit";
import { DenomRewardBox, denomRewardActionBlockers } from "@/components/ui/staking/denom-reward-box";
import { filterDenomRewardItems } from "@/components/ui/staking/denom-rewards-section";

// The panels are the shared ui-kit bodies running the REAL gas engine; only the wallet is mocked
// and assets/balances come through the ui-kit context, as in the app.
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({
        address: "bze1test",
        status: WalletState.Connected,
        wallet: undefined,
        chain: undefined,
        getSigningClient: vi.fn(),
        signingClientError: undefined,
        disconnect: vi.fn(),
        getRpcEndpoint: vi.fn(),
    }),
}));

beforeAll(() => {
    setInLocalStorage("tradebin_params", JSON.stringify({
        minNativeLiquidityForModuleSwap: "100000000000",
        createMarketFee: { denom: "ubze", amount: "1000000" },
        marketMakerFee: { denom: "ubze", amount: "1000" },
        marketTakerFee: { denom: "ubze", amount: "2000" },
    }), 60_000);
    setInLocalStorage("txfeecollector_params", JSON.stringify({
        validatorMinGasFee: { denom: "ubze", amount: "0.02" },
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
            [BZE.denom, { denom: BZE.denom, amount: new BigNumber(10).shiftedBy(6) }],
            [TOK.denom, { denom: TOK.denom, amount: tokBalance }],
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

function renderWith(ui: ReactNode, tokBalance = new BigNumber(50).shiftedBy(6)) {
    return render(ui, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <SettingsProvider>
                    <AssetsContext.Provider value={assetsContext(tokBalance)}>{children}</AssetsContext.Provider>
                </SettingsProvider>
            </ChakraProvider>
        ),
    });
}

// min stake 10 TOK, 7-day lock, 1000 TOK staked in total, pays 5 BZE a day
const DR = { staking_denom: TOKEN_DENOM, lock: 7, min_stake: "10000000", staked_amount: "1000000000" };
const PAYS = [{ denom: "ubze", amount: "5000000" }];
const positionOf = (amount: string, pending = [{ denom: "ubze", amount: "1500000" }]) => ({
    participant: { address: "bze1test", staking_denom: TOKEN_DENOM, amount }, pending,
});

describe("denomRewardActionBlockers", () => {
    const item = (extra: Partial<DenomRewardHolderItem> = {}): DenomRewardHolderItem =>
        ({ denomReward: DR, dailyPrizes: PAYS, unlocks: [], ...extra });

    it("asks for a wallet first", () => {
        const b = denomRewardActionBlockers({ item: item(), hasWallet: false, balance: new BigNumber(0) });
        expect(b.stake).toMatch(/Connect your wallet/);
        expect(b.claim).toMatch(/Connect your wallet/);
    });

    it("blocks a first stake when the balance is below the minimum stake", () => {
        const b = denomRewardActionBlockers({ item: item(), hasWallet: true, balance: new BigNumber(9_999_999) });
        expect(b.stake).toMatch(/below the minimum stake/);
        expect(b.claim).toMatch(/no stake/);
        expect(b.exit).toMatch(/no stake/);
    });

    it("lets an existing position add any amount, and claims only when something is pending", () => {
        const withPending = denomRewardActionBlockers({ item: item({ position: positionOf("20000000") }), hasWallet: true, balance: new BigNumber(1) });
        expect(withPending).toEqual({ stake: "", claim: "", exit: "" });

        const nothing = denomRewardActionBlockers({
            item: item({ position: positionOf("20000000", [{ denom: "ubze", amount: "0" }]) }), hasWallet: true, balance: new BigNumber(1),
        });
        expect(nothing.claim).toMatch(/Nothing to claim yet/);
        expect(nothing.exit).toBe("");
    });
});

describe("DenomRewardBox", () => {
    it("shows my stake and the chain's pending prizes, with every action enabled", () => {
        renderWith(<DenomRewardBox item={{ denomReward: DR, dailyPrizes: PAYS, position: positionOf("20000000"), unlocks: [] }} hasWallet={true} onAction={vi.fn()} />);

        expect(screen.getByTestId("denom-reward-my-stake")).toHaveTextContent("20 TOK");
        expect(screen.getByText("1.5 BZE")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Add/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Claim/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Exit/ })).toBeEnabled();
    });

    it("labels a DR without schedules as airdrops-only and explains a disabled stake", () => {
        const onAction = vi.fn();
        renderWith(
            <DenomRewardBox item={{ denomReward: DR, dailyPrizes: [], unlocks: [] }} hasWallet={true} onAction={onAction} />,
            new BigNumber(1_000_000),
        );

        expect(screen.getByText(/airdrops only/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Stake/ })).toBeDisabled();
        expect(screen.getByTestId("denom-reward-blockers")).toHaveTextContent(/below the minimum stake/);
        expect(screen.getByRole("button", { name: /Claim/ })).toBeDisabled();
    });
});

const stakeInput = () => screen.getByTestId("denom-reward-stake-input") as HTMLInputElement;

describe("DenomRewardStakePanel", () => {
    it("refuses a first stake below the minimum before signing", async () => {
        renderWith(<DenomRewardStakePanel item={{ denomReward: DR, dailyPrizes: PAYS, unlocks: [] }} />);

        fireEvent.change(stakeInput(), { target: { value: "9" } });

        await waitFor(() => expect(screen.getByTestId("denom-reward-stake-error")).toHaveTextContent("The minimum stake is 10 TOK."));
        expect(screen.getByRole("button", { name: "Stake" })).toBeDisabled();
    });

    it("checks the minimum on the resulting position for a top-up and says pending is paid first", async () => {
        renderWith(<DenomRewardStakePanel item={{ denomReward: DR, dailyPrizes: PAYS, position: positionOf("9500000"), unlocks: [] }} />);

        fireEvent.change(stakeInput(), { target: { value: "0.4" } });
        await waitFor(() => expect(screen.getByTestId("denom-reward-stake-error")).toHaveTextContent(/whole position must reach/));

        fireEvent.change(stakeInput(), { target: { value: "0.5" } });
        await waitFor(() => expect(screen.getByRole("button", { name: "Add to stake" })).toBeEnabled());
        expect(screen.getByText(/Adding pays out your pending prizes first/)).toBeInTheDocument();
    });

    it("refuses more than the balance", async () => {
        renderWith(<DenomRewardStakePanel item={{ denomReward: DR, dailyPrizes: PAYS, unlocks: [] }} />);

        fireEvent.change(stakeInput(), { target: { value: "51" } });

        await waitFor(() => expect(screen.getByTestId("denom-reward-stake-error")).toHaveTextContent("You only have 50 TOK."));
    });

    it("previews the estimated daily share of a valid stake", async () => {
        renderWith(<DenomRewardStakePanel item={{ denomReward: DR, dailyPrizes: PAYS, unlocks: [] }} />);

        // 50 / (1000 + 50) of 5 BZE a day, rounded down to the base unit
        fireEvent.change(stakeInput(), { target: { value: "50" } });
        await waitFor(() => expect(screen.getByText(/Estimated daily share/i)).toBeInTheDocument());
        expect(screen.getByText(/0\.238095 BZE \/ day/)).toBeInTheDocument();
    });
});

describe("DenomRewardExitPanel", () => {
    it("tells when a locked stake comes back", () => {
        renderWith(<DenomRewardExitPanel item={{ denomReward: DR, dailyPrizes: PAYS, position: positionOf("20000000"), unlocks: [] }} />);
        expect(screen.getByTestId("denom-reward-exit-unlock")).toHaveTextContent(/7 days from now.*pending unlocks/);
    });

    it("says the stake returns immediately on a lock-0 DR", () => {
        renderWith(<DenomRewardExitPanel item={{ denomReward: { ...DR, lock: 0 }, dailyPrizes: PAYS, position: positionOf("20000000"), unlocks: [] }} />);
        expect(screen.getByTestId("denom-reward-exit-unlock")).toHaveTextContent("Returns to your wallet immediately");
    });
});

describe("filterDenomRewardItems", () => {
    const items: DenomRewardHolderItem[] = [
        { denomReward: DR, dailyPrizes: PAYS, unlocks: [] },
        { denomReward: { ...DR, staking_denom: "ubze" }, dailyPrizes: [], unlocks: [] },
    ];
    const ticker = (d: string) => (d === "ubze" ? "BZE" : d === TOKEN_DENOM ? "TOK" : d);

    it("matches the staking token or a prize token, case-insensitively", () => {
        expect(filterDenomRewardItems(items, "tok", ticker).map(i => i.denomReward.staking_denom)).toEqual([TOKEN_DENOM]);
        // TOK pays BZE, so "bze" finds both
        expect(filterDenomRewardItems(items, "BZE", ticker)).toHaveLength(2);
        expect(filterDenomRewardItems(items, "  ", ticker)).toHaveLength(2);
    });
});
