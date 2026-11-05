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
const getDenomRewardParticipations = vi.fn();
const getStakingRewardParticipantByAddress = vi.fn();
let status: WalletState = WalletState.Connected;
const balance = new BigNumber("1000000000"); // 1,000 of the staked token

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => ({asset: ASSETS[denom] && {denom, ...ASSETS[denom]}, isLoading: false}),
    useAssets: () => ({denomTicker: (denom: string) => ASSETS[denom]?.ticker ?? denom, denomDecimals: () => 6}),
    useAssetsContext: () => ({updateBalances: vi.fn()}),
    useTokenDenomReward: (denom: string, address?: string) => useTokenDenomReward(denom, address),
    getDenomRewardParticipations: (address: string) => getDenomRewardParticipations(address),
    getStakingRewardParticipantByAddress: (address: string) => getStakingRewardParticipantByAddress(address),
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

const guildPool: DenomRewardHolderItem = {
    denomReward: {staking_denom: GUILD, lock: 5, min_stake: "1000000", staked_amount: "2000000000000"},
    unlocks: [],
};

const program: StakingRewardSDKType = {
    reward_id: "07", prize_amount: "8000000000", prize_denom: T, staking_denom: "ubze", duration: 30, payouts: 18,
    min_stake: 1_000_000n, lock: 0, staked_amount: "1000000000000", distributed_stake: "0",
};
const bzeProgram: FixedTermProgram = {program, unlocking: [], pending: new BigNumber(0)};

// T's program for BZE stakers; 0.75 T accrued per staked unit so far.
const PROGRAM: EarnOpportunity = {
    kind: "program", key: "program-07", stakingDenom: "ubze", rewardId: "07", program: {...program, distributed_stake: "0.75"},
    daily: new BigNumber(8000), lock: 0, daysLeft: 12, otherPrizes: [],
};

/** More ways to earn: GUILD-like pools on their own denoms, nothing else about them matters here. */
const morePools = (count: number): EarnOpportunity[] => Array.from({length: count}, (_, i) => ({
    ...POOL, key: `pool-extra-${i}`, stakingDenom: `factory/bze1x/u${i}`, otherPrizes: [],
}));

/** The viewer's 2 BZE in the program, joined at 0: 1.5 T to claim. */
const myProgramStake = {address: ME, reward_id: "07", amount: "2000000", joined_at: "0"};
/** The viewer's 40 GUILD in GUILD's holders pool. */
const myPoolStake = {address: ME, staking_denom: GUILD, amount: "40000000"};

const rowKeys = () => screen.getAllByTestId(/^earn-(pool|program)-/).map((row) => row.dataset.testid);

function renderSection(opportunities: EarnOpportunity[] = [POOL, PROGRAM], featureFirst?: boolean) {
    const user = userEvent.setup();
    const view = render(<EarnSection asset={ASSET} opportunities={opportunities} featureFirst={featureFirst}/>, {
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
    getDenomRewardParticipations.mockResolvedValue([]);
    getStakingRewardParticipantByAddress.mockResolvedValue({list: []});
});

describe("EarnSection", () => {
    it("renders nothing without a way to earn T", () => {
        renderSection([]);

        expect(screen.getByTestId("token-site")).toBeEmptyDOMElement();
    });

    it("shows a row per way to earn, with the staked token, its kind and its terms", () => {
        renderSection();

        expect(screen.getByRole("heading", {name: "Ways to earn PAGE"})).toBeInTheDocument();
        expect(screen.getByText("Don't hold PAGE yet? Stake one of these tokens and get paid in PAGE every day.")).toBeInTheDocument();
        expect(screen.getAllByRole("columnheader").map((header) => header.textContent))
            .toEqual(["Stake", "APR", "PAGE daily", "Unlock", "Time left", "Actions"]);

        const pool = screen.getByTestId(`earn-pool-${GUILD}`);
        expect(within(pool).getByTestId("earn-ticker")).toHaveTextContent("GUILD");
        expect(within(pool).getByTestId("earn-kind")).toHaveTextContent("Holders pool");
        expect(within(pool).getByTestId("earn-apr")).toHaveTextContent("APR 22.0%");
        expect(within(pool).getByTestId("earn-daily")).toHaveTextContent("1,200 PAGE/day");
        expect(within(pool).getByTestId("earn-unlock")).toHaveTextContent("Unlock 5 days");
        expect(within(pool).getByTestId("earn-left")).toHaveTextContent("Funded for 45 days");
        expect(within(pool).getByTestId("earn-also-pays")).toHaveTextContent("Also pays BZE and USDC.");
        expect(within(pool).getByRole("button", {name: "Stake GUILD"})).toHaveTextContent("Stake");

        const sr = screen.getByTestId("earn-program-07");
        expect(within(sr).getByTestId("earn-kind")).toHaveTextContent("Fixed-term");
        expect(within(sr).getByTestId("earn-apr")).toHaveTextContent("—");
        expect(within(sr).getByTestId("earn-daily")).toHaveTextContent("8,000 PAGE/day");
        expect(within(sr).getByTestId("earn-unlock")).toHaveTextContent("Unlock Instant");
        expect(within(sr).getByTestId("earn-left")).toHaveTextContent("Ends in 12 days");
        expect(within(sr).queryByTestId("earn-also-pays")).not.toBeInTheDocument();
        expect(within(sr).queryByTestId("earn-position")).not.toBeInTheDocument();
        expect(within(sr).getByRole("button", {name: "Stake BZE"})).toBeInTheDocument();
    });

    it("puts the viewer's stakes first, with the stake, what is left to claim and Manage", async () => {
        getStakingRewardParticipantByAddress.mockResolvedValue({list: [myProgramStake]});
        getDenomRewardParticipations.mockResolvedValue([]);
        renderSection([POOL, ...morePools(2), PROGRAM]);

        await waitFor(() => expect(rowKeys()[0]).toBe("earn-program-07"));
        expect(rowKeys()).toEqual(["earn-program-07", `earn-pool-${GUILD}`, "earn-pool-extra-0", "earn-pool-extra-1"]);

        const sr = screen.getByTestId("earn-program-07");
        expect(within(sr).getByTestId("earn-position")).toHaveTextContent("Your stake: 2 BZE · 1.5 PAGE to claim");
        expect(within(sr).getByRole("button", {name: "Manage BZE"})).toHaveTextContent("Manage");
        expect(within(screen.getByTestId(`earn-pool-${GUILD}`)).queryByTestId("earn-position")).not.toBeInTheDocument();

        // Two address-wide reads, not one per row.
        expect(getDenomRewardParticipations).toHaveBeenCalledTimes(1);
        expect(getDenomRewardParticipations).toHaveBeenCalledWith(ME);
        expect(getStakingRewardParticipantByAddress).toHaveBeenCalledTimes(1);
        expect(getStakingRewardParticipantByAddress).toHaveBeenCalledWith(ME);
    });

    it("shows only the stake in a holders pool, and nothing to claim on a program that paid nothing yet", async () => {
        getDenomRewardParticipations.mockResolvedValue([myPoolStake]);
        getStakingRewardParticipantByAddress.mockResolvedValue({list: [{...myProgramStake, joined_at: "0.75"}]});
        renderSection([PROGRAM, POOL]);

        await waitFor(() => expect(screen.getAllByTestId("earn-position")).toHaveLength(2));
        // Both staked: the order stays.
        expect(rowKeys()).toEqual(["earn-program-07", `earn-pool-${GUILD}`]);
        expect(within(screen.getByTestId(`earn-pool-${GUILD}`)).getByTestId("earn-position")).toHaveTextContent(/^Your stake: 40 GUILD$/);
        expect(within(screen.getByTestId("earn-program-07")).getByTestId("earn-position")).toHaveTextContent(/^Your stake: 2 BZE$/);
        expect(screen.getByRole("button", {name: "Manage GUILD"})).toBeInTheDocument();
    });

    it("reads no positions without a wallet", () => {
        status = WalletState.Disconnected;
        renderSection();

        expect(rowKeys()).toEqual([`earn-pool-${GUILD}`, "earn-program-07"]);
        expect(screen.queryByTestId("earn-position")).not.toBeInTheDocument();
        expect(getDenomRewardParticipations).not.toHaveBeenCalled();
        expect(getStakingRewardParticipantByAddress).not.toHaveBeenCalled();
    });

    it("shows five rows, then all of them on request, with the viewer's stake among the five", async () => {
        getStakingRewardParticipantByAddress.mockResolvedValue({list: [myProgramStake]});
        const {user} = renderSection([...morePools(6), PROGRAM]);

        await waitFor(() => expect(rowKeys()[0]).toBe("earn-program-07"));
        expect(rowKeys()).toEqual(["earn-program-07", "earn-pool-extra-0", "earn-pool-extra-1", "earn-pool-extra-2", "earn-pool-extra-3"]);

        await user.click(screen.getByRole("button", {name: "Show all 7"}));
        expect(rowKeys()).toHaveLength(7);

        await user.click(screen.getByRole("button", {name: "Show fewer"}));
        expect(rowKeys()).toHaveLength(5);
    });

    it("has no Show all with five ways to earn or fewer", () => {
        renderSection(morePools(5));

        expect(rowKeys()).toHaveLength(5);
        expect(screen.queryByRole("button", {name: /Show all/})).not.toBeInTheDocument();
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
        // The list's positions are read again.
        await waitFor(() => expect(getDenomRewardParticipations).toHaveBeenCalledTimes(2));
        expect(getStakingRewardParticipantByAddress).toHaveBeenCalledTimes(2);
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
        await waitFor(() => expect(getStakingRewardParticipantByAddress).toHaveBeenCalledTimes(2));
    });

    it("manages a stake in the same dialog", async () => {
        getStakingRewardParticipantByAddress.mockResolvedValue({list: [myProgramStake]});
        const {user} = renderSection();

        await user.click(await screen.findByRole("button", {name: "Manage BZE"}));

        expect(useFixedTermPrograms).toHaveBeenCalledWith("ubze", ME);
        expect(screen.getByRole("dialog", {name: "Stake BZE"})).toBeInTheDocument();
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

    it("features the first row when T has no holders pool", () => {
        renderSection([POOL, PROGRAM], true);

        expect(screen.getByTestId(`earn-pool-${GUILD}`)).toHaveAttribute("data-featured");
        expect(screen.getByTestId("earn-program-07")).not.toHaveAttribute("data-featured");
    });

    it("features no row while T's holders pool is the featured one", () => {
        renderSection([POOL, PROGRAM], false);

        expect(screen.getByTestId(`earn-pool-${GUILD}`)).not.toHaveAttribute("data-featured");
        expect(screen.getByTestId("earn-program-07")).not.toHaveAttribute("data-featured");
    });

    it("features the first row shown, the viewer's stake once it sorts first", async () => {
        getStakingRewardParticipantByAddress.mockResolvedValue({list: [myProgramStake]});
        renderSection([POOL, PROGRAM], true);

        await waitFor(() => expect(screen.getByTestId("earn-program-07")).toHaveAttribute("data-featured"));
        expect(screen.getByTestId(`earn-pool-${GUILD}`)).not.toHaveAttribute("data-featured");
    });
});
