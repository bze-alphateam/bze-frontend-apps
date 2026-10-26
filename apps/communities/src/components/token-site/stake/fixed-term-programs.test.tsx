import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {type AddressRewardsStaking, type Asset, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const VDL = "factory/bze1other/uvdl";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const ASSETS: Record<string, { ticker: string; decimals: number }> = {
    [T]: {ticker: "PAGE", decimals: 6}, ubze: {ticker: "BZE", decimals: 6}, [VDL]: {ticker: "VDL", decimals: 6},
};

// Every hook the block reads is mocked; the values below are per test.
const tx = vi.fn();
const reload = vi.fn();
const updateBalances = vi.fn();
let rewards: StakingRewardSDKType[];
let addressData: AddressRewardsStaking | undefined;
let prices: Map<string, BigNumber>;
let balance: BigNumber;
let status: WalletState = WalletState.Connected;

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => ({asset: ASSETS[denom] && {denom, ...ASSETS[denom]}, isLoading: false}),
    useAssetPrice: (denom: string) => ({price: prices.get(denom) ?? new BigNumber(0)}),
    useEpochs: () => ({hourEpochInfo: {current_epoch: "1000"}}),
    useAssetsContext: () => ({updateBalances}),
    useAssets: () => ({denomTicker: (denom: string) => ASSETS[denom]?.ticker ?? denom, denomDecimals: () => 6}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useMaxSpendable: () => ({
        amount: balance, balance, inputValue: balance.dividedBy(1e6).toFixed(), isLoading: false,
    }),
    useCanAffordTx: () => ({
        canAfford: true, message: "", isLoading: false, gasFee: {displayAmount: new BigNumber("0.02"), ticker: "BZE"},
    }),
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({status, address: status === WalletState.Connected ? ME : undefined, connect: vi.fn()}),
}));

vi.mock("@/hooks/useRewardsStakingData", () => ({
    useRewardsStakingData: () => ({rewards, addressData, isLoading: false, reload, rewardsMap: new Map()}),
}));

import {TokenSiteTheme} from "../kit";
import {FixedTermPrograms} from "./fixed-term-programs";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n,
};

// 500 BZE a day for 30 days (7 paid), 14-day unlock, 50 PAGE minimum, 6.1M PAGE staked.
const program = (id: string, extra: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType => ({
    reward_id: id,
    prize_amount: "500000000",
    prize_denom: "ubze",
    staking_denom: T,
    duration: 30,
    payouts: 7,
    min_stake: 50_000_000n,
    lock: 14,
    staked_amount: "6100000000000",
    distributed_stake: "0.5",
    ...extra,
});

const mine = (active: [string, string][], unlocking: [string, string, number][] = []): AddressRewardsStaking => ({
    address: ME,
    active: new Map(active.map(([id, amount]) => [id, {address: ME, reward_id: id, amount, joined_at: "0.25"}])),
    unlocking: new Map(unlocking.map(([id, amount, epoch]) => [id, [{
        index: `${epoch}/${id}/${ME}`, address: ME, amount, denom: T, unlockEpoch: new BigNumber(epoch), rewardId: id,
    }]])),
});

function renderPrograms() {
    const user = userEvent.setup();
    render(<FixedTermPrograms asset={ASSET}/>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });
    return {user};
}

const card = (id: string) => screen.getByTestId(`program-${id}`);
const cardIds = () => screen.getAllByTestId(/^program-\d+$/).map((el) => el.dataset.testid);
const buttons = (id: string) => within(card(id)).queryAllByRole("button").map((button) => button.textContent);

beforeEach(() => {
    vi.clearAllMocks();
    status = WalletState.Connected;
    rewards = [
        program("01", {payouts: 30}), // finished
        program("02"), // running, pays BZE
        program("03", {prize_denom: VDL, prize_amount: "40000000", payouts: 0, duration: 61}), // running, VDL has no price
        program("04", {staking_denom: "ubze", prize_denom: T}), // pays T: the Earn section's
    ];
    addressData = undefined;
    prices = new Map([[T, new BigNumber("0.5")], ["ubze", new BigNumber("0.002")]]);
    balance = new BigNumber("500000000"); // 500 PAGE
    tx.mockResolvedValue(true);
});

describe("FixedTermPrograms", () => {
    it("is hidden when no program stakes T", () => {
        rewards = [program("04", {staking_denom: "ubze", prize_denom: T})];
        renderPrograms();

        expect(screen.getByTestId("token-site")).toBeEmptyDOMElement();
    });

    it("shows only the running programs to a visitor, without actions", () => {
        status = WalletState.Disconnected;
        addressData = mine([["01", "2000000000"]]);
        renderPrograms();

        expect(screen.getByRole("heading", {name: "Fixed-term programs"})).toBeInTheDocument();
        expect(screen.getByTestId("fixed-term-programs")).toHaveTextContent(
            "PAGE you stake here is locked on its own, separate from the holders pool, with the program's own unlock time.",
        );
        expect(cardIds()).toEqual(["program-02", "program-03"]);
        expect(buttons("02")).toEqual([]);
    });

    it("titles each card by what it pays in and lists its terms", () => {
        renderPrograms();

        expect(within(card("02")).getByRole("heading").textContent).toBe("BZE");
        expect(card("02")).toHaveTextContent(/^Pays inBZE/);
        expect(card("02")).not.toHaveTextContent(/earn/i);
        expect(within(card("02")).getByTestId("program-terms").textContent).toBe(
            "Paid daily500 BZEEnds in23 daysUnlock time14 daysTotal staked6,100,000 PAGEMinimum50 PAGE",
        );
    });

    it("shows the APR in USD when the prize is priced, and hides it otherwise", () => {
        renderPrograms();

        // $1 a day over $3.05M staked.
        expect(within(card("02")).getByTestId("program-apr")).toHaveTextContent("0.011967%APR");
        expect(within(card("03")).queryByTestId("program-apr")).not.toBeInTheDocument();
    });

    it("lists the finished programs the viewer is in last, as finished, without Stake", () => {
        addressData = mine([["01", "2000000000"], ["02", "1000000000"]], [["03", "300000000", 1072]]);
        renderPrograms();

        expect(cardIds()).toEqual(["program-02", "program-03", "program-01"]);
        expect(card("01")).toHaveTextContent("Ends inFinished");
        expect(buttons("01")).toEqual(["Claim", "Unstake"]);
    });

    it("shows the viewer's stake, pending prize and unlocks in the position strip", () => {
        addressData = mine([["02", "2000000000"]], [["03", "300000000", 1072]]);
        renderPrograms();

        const strip = within(card("02")).getByTestId("program-position");
        expect(within(strip).getByTestId("program-stake")).toHaveTextContent("You stake2,000 PAGE");
        // 2,000,000,000 × (0.5 − 0.25) = 500,000,000 ubze.
        expect(within(strip).getByTestId("program-pending")).toHaveTextContent("Ready to claim500 BZE");
        expect(within(strip).queryByTestId("program-unlocking")).not.toBeInTheDocument();
        expect(buttons("02")).toEqual(["Stake more", "Claim", "Unstake"]);

        // Only unlocking: no stake, nothing to claim, no unstake.
        const unlocking = within(card("03")).getByTestId("program-position");
        expect(unlocking).toHaveTextContent("Unlocking300 PAGE · in 3 days");
        expect(within(unlocking).queryByTestId("program-stake")).not.toBeInTheDocument();
        expect(buttons("03")).toEqual(["Stake"]);
    });

    it("hides Claim while nothing is pending", () => {
        rewards = [program("02", {distributed_stake: "0.25"})];
        addressData = mine([["02", "2000000000"]]);
        renderPrograms();

        expect(within(card("02")).getByTestId("program-pending")).toHaveTextContent("Ready to claim0 BZE");
        expect(buttons("02")).toEqual(["Stake more", "Unstake"]);
    });

    it("has no position strip for a viewer who is in no program", () => {
        renderPrograms();

        expect(screen.queryByTestId("program-position")).not.toBeInTheDocument();
        expect(buttons("02")).toEqual(["Stake"]);
    });
});

describe("FixedTermPrograms dialog", () => {
    it("blocks a first stake below the program's minimum", async () => {
        const {user} = renderPrograms();

        await user.click(within(card("02")).getByRole("button", {name: "Stake"}));
        await user.type(screen.getByLabelText("Amount"), "20");

        expect(screen.getByRole("alert")).toHaveTextContent("The minimum stake is 50 PAGE");
        expect(within(screen.getByTestId("stake-dialog-stake")).getByRole("button", {name: "Stake"})).toBeDisabled();
    });

    it("stakes into the program with one joinStaking message", async () => {
        const {user} = renderPrograms();

        await user.click(within(card("02")).getByRole("button", {name: "Stake"}));
        expect(screen.getByRole("dialog")).toHaveTextContent("Unstaking later returns your whole stake after 14 days.");
        await user.type(screen.getByLabelText("Amount"), "60");
        await user.click(within(screen.getByTestId("stake-dialog-stake")).getByRole("button", {name: "Stake"}));

        expect(tx).toHaveBeenCalledTimes(1);
        expect(tx.mock.calls[0][0]).toEqual([{
            typeUrl: "/bze.rewards.MsgJoinStaking",
            value: {creator: ME, rewardId: "02", amount: "60000000"},
        }]);
        expect(reload).toHaveBeenCalled();
        expect(updateBalances).toHaveBeenCalled();
    });

    it("lets a top-up below the minimum through when the whole stake reaches it", async () => {
        addressData = mine([["02", "45000000"]]);
        const {user} = renderPrograms();

        await user.click(within(card("02")).getByRole("button", {name: "Stake more"}));
        await user.type(screen.getByLabelText("Amount"), "5");
        await user.click(within(screen.getByTestId("stake-dialog-stake")).getByRole("button", {name: "Stake more"}));

        expect(tx.mock.calls[0][0][0].value).toEqual({creator: ME, rewardId: "02", amount: "5000000"});
    });

    it("claims the program's prize", async () => {
        addressData = mine([["02", "2000000000"]]);
        const {user} = renderPrograms();

        await user.click(within(card("02")).getByRole("button", {name: "Claim"}));
        const dialog = screen.getByTestId("stake-dialog-claim");
        expect(dialog).toHaveTextContent("You receiveBZE500");
        await user.click(within(dialog).getByRole("button", {name: "Claim"}));

        expect(tx.mock.calls[0][0]).toEqual([{typeUrl: "/bze.rewards.MsgClaimStakingRewards", value: {creator: ME, rewardId: "02"}}]);
    });

    it("unstakes from a finished program with a danger warning", async () => {
        addressData = mine([["01", "2000000000"]]);
        const {user} = renderPrograms();

        await user.click(within(card("01")).getByRole("button", {name: "Unstake"}));
        expect(screen.getByTestId("stake-dialog-unlock")).toHaveTextContent(
            "Your whole stake leaves the program and comes back to your wallet in 14 days. It earns nothing meanwhile.",
        );
        await user.click(within(screen.getByTestId("stake-dialog-unstake")).getByRole("button", {name: "Unstake"}));

        expect(tx.mock.calls[0][0]).toEqual([{typeUrl: "/bze.rewards.MsgExitStaking", value: {creator: ME, rewardId: "01"}}]);
    });

    it("keeps the dialog open and sends nothing more when the transaction fails", async () => {
        tx.mockResolvedValue(false);
        addressData = mine([["02", "2000000000"]]);
        const {user} = renderPrograms();

        await user.click(within(card("02")).getByRole("button", {name: "Unstake"}));
        await user.click(within(screen.getByTestId("stake-dialog-unstake")).getByRole("button", {name: "Unstake"}));

        expect(tx).toHaveBeenCalledTimes(1);
        expect(reload).not.toHaveBeenCalled();
        expect(screen.getByTestId("stake-dialog-unstake")).toBeInTheDocument();
    });
});
