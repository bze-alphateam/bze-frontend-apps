import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";

// The page runs on mocked hooks: query params, wallet, the simple rewards list, the spendable
// balance, the fee engine and the wallet side of the tx (useFactoryTx). The wizard's tx hook, the
// pending-tx store, the Review step and the Done screen are real. "Today" is fixed at 20 Oct 2026.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};
const { queryParams, wallet, rewardsState, spendable, navigateMock, txMock, refreshMock } = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    rewardsState: { rewards: [] as StakingRewardSDKType[], isLoading: false, hasError: false },
    // Display units: what Max fills; the balance is in base units.
    spendable: { input: "797000", balance: "797000000000" },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/reward/distribute",
    useSearchParams: () => queryParams.current,
}));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => ({ ...rewardsState, refresh: refreshMock }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({
        paysWithAlt: false,
        canPayFee: true,
        isLoading: false,
        method: "native",
        gasFee: { denom: "ubze", amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE", isLoading: false },
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, footer }: { rows: { label: string; coin?: { denom: string; amount: string } }[]; footer?: ReactNode }) => (
        <div data-testid="pay-panel">{rows.map(r => `${r.label}: ${r.coin?.amount} ${r.coin?.denom}`).join(", ")}{footer}</div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        uhoney: { denom: "uhoney", ticker: "HONEY", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uvdl: { denom: "uvdl", ticker: "VDL", decimals: 6, logo: "" },
        "ulp/hb": { denom: "ulp/hb", ticker: "HONEY/BZE LP", decimals: 12, logo: "" },
    };
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssets: () => ({ denomTicker: (d: string) => assets[d]?.ticker ?? d }),
        useMaxSpendable: () => ({
            amount: new BN(spendable.input).multipliedBy(1_000_000),
            inputValue: spendable.input,
            balance: new BN(spendable.balance),
        }),
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import RewardDistributePage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const reward = (over: Partial<StakingRewardSDKType>): StakingRewardSDKType => ({
    reward_id: "0000000000000003",
    prize_amount: "100000000",
    prize_denom: "uhoney",
    staking_denom: "ulp/hb",
    duration: 30,
    payouts: 24,
    min_stake: 0n,
    lock: 0,
    staked_amount: "5000000000000000",
    distributed_stake: "0",
    ...over,
});
const RUNNING = reward({});
const FINISHED = reward({ reward_id: "0000000000000004", payouts: 30, staking_denom: "uvdl", staked_amount: "2000000" });
const EMPTY = reward({ reward_id: "0000000000000005", staked_amount: "0" });
const VDL = reward({ reward_id: "0000000000000006", staking_denom: "uvdl", prize_denom: "ubze", staked_amount: "9000000" });

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<RewardDistributePage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const amountInput = () => within(step("Amount")).getByLabelText("Amount (HONEY)");
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

async function enterAmount(amount: string) {
    await userEvent.type(amountInput(), amount);
}

function txSucceeds() {
    txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
        return true;
    });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 12));
    queryParams.current = new URLSearchParams({ id: RUNNING.reward_id });
    wallet.address = "bze1me";
    rewardsState.rewards = [RUNNING, FINISHED, EMPTY, VDL];
    rewardsState.isLoading = false;
    rewardsState.hasError = false;
    spendable.input = "797000";
    spendable.balance = "797000000000";
    navigateMock.mockReset();
    refreshMock.mockReset();
    txMock.mockReset();
    txSucceeds();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("Distribute to a simple reward (/reward/distribute)", { timeout: 20_000 }, () => {
    it("opens on Amount for the linked reward, with its prize coin and the wallet's balance", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Distribute to stakers" })).toBeInTheDocument();
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        expect(crumbs).toHaveTextContent("Rewards");
        expect(crumbs).toHaveTextContent("Distribute");

        expect(step("Reward")).toHaveAttribute("data-state", "done");
        expect(step("Reward")).toHaveTextContent("Stake HONEY/BZE LP · paid in HONEY");
        expect(step("Amount")).toHaveAttribute("data-state", "active");

        const terms = screen.getByTestId("distribute-terms");
        expect(terms).toHaveTextContent("People stakeHONEY/BZE LP");
        expect(terms).toHaveTextContent("Paid inHONEY");
        expect(terms).toHaveTextContent("Staked now5,000 HONEY/BZE LP");
        expect(screen.getByTestId("distribute-balance")).toHaveTextContent("of 797,000 HONEY");
    });

    describe("Amount", () => {
        it("previews the split and puts the gift in the pay panel", async () => {
            renderPage();
            await enterAmount("1000");
            expect(screen.getByTestId("distribute-sentence")).toHaveTextContent(
                "1,000 HONEY is split between everyone staking HONEY/BZE LP right now, by how much each stakes.",
            );
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("The gift: 1000000000 uhoney");
            expect(screen.getByTestId("distribute-holdings")).toHaveTextContent("You hold 797,000 HONEY ✓");

            await userEvent.click(button(step("Amount"), "Review"));
            expect(step("Amount")).toHaveTextContent("1,000 HONEY");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it("Max fills the spendable balance", async () => {
            spendable.input = "796999.5";
            renderPage();
            await userEvent.click(button(step("Amount"), "Max"));
            expect(amountInput()).toHaveValue("796999.5");
            expect(button(step("Amount"), "Review")).toBeEnabled();
        });

        it("blocks more than can be spent", async () => {
            spendable.input = "500";
            spendable.balance = "500000000";
            renderPage();
            await enterAmount("501");
            expect(screen.getByRole("alert")).toHaveTextContent("Not enough HONEY: you can send up to 500 HONEY.");
            expect(screen.getByTestId("distribute-holdings")).toHaveTextContent("You hold 500 HONEY ✗");
            expect(button(step("Amount"), "Review")).toBeDisabled();
        });

        it("refuses an amount with more decimals than the token has", async () => {
            renderPage();
            await enterAmount("1.1234567");
            await userEvent.tab();
            expect(within(step("Amount")).getByText("At most 6 decimal places (the token's decimals).")).toBeInTheDocument();
            expect(button(step("Amount"), "Review")).toBeDisabled();
        });

        it("blocks a reward nobody stakes in: the chain would refuse it", () => {
            queryParams.current = new URLSearchParams({ id: EMPTY.reward_id });
            renderPage();
            expect(screen.getByText("Nobody stakes in this reward.")).toBeInTheDocument();
            expect(within(step("Amount")).queryByLabelText("Amount (HONEY)")).not.toBeInTheDocument();
            expect(button(step("Amount"), "Review")).toBeDisabled();
        });

        it("still takes a finished reward with stakers, and says so", () => {
            queryParams.current = new URLSearchParams({ id: FINISHED.reward_id });
            renderPage();
            expect(screen.getByText("This reward has finished.")).toBeInTheDocument();
            expect(screen.getByText("Its stakers can still claim what you send.")).toBeInTheDocument();
        });
    });

    describe("Review", () => {
        it("signs MsgDistributeStakingRewards with the reward id and the amount in base units", async () => {
            renderPage();
            await enterAmount("1000.5");
            await userEvent.click(button(step("Amount"), "Review"));

            const review = step("Review");
            expect(within(review).getByRole("region", { name: "Leaves your wallet" })).toHaveTextContent(/The gift\s*HONEY\s*1,000.5 HONEY/);
            expect(within(review).getByRole("region", { name: "Permanent" })).toHaveTextContent("A distribution can't be undone");

            await userEvent.click(button(review, "Distribute now"));
            expect(sentMsgs()).toEqual([{
                typeUrl: "/bze.rewards.MsgDistributeStakingRewards",
                value: { creator: "bze1me", rewardId: RUNNING.reward_id, amount: "1000500000" },
            }]);
        });

        it("can be walked without a wallet, which it then asks for", async () => {
            wallet.address = undefined;
            renderPage();
            expect(screen.queryByTestId("distribute-balance")).not.toBeInTheDocument();
            await enterAmount("10");
            await userEvent.click(button(step("Amount"), "Review"));
            expect(screen.getByText("Connect your wallet to distribute.")).toBeInTheDocument();
            expect(button(step("Review"), "Distribute now")).toBeDisabled();
        });
    });

    describe("Done", () => {
        it("says what was sent and proposes telling the stakers", async () => {
            renderPage();
            await enterAmount("1000");
            await userEvent.click(button(step("Amount"), "Review"));
            await userEvent.click(button(step("Review"), "Distribute now"));
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));

            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("1,000 HONEY sent to HONEY/BZE LP stakers.");
            expect(screen.getByText("Everyone staking HONEY/BZE LP can claim their share now.")).toBeInTheDocument();
            expect(refreshMock).toHaveBeenCalled();
            expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
            expect(screen.getByTestId("done-recommended")).toHaveTextContent("Tell your stakers");
        });
    });

    describe("Reward", () => {
        it("lists the rewards with stakers when there is no id, searchable by token", async () => {
            queryParams.current = new URLSearchParams();
            renderPage();
            expect(step("Reward")).toHaveAttribute("data-state", "active");
            const options = () => screen.getAllByTestId("distribute-reward-option");
            // The empty reward is left out; a finished one with stakers stays.
            expect(options()).toHaveLength(3);
            expect(options()[0]).toHaveTextContent("Stake HONEY/BZE LP · paid in HONEY");
            expect(options()[0]).toHaveTextContent("#0000000000000003 · 6 of 30 · ends 26 Oct");

            await userEvent.type(screen.getByRole("textbox", { name: "Search rewards" }), "bze");
            expect(options()).toHaveLength(2);

            await userEvent.click(options()[1]);
            expect(step("Reward")).toHaveAttribute("data-state", "done");
            expect(step("Reward")).toHaveTextContent("Stake VDL · paid in BZE");
            expect(step("Amount")).toHaveAttribute("data-state", "active");
        });

        it("preselects the only reward with stakers of ?staking=", () => {
            queryParams.current = new URLSearchParams({ staking: "ulp/hb" });
            renderPage();
            expect(step("Reward")).toHaveAttribute("data-state", "done");
            expect(step("Reward")).toHaveTextContent("Stake HONEY/BZE LP · paid in HONEY");
        });

        it("narrows the list to ?denom= when it has several rewards", () => {
            queryParams.current = new URLSearchParams({ denom: "uvdl" });
            renderPage();
            expect(step("Reward")).toHaveAttribute("data-state", "active");
            const options = screen.getAllByTestId("distribute-reward-option");
            expect(options.map(o => o.textContent)).toEqual([
                expect.stringContaining("Stake VDL · paid in HONEY"),
                expect.stringContaining("Stake VDL · paid in BZE"),
            ]);
        });

        it("says when no reward has stakers", () => {
            queryParams.current = new URLSearchParams();
            rewardsState.rewards = [EMPTY];
            renderPage();
            expect(screen.getByTestId("distribute-reward-empty")).toHaveTextContent("No simple reward has stakers right now.");
        });

        it("tells an unknown id apart, with a way to every reward", async () => {
            queryParams.current = new URLSearchParams({ id: "0000000000000099" });
            renderPage();
            expect(screen.getByText("We couldn't find reward #0000000000000099.")).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: /See all rewards/ }));
            expect(navigateMock).toHaveBeenCalledWith("/rewards");
        });

        it("waits for the list before deciding the id is unknown", () => {
            rewardsState.isLoading = true;
            rewardsState.rewards = [];
            renderPage();
            expect(screen.queryByText(/We couldn't find reward/)).not.toBeInTheDocument();
            expect(step("Reward")).toHaveAttribute("data-state", "active");
        });
    });
});
