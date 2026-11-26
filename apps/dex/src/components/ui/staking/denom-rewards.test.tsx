import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
} from "@bze/bze-ui-kit";
import { DenomRewardActionModal } from "@/components/ui/staking/denom-reward-modals";
import { forbidNetwork } from "@bze/vitest-preset/no-network";

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

forbidNetwork();

beforeAll(() => {
    setInLocalStorage("tradebin_params_v2", JSON.stringify({
        minNativeLiquidityForModuleSwap: "100000000000",
        createMarketFee: { denom: "ubze", amount: "1000000" },
        marketMakerFee: { denom: "ubze", amount: "1000" },
        marketTakerFee: { denom: "ubze", amount: "2000" },
    }), 60_000);
    setInLocalStorage("txfeecollector_params", JSON.stringify({
        validatorMinGasFee: { denom: "ubze", amount: "0.02" },
        blockedIbcInbound: [],
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

describe("DenomRewardActionModal", () => {
    it("opens Manage on my stake and the chain's pending prizes, with every action enabled", async () => {
        renderWith(
            <DenomRewardActionModal item={{ denomReward: DR, dailyPrizes: PAYS, position: positionOf("20000000"), unlocks: [] }} onClose={vi.fn()} onDone={vi.fn()} />,
        );

        const dialog = await screen.findByRole("dialog", { name: "TOK" });
        expect(dialog).toHaveTextContent("20 TOK");
        expect(dialog).toHaveTextContent("1.5 BZE");
        expect(screen.getByRole("button", { name: /Add/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Claim/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Exit/ })).toBeEnabled();
    });

    it("explains a disabled stake on Manage and opens the stake panel from it", async () => {
        const { unmount } = renderWith(
            <DenomRewardActionModal item={{ denomReward: DR, dailyPrizes: [], unlocks: [] }} onClose={vi.fn()} onDone={vi.fn()} />,
            new BigNumber(1_000_000),
        );
        await screen.findByRole("dialog");
        expect(screen.getByRole("button", { name: /Stake/ })).toBeDisabled();
        expect(screen.getByTestId("denom-reward-blockers")).toHaveTextContent(/below the minimum stake/);
        expect(screen.getByRole("button", { name: /Claim/ })).toBeDisabled();
        unmount();

        renderWith(<DenomRewardActionModal item={{ denomReward: DR, dailyPrizes: PAYS, unlocks: [] }} onClose={vi.fn()} onDone={vi.fn()} />);
        fireEvent.click(await screen.findByRole("button", { name: /Stake/ }));
        expect(await screen.findByRole("dialog", { name: "Stake TOK" })).toBeInTheDocument();
        expect(stakeInput()).toBeInTheDocument();
    });

    it("titles the exit dialog with the Compounded reward name", async () => {
        renderWith(
            <DenomRewardActionModal
                item={{ denomReward: DR, dailyPrizes: PAYS, position: positionOf("20000000"), unlocks: [] }}
                action="exit"
                onClose={vi.fn()}
                onDone={vi.fn()}
            />,
        );

        expect(await screen.findByRole("dialog", { name: "Exit the TOK compounded reward" })).toBeInTheDocument();
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

// ---- the DAO notice (BFE-394): BZE Scan stands behind a stubbed fetch ----

let scanDaos: unknown;
let scanProposals: unknown;
let sourcesAsked: string[];

const realFetch = globalThis.fetch;

beforeEach(() => {
    // a Scan that has the DAO filters (an invalid member is refused), where no DAO uses anything
    scanDaos = { items: [], next_cursor: null };
    scanProposals = { items: [], next_cursor: null };
    sourcesAsked = [];
    globalThis.fetch = (vi.fn(async (url: string) => {
        const u = new URL(url, "http://dex.test");
        if (u.searchParams.has("member")) return new Response("{}", { status: 400 });
        if (u.pathname.endsWith("/daos")) {
            sourcesAsked.push(u.searchParams.get("source") ?? "");
            return new Response(JSON.stringify(scanDaos), { status: 200 });
        }
        return new Response(JSON.stringify(scanProposals), { status: 200 });
    })) as unknown as typeof fetch;
});
afterEach(() => {
    cleanup();
    globalThis.fetch = realFetch;
});

// The shared reader keeps an answer a minute per source, so each test stakes a denom of its own.
let denomCount = 0;
const freshItem = (position?: ReturnType<typeof positionOf>) => {
    const denom = `factory/bze1creator/dao${++denomCount}`;
    return { denom, item: { denomReward: { ...DR, staking_denom: denom }, dailyPrizes: PAYS, position, unlocks: [] } };
};
const daoWithOpenProposals = (n: number) => {
    scanDaos = { items: [{ id: 3, name: "Club", type: "stake" }], next_cursor: null };
    scanProposals = { items: Array.from({ length: n }, (_, i) => ({ id: 10 + i, dao_id: 3, title: `P${i}`, status: "voting" })), next_cursor: null };
};

describe("Denom Reward DAO notice", () => {
    it("warns a stake about the open proposals of a DAO that votes with the reward", async () => {
        daoWithOpenProposals(2);
        const { denom, item } = freshItem();
        renderWith(<DenomRewardStakePanel item={item} />);

        expect(await screen.findByTestId("dao-source-notice")).toHaveTextContent(
            "Stake you add now won't count on its 2 open proposals, and a top-up makes your whole stake here stop counting on them. Vote first, then add.",
        );
        expect(sourcesAsked).toEqual([`dr/${denom}`]);
    });

    it("warns a top-up too, beside the still usable input", async () => {
        daoWithOpenProposals(1);
        renderWith(<DenomRewardStakePanel item={freshItem(positionOf("20000000")).item} />);

        expect(await screen.findByTestId("dao-source-notice")).toHaveTextContent("its 1 open proposal,");
        expect(stakeInput()).toBeEnabled();
    });

    it("warns an exit that it lowers the votes", async () => {
        daoWithOpenProposals(2);
        renderWith(<DenomRewardExitPanel item={freshItem(positionOf("20000000")).item} />);

        expect(await screen.findByTestId("dao-source-notice")).toHaveTextContent(
            "Leaving now lowers your votes on 2 open proposals of DAO Club, and joining again won't bring them back.",
        );
    });

    it("shows nothing on a reward no DAO uses", async () => {
        renderWith(<DenomRewardStakePanel item={freshItem().item} />);

        await waitFor(() => expect(sourcesAsked).toHaveLength(1));
        expect(screen.queryByTestId("dao-source-notice")).toBeNull();
    });
});
