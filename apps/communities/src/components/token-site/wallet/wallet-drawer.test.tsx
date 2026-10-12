import {beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {WalletState} from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import {type Asset, DEFAULT_DENOM_BRANDING, type DenomRewardHolderItem} from "@bze/bze-ui-kit";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const FRIEND = "bze1qurswpc8qurswpc8qurswpc8qurswpc8wht3jk";

// Every hook the drawer reads is mocked; the values below are per test.
const tx = vi.fn();
const sdkTx = vi.fn();
const updateBalances = vi.fn();
const reloadHoldersPool = vi.fn();
const reloadPrograms = vi.fn();
let balances: Record<string, BigNumber> = {};
let holdersPool: DenomRewardHolderItem | undefined;
let programs: StakingRewardSDKType[] = [];
let programStakes = new Map<string, { address: string; reward_id: string; amount: string; joined_at: string }>();
let maxSpendable = new BigNumber(0);
let feeMessage = "";
let hasPrice = true;
let pools: { base: string; quote: string }[] = [];

const ASSETS: Record<string, { ticker: string; decimals: number }> = {
    [T]: {ticker: "PAGE", decimals: 6},
    ubze: {ticker: "BZE", decimals: 6},
    uusdc: {ticker: "USDC", decimals: 6},
    uatom: {ticker: "ATOM", decimals: 6},
    "ulp_1": {ticker: "LP", decimals: 12},
};
const USD: Record<string, number> = {ubze: 0.001, uusdc: 1, uatom: 5};

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useBalance: (denom: string) => ({balance: {denom, amount: balances[denom] ?? new BigNumber(0)}, isLoading: false}),
    useBalances: () => ({
        assetsBalances: Object.entries(balances).map(([denom, amount]) => ({
            denom, amount, ticker: ASSETS[denom].ticker, decimals: ASSETS[denom].decimals,
            USDValue: amount.dividedBy(1e6).multipliedBy(USD[denom] ?? 0),
        })),
    }),
    useAssetPrice: () => ({price: new BigNumber("0.0412"), change: 0, hasPrice}),
    useAssets: () => ({
        denomTicker: (denom: string) => ASSETS[denom]?.ticker ?? denom,
        denomDecimals: (denom: string) => ASSETS[denom]?.decimals ?? 0,
    }),
    useAssetsContext: () => ({updateBalances}),
    useBZETx: () => ({tx, progressTrack: ""}),
    useSDKTx: () => ({tx: sdkTx, progressTrack: ""}),
    useMaxSpendable: (denom: string) => ({
        amount: maxSpendable, balance: balances[denom] ?? new BigNumber(0), inputValue: maxSpendable.dividedBy(1e6).toFixed(), isLoading: false,
    }),
    useCanAffordTx: () => ({
        canAfford: feeMessage === "", message: feeMessage, isLoading: false,
        gasFee: {displayAmount: new BigNumber("0.5"), ticker: "PAGE"},
    }),
    useLiquidityPools: () => ({pools, isLoading: false}),
    useGasFeeEstimate: () => ({displayAmount: new BigNumber("0.02"), ticker: "BZE", isLoading: false}),
    useTokenDenomReward: () => ({item: holdersPool, prizeDenoms: [], isLoading: false, hasError: false, reload: reloadHoldersPool}),
}));

const reloadNextBurn = vi.fn();
vi.mock("@/hooks/useNextBurning", () => ({
    useNextBurning: () => ({nextBurn: undefined, isLoading: false, reload: reloadNextBurn}),
}));

vi.mock("@/hooks/useRewardsStakingData", () => ({
    useRewardsStakingData: () => ({
        rewards: programs,
        isLoading: false,
        addressData: {address: ME, active: programStakes, unlocking: new Map()},
        reload: reloadPrograms,
    }),
}));

const connect = vi.fn();
const disconnect = vi.fn();
let walletStatus = WalletState.Disconnected;
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({
        status: walletStatus,
        address: walletStatus === WalletState.Connected ? ME : undefined,
        connect,
        disconnect,
    }),
}));

vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => ({colorMode: "light", setColorMode: vi.fn(), toggleColorMode: vi.fn()}),
}));

import {TokenWalletProvider, useTokenWallet, type WalletTab} from "@/hooks/token-site/useTokenWallet";
import {TokenSiteTheme} from "../kit";
import {WalletDrawer} from "./index";

forbidNetwork();

const ASSET: Asset = {
    type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n,
};

function OpenButton({tab}: { tab: WalletTab }) {
    const {open} = useTokenWallet();
    return <button type="button" onClick={() => open(tab)}>Open</button>;
}

/** Opens the drawer on `tab` (Send by default: the Get tab has its own tests). */
async function renderDrawer(tab: WalletTab = "send") {
    const user = userEvent.setup();
    render(<><OpenButton tab={tab}/><WalletDrawer asset={ASSET}/></>, {
        wrapper: ({children}: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>
                <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><TokenWalletProvider>{children}</TokenWalletProvider></TokenSiteTheme>
            </ChakraProvider>
        ),
    });
    await user.click(screen.getByRole("button", {name: "Open"}));
    return {user, drawer: screen.getByRole("dialog", {name: "Your Page wallet"})};
}

const program = (id: string, prizeDenom: string, stakingDenom = T): StakingRewardSDKType => ({
    reward_id: id, prize_amount: "10", prize_denom: prizeDenom, staking_denom: stakingDenom, duration: 30, payouts: 1,
    min_stake: 0n, lock: 1, staked_amount: "5000000000", distributed_stake: "0.5",
});

const pool = (amount: string, pending: { denom: string; amount: string }[]): DenomRewardHolderItem => ({
    denomReward: {staking_denom: T, lock: 3, min_stake: "1", staked_amount: "100000000000"},
    position: {participant: {address: ME, staking_denom: T, amount}, pending},
    unlocks: [{staking_denom: T, amount: "1000000000", unlockEpoch: 10}],
});

beforeEach(() => {
    vi.clearAllMocks();
    walletStatus = WalletState.Connected;
    balances = {[T]: new BigNumber("12480000000")};
    holdersPool = undefined;
    programs = [];
    programStakes = new Map();
    maxSpendable = new BigNumber("12479500000");
    feeMessage = "";
    hasPrice = true;
    pools = [];
    tx.mockResolvedValue(true);
    sdkTx.mockResolvedValue(true);
});

describe("WalletDrawer", () => {
    describe("disconnected", () => {
        beforeEach(() => { walletStatus = WalletState.Disconnected; });

        it("shows a connect prompt that opens the wallet modal and steps aside for it", async () => {
            const {user, drawer} = await renderDrawer();

            expect(within(drawer).getByTestId("wallet-connect-prompt")).toBeInTheDocument();
            expect(within(drawer).queryByText("PAGE balance")).not.toBeInTheDocument();

            await user.click(within(drawer).getByRole("button", {name: "Connect wallet"}));

            expect(connect).toHaveBeenCalled();
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });

        it("says T is not tradable yet when Get is asked for on a token in no pool", async () => {
            const {drawer} = await renderDrawer("get");

            expect(within(drawer).getByTestId("wallet-connect-prompt")).toHaveTextContent("Not tradable yet");
        });

        it("asks for a wallet only when T is tradable", async () => {
            pools = [{base: T, quote: "ubze"}];
            const {drawer} = await renderDrawer("get");

            expect(within(drawer).queryByText("Not tradable yet")).not.toBeInTheDocument();
        });
    });

    describe("balance card", () => {
        it("shows the T balance, its USD value and the sums of the T positions", async () => {
            holdersPool = pool("5000000000", []);
            programs = [program("1", "ubze"), program("2", "ubze"), program("3", T, "ubze")];
            programStakes = new Map([
                ["1", {address: ME, reward_id: "1", amount: "1500000000", joined_at: "0.5"}],
                ["2", {address: ME, reward_id: "2", amount: "500000000", joined_at: "0.5"}],
                ["3", {address: ME, reward_id: "3", amount: "9000000000", joined_at: "0.5"}],
            ]);

            const {drawer} = await renderDrawer();

            expect(within(drawer).getByTestId("wallet-balance")).toHaveTextContent("12,480");
            expect(within(drawer).getByTestId("wallet-balance-usd")).toHaveTextContent("≈ $514.18");
            expect(within(drawer).getByTestId("wallet-holders-pool")).toHaveTextContent("5,000");
            expect(within(drawer).getByTestId("wallet-programs")).toHaveTextContent("2,000");
            expect(within(drawer).getByTestId("wallet-unlocking")).toHaveTextContent("1,000");
            expect(within(drawer).getByRole("button", {name: "Copy address"})).toHaveTextContent("bze1z3m…wg3l · Copy");
        });

        it("hides the USD value without a price", async () => {
            hasPrice = false;
            const {drawer} = await renderDrawer();

            expect(within(drawer).queryByTestId("wallet-balance-usd")).not.toBeInTheDocument();
        });
    });

    describe("rewards ready", () => {
        it("is hidden when nothing is pending", async () => {
            holdersPool = pool("5000000000", [{denom: "ubze", amount: "0"}]);
            const {drawer} = await renderDrawer();

            expect(within(drawer).queryByRole("button", {name: "Claim all"})).not.toBeInTheDocument();
        });

        it("groups the pending rewards and claims them all in one transaction", async () => {
            holdersPool = pool("5000000000", [{denom: T, amount: "34200000"}, {denom: "ubze", amount: "13100000"}]);
            programs = [program("1", "uusdc")];
            // 80000 × (0.5 − 0) = 40000 uusdc = 0.04 USDC
            programStakes = new Map([["1", {address: ME, reward_id: "1", amount: "80000", joined_at: "0"}]]);

            const {user, drawer} = await renderDrawer();

            expect(within(drawer).getByText("Rewards ready · pool + 1 program")).toBeInTheDocument();
            expect(within(drawer).getByTestId("wallet-rewards")).toHaveTextContent("34.2 PAGE · 13.1 BZE · 0.04 USDC");

            await user.click(within(drawer).getByRole("button", {name: "Claim all"}));

            expect(tx).toHaveBeenCalledTimes(1);
            expect(tx.mock.calls[0][0].map((msg: { typeUrl: string }) => msg.typeUrl)).toEqual([
                "/bze.rewards.MsgClaimDenomRewards",
                "/bze.rewards.MsgClaimStakingRewards",
            ]);
            await waitFor(() => expect(reloadPrograms).toHaveBeenCalled());
            expect(reloadHoldersPool).toHaveBeenCalled();
            expect(updateBalances).toHaveBeenCalled();
        });
    });

    describe("send", () => {
        it("rejects a recipient that is not a BeeZee address", async () => {
            const {user, drawer} = await renderDrawer();

            await user.click(within(drawer).getByLabelText("Recipient"));
            await user.paste("cosmos1notbze");

            expect(within(drawer).getByRole("alert")).toHaveTextContent(/Invalid address|another network/);
            expect(within(drawer).getByRole("button", {name: "Send PAGE"})).toBeDisabled();
        });

        it("rejects more than the balance", async () => {
            const {user, drawer} = await renderDrawer();

            await user.click(within(drawer).getByLabelText("Recipient"));
            await user.paste(FRIEND);
            await user.type(within(drawer).getByLabelText("Amount"), "20000");

            expect(within(drawer).getByRole("alert")).toHaveTextContent("Insufficient balance");
            expect(within(drawer).getByRole("button", {name: "Send PAGE"})).toBeDisabled();
        });

        it("refuses an amount that leaves nothing for the network fee", async () => {
            feeMessage = "Not enough PAGE left for the network fee (≈ 0.5 PAGE)";
            const {user, drawer} = await renderDrawer();

            await user.type(within(drawer).getByLabelText("Amount"), "12480");

            expect(within(drawer).getByRole("alert")).toHaveTextContent("Not enough PAGE left for the network fee");
        });

        it("fills Max with the balance minus the fee reserve and sends T", async () => {
            const {user, drawer} = await renderDrawer();

            await user.click(within(drawer).getByLabelText("Recipient"));
            await user.paste(FRIEND);
            await user.click(within(drawer).getByRole("button", {name: "Max"}));
            expect(within(drawer).getByLabelText("Amount")).toHaveValue("12479.5");

            await user.click(within(drawer).getByRole("button", {name: "Send PAGE"}));

            expect(sdkTx).toHaveBeenCalledTimes(1);
            const [msg] = sdkTx.mock.calls[0][0];
            expect(msg.typeUrl).toBe("/cosmos.bank.v1beta1.MsgSend");
            expect(msg.value).toEqual({fromAddress: ME, toAddress: FRIEND, amount: [{denom: T, amount: "12479500000"}]});
            await waitFor(() => expect(within(drawer).getByLabelText("Amount")).toHaveValue(""));
        });
    });

    describe("other assets", () => {
        it("lists every other non-zero balance except LP shares, by USD value, once expanded", async () => {
            balances = {
                [T]: new BigNumber("12480000000"),
                ubze: new BigNumber("8912400000"),
                uusdc: new BigNumber("42100000"),
                uatom: new BigNumber("1250000"),
                ulp_1: new BigNumber("5000000000000"),
            };
            const {user, drawer} = await renderDrawer();

            const toggle = within(drawer).getByRole("button", {name: /Other assets in this wallet \(3\)/});
            expect(within(drawer).queryByText("USDC")).not.toBeInTheDocument();

            await user.click(toggle);

            const list = within(drawer).getByRole("list");
            expect(within(list).getAllByRole("listitem").map((item) => item.firstChild?.textContent)).toEqual(["USDC", "BZE", "ATOM"]);
        });
    });

    it("disconnects and closes", async () => {
        const {user, drawer} = await renderDrawer();

        await user.click(within(drawer).getByRole("button", {name: "Disconnect"}));

        expect(disconnect).toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    describe("burn", () => {
        it("is a tab of the drawer, after Send", async () => {
            const {drawer} = await renderDrawer("burn");

            expect(within(drawer).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Get PAGE", "Send", "Burn"]);
            expect(within(drawer).getByRole("tab", {name: "Burn"})).toHaveAttribute("aria-selected", "true");
        });

        it("fills Max with the balance minus the fee reserve, confirms, and sends one fundBurner", async () => {
            const {user, drawer} = await renderDrawer("burn");
            const panel = within(drawer).getByRole("tabpanel", {name: "Burn"});

            await user.click(within(panel).getByRole("button", {name: "Max"}));
            expect(within(panel).getByLabelText("Amount to burn")).toHaveValue("12479.5");

            await user.click(within(panel).getByRole("button", {name: "Burn PAGE"}));
            expect(tx).not.toHaveBeenCalled();
            await user.click(within(panel).getByRole("button", {name: "Confirm burn"}));

            expect(tx).toHaveBeenCalledTimes(1);
            const msgs = tx.mock.calls[0][0];
            expect(msgs).toHaveLength(1);
            expect(msgs[0].typeUrl).toBe("/bze.burner.MsgFundBurner");
            expect(msgs[0].value).toEqual({creator: ME, amount: `12479500000${T}`});
            // Back on an empty form, the balances and the burner's queue read again.
            await waitFor(() => expect(within(panel).getByLabelText("Amount to burn")).toHaveValue(""));
            expect(updateBalances).toHaveBeenCalled();
            expect(reloadNextBurn).toHaveBeenCalledTimes(1);
        });
    });

    it("opens on the Get tab when Get T is asked for", async () => {
        const {drawer} = await renderDrawer("get");

        expect(within(drawer).getByRole("tab", {name: "Get PAGE"})).toHaveAttribute("aria-selected", "true");
        expect(within(drawer).getByRole("tabpanel", {name: "Get PAGE"})).toHaveTextContent("Not tradable yet");
    });
});
