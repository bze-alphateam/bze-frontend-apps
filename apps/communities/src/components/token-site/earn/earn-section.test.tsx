import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {type Asset, DEFAULT_DENOM_BRANDING, type DenomRewardHolderItem} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

import type {FixedTermProgram} from "@/lib/token-site/fixed-term";
import type {EarnOpportunity} from "@/lib/token-site/earn";

const T = "factory/bze1owner/upage";
const GUILD = "factory/bze1guild/uguild";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const ASSETS: Record<string, { ticker: string; decimals: number }> = {
    [T]: {ticker: "PAGE", decimals: 6}, ubze: {ticker: "BZE", decimals: 6}, [GUILD]: {ticker: "GUILD", decimals: 6}, uusdc: {ticker: "USDC", decimals: 6},
};

// Every hook the section reads is mocked; the values below are per test.
const tx = vi.fn();
const connect = vi.fn();
const reloadPool = vi.fn();
const reloadPrograms = vi.fn();
const useTokenDenomReward = vi.fn();
const useFixedTermPrograms = vi.fn();
let status: WalletState = WalletState.Connected;
const balance = new BigNumber("1000000000"); // 1,000 of the staked token

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => ({asset: ASSETS[denom] && {denom, ...ASSETS[denom]}, isLoading: false}),
    useAssets: () => ({denomTicker: (denom: string) => ASSETS[denom]?.ticker ?? denom, denomDecimals: () => 6}),
    useAssetsContext: () => ({updateBalances: vi.fn()}),
    useTokenDenomReward: (denom: string, address?: string) => useTokenDenomReward(denom, address),
    useBZETx: () => ({tx, progressTrack: ""}),
    useMaxSpendable: () => ({amount: balance, balance, inputValue: "1000", isLoading: false}),
    useCanAffordTx: () => ({
        canAfford: true, message: "", isLoading: false, gasFee: {displayAmount: new BigNumber("0.02"), ticker: "BZE"},
    }),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status, address: status === WalletState.Connected ? ME : undefined, connect}),
}));

vi.mock("@/hooks/token-site/useFixedTermPrograms", () => ({
    useFixedTermPrograms: (denom: string, address?: string) => useFixedTermPrograms(denom, address),
}));

import {TokenSiteTheme} from "../kit";
import {EarnSection} from "./earn-section";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n,
};

const POOL: EarnOpportunity = {
    kind: "pool", key: `pool-${GUILD}`, stakingDenom: GUILD, daily: new BigNumber(1200), apr: new BigNumber(22),
    lock: 5, daysLeft: 45, otherPrizes: ["ubze", "uusdc"],
};
const PROGRAM: EarnOpportunity = {
    kind: "program", key: "program-07", stakingDenom: "ubze", rewardId: "07", daily: new BigNumber(8000),
    lock: 0, daysLeft: 12, otherPrizes: [],
};

const guildPool: DenomRewardHolderItem = {
    denomReward: {staking_denom: GUILD, lock: 5, min_stake: "1000000", staked_amount: "2000000000000"},
    unlocks: [],
};

const program: StakingRewardSDKType = {
    reward_id: "07", prize_amount: "8000000000", prize_denom: T, staking_denom: "ubze", duration: 30, payouts: 18,
    min_stake: 1_000_000n, lock: 0, staked_amount: "1000000000000", distributed_stake: "0",
};
const bzeProgram: FixedTermProgram = {program, unlocking: [], pending: new BigNumber(0)};

function renderSection(opportunities: EarnOpportunity[] = [POOL, PROGRAM]) {
    const user = userEvent.setup();
    const view = render(<EarnSection asset={ASSET} opportunities={opportunities}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return {user, ...view};
}

beforeEach(() => {
    vi.clearAllMocks();
    status = WalletState.Connected;
    useTokenDenomReward.mockReturnValue({item: guildPool, prizeDenoms: [], isLoading: false, hasError: false, reload: reloadPool});
    useFixedTermPrograms.mockReturnValue({programs: [bzeProgram], isLoading: false, reload: reloadPrograms});
    tx.mockResolvedValue(true);
});

describe("EarnSection", () => {
    it("renders nothing without a way to earn T", () => {
        renderSection([]);

        expect(screen.getByTestId("token-site")).toBeEmptyDOMElement();
    });

    it("shows a card per way to earn, with the staked token, its kind and its terms", () => {
        renderSection();

        expect(screen.getByRole("heading", {name: "Ways to earn PAGE"})).toBeInTheDocument();
        expect(screen.getByText("Don't hold PAGE yet? Stake one of these tokens and get paid in PAGE every day.")).toBeInTheDocument();

        const pool = screen.getByTestId(`earn-pool-${GUILD}`);
        expect(within(pool).getByRole("heading", {name: "GUILD"})).toBeInTheDocument();
        expect(within(pool).getByTestId("earn-kind")).toHaveTextContent("Holders pool");
        expect(within(pool).getByTestId("earn-apr")).toHaveTextContent("22.0%APR");
        expect(within(pool).getByTestId("earn-daily")).toHaveTextContent("1,200PAGE paid out daily");
        expect(within(pool).getByText("Funded for")).toBeInTheDocument();
        expect(within(pool).getByText("45 days")).toBeInTheDocument();
        expect(within(pool).getByText("5 days")).toBeInTheDocument();
        expect(within(pool).getByTestId("earn-also-pays")).toHaveTextContent("Also pays BZE and USDC.");

        const sr = screen.getByTestId("earn-program-07");
        expect(within(sr).getByTestId("earn-kind")).toHaveTextContent("Fixed-term program");
        expect(within(sr).queryByTestId("earn-apr")).not.toBeInTheDocument();
        expect(within(sr).getByText("Ends in")).toBeInTheDocument();
        expect(within(sr).getByText("12 days")).toBeInTheDocument();
        expect(within(sr).getByText("Instant")).toBeInTheDocument();
        expect(within(sr).queryByTestId("earn-also-pays")).not.toBeInTheDocument();
    });

    it("stakes the other token into its holders pool", async () => {
        const {user} = renderSection();

        await user.click(within(screen.getByTestId(`earn-pool-${GUILD}`)).getByRole("button", {name: "Stake GUILD"}));
        expect(useTokenDenomReward).toHaveBeenCalledWith(GUILD, ME);

        const dialog = screen.getByRole("dialog", {name: "Stake GUILD"});
        await user.type(within(dialog).getByLabelText("Amount"), "25");
        await user.click(within(dialog).getByRole("button", {name: "Stake"}));

        expect(tx).toHaveBeenCalledTimes(1);
        expect(tx.mock.calls[0][0]).toEqual([{
            typeUrl: "/bze.rewards.MsgJoinDenomReward",
            value: {creator: ME, denom: GUILD, amount: "25000000"},
        }]);
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(reloadPool).toHaveBeenCalled();
    });

    it("stakes the other token into the program paying T", async () => {
        const {user} = renderSection();

        await user.click(within(screen.getByTestId("earn-program-07")).getByRole("button", {name: "Stake BZE"}));
        expect(useFixedTermPrograms).toHaveBeenCalledWith("ubze", ME);

        const dialog = screen.getByRole("dialog", {name: "Stake BZE"});
        await user.type(within(dialog).getByLabelText("Amount"), "3");
        await user.click(within(dialog).getByRole("button", {name: "Stake"}));

        expect(tx.mock.calls[0][0]).toEqual([{
            typeUrl: "/bze.rewards.MsgJoinStaking",
            value: {creator: ME, rewardId: "07", amount: "3000000"},
        }]);
        expect(reloadPrograms).toHaveBeenCalled();
    });

    it("waits for the pool before the stake form, and says so when it is gone", async () => {
        useTokenDenomReward.mockReturnValue({prizeDenoms: [], isLoading: true, hasError: false, reload: reloadPool});
        const {user, rerender} = renderSection();

        await user.click(screen.getByRole("button", {name: "Stake GUILD"}));
        expect(screen.getByTestId("earn-stake-loading")).toBeInTheDocument();
        expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();

        useTokenDenomReward.mockReturnValue({prizeDenoms: [], isLoading: false, hasError: false, reload: reloadPool});
        rerender(<EarnSection asset={ASSET} opportunities={[POOL, PROGRAM]}/>);
        expect(screen.getByRole("dialog")).toHaveTextContent("This one has stopped paying.");
    });

    it("asks for a wallet before staking", async () => {
        status = WalletState.Disconnected;
        const {user} = renderSection();

        await user.click(screen.getByRole("button", {name: "Stake GUILD"}));

        expect(connect).toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
