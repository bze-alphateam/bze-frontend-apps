import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {
    type Asset,
    DEFAULT_DENOM_BRANDING,
    type DenomRewardHolderItem,
    type DenomRewardSchedule,
} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const VDL = "factory/bze1other/uvdl";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const TICKERS: Record<string, string> = {[T]: "PAGE", ubze: "BZE", uusdc: "USDC", [VDL]: "VDL"};

// Every hook the section reads is mocked; the values below are per test.
const tx = vi.fn();
const reloadPool = vi.fn();
const updateBalances = vi.fn();
const getDenomRewardSchedules = vi.fn();
const connect = vi.fn();
let pool: { item?: DenomRewardHolderItem; isLoading: boolean; hasError: boolean };
let prices: Map<string, BigNumber>;
let balance: BigNumber;
let feeMessage = "";
let status: WalletState = WalletState.Connected;

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useTokenDenomReward: () => ({...pool, prizeDenoms: [], reload: reloadPool}),
    getDenomRewardSchedules: (denom: string) => getDenomRewardSchedules(denom),
    useAssetsContext: () => ({usdPricesMap: prices, updateBalances}),
    useAssets: () => ({denomTicker: (denom: string) => TICKERS[denom] ?? denom, denomDecimals: () => 6}),
    useBalance: () => ({balance: {denom: T, amount: balance}}),
    useEpochs: () => ({hourEpochInfo: {current_epoch: "1000"}}),
    getEcosystemApps: () => [{key: "factory", name: "Factory", href: "https://factory.example", disabled: false}],
    useBZETx: () => ({tx, progressTrack: ""}),
    useMaxSpendable: () => ({
        amount: balance, balance, inputValue: balance.dividedBy(1e6).toFixed(), isLoading: false,
    }),
    useCanAffordTx: () => ({
        canAfford: feeMessage === "", message: feeMessage, isLoading: false,
        gasFee: {displayAmount: new BigNumber("0.02"), ticker: "BZE"},
    }),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status, address: status === WalletState.Connected ? ME : undefined, connect}),
}));

import {TokenSiteTheme} from "../kit";
import {HoldersPool} from "./holders-pool";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n,
};

const schedule = (prize: string, daily: string, duration: number, payouts: number): DenomRewardSchedule => ({
    schedule_id: `${prize}-${duration}`, staking_denom: T, prize_denom: prize, daily_amount: daily, duration, payouts,
});

const item = (extra: Partial<DenomRewardHolderItem> = {}): DenomRewardHolderItem => ({
    // 20,000 PAGE staked, 7-day unlock, 100 PAGE minimum.
    denomReward: {staking_denom: T, lock: 7, min_stake: "100000000", staked_amount: "20000000000"},
    unlocks: [],
    ...extra,
});

const position = (amount: string, pending: { denom: string; amount: string }[] = []) => ({
    participant: {address: ME, staking_denom: T, amount}, pending,
});

function renderPool() {
    const user = userEvent.setup();
    render(<HoldersPool asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return user;
}

const rows = () => within(screen.getByTestId("holders-pool-prizes")).getAllByRole("row").slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));

beforeEach(() => {
    vi.clearAllMocks();
    status = WalletState.Connected;
    pool = {item: item(), isLoading: false, hasError: false};
    prices = new Map([[T, new BigNumber("0.5")], ["ubze", new BigNumber("0.002")], ["uusdc", new BigNumber(1)]]);
    balance = new BigNumber("500000000"); // 500 PAGE
    feeMessage = "";
    getDenomRewardSchedules.mockResolvedValue([
        schedule("ubze", "1000000000", 30, 10), // 1,000 BZE a day ≈ $2
        schedule("uusdc", "3000000", 100, 55), // 3 USDC a day
        schedule(VDL, "9000000", 200, 0), // no price
        schedule("ubze", "1000000", 5, 5), // finished
    ]);
    tx.mockResolvedValue(true);
});

describe("HoldersPool", () => {
    it("shows a placeholder while the pool loads", () => {
        pool = {isLoading: true, hasError: false};
        renderPool();

        expect(screen.getByTestId("holders-pool-loading")).toBeInTheDocument();
    });

    it("says there is no holders pool yet and links to the Factory to start one", () => {
        pool = {isLoading: false, hasError: false};
        renderPool();

        expect(screen.getByTestId("holders-pool-empty")).toHaveTextContent("No holders pool yet");
        const link = screen.getByRole("link", {name: "Start a holders pool"});
        expect(link).toHaveAttribute("href", "https://factory.example/manage/token?denom=factory%2Fbze1owner%2Fupage");
        expect(link).toHaveAttribute("target", "_blank");
        expect(getDenomRewardSchedules).not.toHaveBeenCalled();
    });

    it("lists the running rewards by USD paid, the unpriced last, and hides the APR", async () => {
        renderPool();

        await waitFor(() => expect(rows()).toEqual([
            ["USDC", "3", "45 days"],
            ["BZE", "1,000", "20 days"],
            ["VDL", "9", "200 days"],
        ]));
        expect(screen.queryByTestId("holders-pool-apr")).not.toBeInTheDocument();
        expect(screen.getByTestId("holders-pool")).toHaveTextContent("Total staked20,000 PAGE");
        expect(screen.getByTestId("holders-pool")).toHaveTextContent("Unlock time7 days");
        expect(screen.getByTestId("holders-pool")).toHaveTextContent("Minimum stake100 PAGE");
        expect(screen.getByRole("link", {name: "Add rewards to the pool"}))
            .toHaveAttribute("href", "https://factory.example/denom-reward/schedule?denom=factory%2Fbze1owner%2Fupage");
    });

    it("shows the estimated APR when every reward has a price", async () => {
        prices.set(VDL, new BigNumber("0.1"));
        renderPool();

        // (1,000 × 0.002 + 3 × 1 + 9 × 0.1) × 365 ÷ (20,000 × 0.5) × 100 = 21.535
        await waitFor(() => expect(screen.getByTestId("holders-pool-apr")).toHaveTextContent("21.5%Est. APR"));
    });

    it("asks a disconnected visitor to connect, without a position", async () => {
        status = WalletState.Disconnected;
        const user = renderPool();
        await screen.findByTestId("holders-pool-prizes");

        expect(screen.queryByTestId("holders-pool-position")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", {name: "Connect to stake"}));
        expect(connect).toHaveBeenCalled();
    });

    it("offers a first stake to a connected wallet without a position", async () => {
        renderPool();
        await screen.findByTestId("holders-pool-prizes");

        expect(screen.queryByTestId("holders-pool-position")).not.toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Stake PAGE"})).toBeEnabled();
    });

    it("blocks a first stake below the minimum with the reason", async () => {
        balance = new BigNumber("50000000"); // 50 PAGE
        renderPool();
        await screen.findByTestId("holders-pool-prizes");

        expect(screen.getByRole("button", {name: "Stake PAGE"})).toBeDisabled();
        expect(screen.getByTestId("holders-pool-blockers")).toHaveTextContent("Your balance is below the minimum stake.");
    });

    it("shows the position: stake and share, rewards ready and what is unlocking", async () => {
        pool.item = item({
            position: position("5000000000", [{denom: "ubze", amount: "12500000"}, {denom: "uusdc", amount: "0"}]),
            unlocks: [{staking_denom: T, amount: "1000000000", unlockEpoch: 1102}],
        });
        renderPool();

        const panel = await screen.findByTestId("holders-pool-position");
        expect(panel).toHaveTextContent("5,000 PAGE");
        expect(panel).toHaveTextContent("staked · 25% of the pool");
        expect(panel).toHaveTextContent("Ready to claimBZE12.5");
        expect(panel).not.toHaveTextContent("USDC");
        expect(screen.getByTestId("holders-pool-unlocking")).toHaveTextContent("Unlocking1,000 PAGE · in 4 days");
        expect(screen.getByRole("button", {name: "Stake more"})).toBeEnabled();
        expect(screen.getByRole("button", {name: "Claim all"})).toBeEnabled();
        expect(screen.getByRole("button", {name: "Unstake"})).toBeEnabled();
    });

    it("shows the position panel for a wallet that is only unlocking", async () => {
        pool.item = item({unlocks: [{staking_denom: T, amount: "1000000000", unlockEpoch: 1005}]});
        renderPool();

        expect(await screen.findByTestId("holders-pool-position")).toHaveTextContent("0 PAGE");
        expect(screen.getByTestId("holders-pool-unlocking")).toHaveTextContent("in 5 hours");
        expect(screen.queryByRole("button", {name: "Unstake"})).not.toBeInTheDocument();
    });

    it("offers a retry when the pool can't be read", async () => {
        pool = {isLoading: false, hasError: true};
        const user = renderPool();

        await user.click(screen.getByRole("button", {name: "Retry"}));
        expect(reloadPool).toHaveBeenCalled();
    });
});

describe("StakeDialog", () => {
    it("stakes into the pool, then refreshes the pool and the balances", async () => {
        const user = renderPool();
        await user.click(await screen.findByRole("button", {name: "Stake PAGE"}));

        const dialog = screen.getByRole("dialog", {name: "Stake PAGE"});
        await user.type(within(dialog).getByLabelText("Amount"), "150.5");
        expect(within(dialog).getByText("Network fee")).toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", {name: "Stake"}));

        expect(tx).toHaveBeenCalledTimes(1);
        const [msg] = tx.mock.calls[0][0];
        expect(msg.typeUrl).toBe("/bze.rewards.MsgJoinDenomReward");
        expect(msg.value).toEqual({creator: ME, denom: T, amount: "150500000"});
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(updateBalances).toHaveBeenCalled();
        expect(reloadPool).toHaveBeenCalled();
    });

    it("refuses a stake below the minimum or above the balance, with the reason", async () => {
        const user = renderPool();
        await user.click(await screen.findByRole("button", {name: "Stake PAGE"}));
        const dialog = screen.getByRole("dialog");
        const field = within(dialog).getByLabelText("Amount");

        await user.type(field, "99");
        expect(within(dialog).getByRole("alert")).toHaveTextContent("The minimum stake is 100 PAGE");
        expect(within(dialog).getByRole("button", {name: "Stake"})).toBeDisabled();

        await user.clear(field);
        await user.type(field, "501");
        expect(within(dialog).getByRole("alert")).toHaveTextContent("You only have 500 PAGE");

        await user.clear(field);
        await user.type(field, "0.0000001");
        expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter an amount above 0, with at most 6 decimals");
        await user.click(within(dialog).getByRole("button", {name: "Stake"}));
        expect(tx).not.toHaveBeenCalled();
    });

    it("lets a top-up reach the minimum together with the current stake", async () => {
        pool.item = item({position: position("90000000")});
        const user = renderPool();
        await user.click(await screen.findByRole("button", {name: "Stake more"}));
        const dialog = screen.getByRole("dialog", {name: "Stake more PAGE"});

        await user.type(within(dialog).getByLabelText("Amount"), "5");
        expect(within(dialog).getByRole("alert")).toHaveTextContent("Your whole stake must reach the minimum of 100 PAGE");

        await user.type(within(dialog).getByLabelText("Amount"), "0");
        expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("refuses a stake that leaves nothing for the network fee", async () => {
        feeMessage = "Not enough PAGE left for the network fee (≈ 0.02 PAGE)";
        const user = renderPool();
        await user.click(await screen.findByRole("button", {name: "Stake PAGE"}));
        const dialog = screen.getByRole("dialog");

        await user.type(within(dialog).getByLabelText("Amount"), "500");
        expect(within(dialog).getByRole("alert")).toHaveTextContent("Not enough PAGE left for the network fee");
        expect(within(dialog).getByRole("button", {name: "Stake"})).toBeDisabled();
    });

    it("claims the pool's rewards", async () => {
        pool.item = item({position: position("5000000000", [{denom: "ubze", amount: "12500000"}])});
        const user = renderPool();
        await user.click(await screen.findByRole("button", {name: "Claim all"}));

        const dialog = screen.getByRole("dialog", {name: "Claim your rewards"});
        expect(dialog).toHaveTextContent("BZE12.5");
        await user.click(within(dialog).getByRole("button", {name: "Claim all"}));

        const [msg] = tx.mock.calls[0][0];
        expect(msg.typeUrl).toBe("/bze.rewards.MsgClaimDenomRewards");
        expect(msg.value).toEqual({creator: ME, denom: T});
    });

    it("unstakes the whole position after the unlock time", async () => {
        pool.item = item({position: position("5000000000", [{denom: "ubze", amount: "12500000"}])});
        const user = renderPool();
        await user.click(await screen.findByRole("button", {name: "Unstake"}));

        const dialog = screen.getByRole("dialog", {name: "Unstake your PAGE"});
        expect(dialog).toHaveTextContent("Your stake5,000 PAGE");
        expect(dialog).toHaveTextContent("Paid out first");
        expect(within(dialog).getByTestId("stake-dialog-unlock")).toHaveTextContent("comes back to your wallet in 7 days");
        await user.click(within(dialog).getByRole("button", {name: "Unstake"}));

        const [msg] = tx.mock.calls[0][0];
        expect(msg.typeUrl).toBe("/bze.rewards.MsgExitDenomReward");
        expect(msg.value).toEqual({creator: ME, denom: T});
    });

    it("keeps the dialog open when the transaction fails", async () => {
        tx.mockResolvedValue(false);
        pool.item = item({position: position("5000000000", [{denom: "ubze", amount: "12500000"}])});
        const user = renderPool();
        await user.click(await screen.findByRole("button", {name: "Claim all"}));
        await user.click(within(screen.getByRole("dialog")).getByRole("button", {name: "Claim all"}));

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(updateBalances).not.toHaveBeenCalled();
    });
});
