import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";

// The page runs on mocked hooks: query params, wallet, the simple rewards list, balances, the fee
// engine and the wallet side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx store,
// the Review step and the Done screen are real. "Today" is fixed at 20 Oct 2026.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};
const { queryParams, wallet, rewardsState, balances, navigateMock, txMock, refreshMock } = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    rewardsState: { rewards: [] as StakingRewardSDKType[], isLoading: false, hasError: false },
    balances: { current: {} as Record<string, string> },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/reward/extend",
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
        useBalance: (denom: string) => ({ balance: { denom, amount: new BN(balances.current[denom] ?? "0") }, isLoading: false }),
        useAssetPrice: () => ({ hasPrice: false, totalUsdValue: () => new BN(0), uAmountUsdValue: () => new BN(0) }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import RewardExtendPage from "./page";
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
    staked_amount: "5000000000000",
    distributed_stake: "0",
    ...over,
});
const RUNNING = reward({});
const FINISHED = reward({ reward_id: "0000000000000004", payouts: 30 });
const VDL = reward({ reward_id: "0000000000000005", staking_denom: "uvdl", prize_denom: "ubze", prize_amount: "5000000" });

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<RewardExtendPage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const extendButton = () => button(step("Review"), "Extend");
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

async function enterDays(days: string) {
    await userEvent.type(within(step("Extra days")).getByLabelText("Extra days"), days);
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
    rewardsState.rewards = [RUNNING, FINISHED, VDL];
    rewardsState.isLoading = false;
    rewardsState.hasError = false;
    balances.current = { uhoney: "797000000000", ubze: "1000000000" };
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

describe("Extend a reward (/reward/extend)", { timeout: 20_000 }, () => {
    it("opens on Extra days for the linked reward, with its terms read-only", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Extend a reward" })).toBeInTheDocument();
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        expect(crumbs).toHaveTextContent("Rewards");
        expect(crumbs).toHaveTextContent("Extend");

        expect(step("Reward")).toHaveAttribute("data-state", "done");
        expect(step("Reward")).toHaveTextContent("Stake HONEY/BZE LP · earn 100 HONEY a day");
        expect(step("Extra days")).toHaveAttribute("data-state", "active");

        const terms = screen.getByTestId("extend-terms");
        expect(terms).toHaveTextContent("StakeHONEY/BZE LP");
        expect(terms).toHaveTextContent("Daily reward100 HONEY");
        expect(terms).toHaveTextContent("End date26 Oct");
        expect(terms).not.toHaveTextContent("stays as it is");
        expect(screen.queryByText(/Anyone can extend/)).not.toBeInTheDocument();
        expect(screen.queryByText(/daily amount can't change/)).not.toBeInTheDocument();
    });

    describe("Extra days", () => {
        it("shows only the new end date and puts the cost in the pay panel", async () => {
            renderPage();
            await enterDays("10");
            expect(screen.getByTestId("extend-new-end")).toHaveTextContent("New end date5 Nov");
            expect(screen.getByTestId("extend-cost")).not.toHaveTextContent("×");
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("Extra rewards: 1000000000 uhoney");
            expect(screen.getByTestId("extend-holdings")).toHaveTextContent("You hold 797,000 HONEY ✓");

            await userEvent.click(button(step("Extra days"), "Review extension"));
            expect(step("Extra days")).toHaveTextContent("10 days · new end 5 Nov");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it("refuses more days than the 36,500-day cap leaves, before signing", async () => {
            rewardsState.rewards = [reward({ duration: 36000, payouts: 100 })];
            renderPage();
            expect(within(step("Extra days")).getByText("Min 1 · Max 500 days")).toBeInTheDocument();
            await enterDays("501");
            expect(within(step("Extra days")).getByText("At most 500 more days: a reward can't run more than 36,500 days in total.")).toBeInTheDocument();
            expect(button(step("Extra days"), "Review extension")).toBeDisabled();
            expect(txMock).not.toHaveBeenCalled();
        });

        it("blocks when the wallet holds too little of the reward token", async () => {
            balances.current = { uhoney: "500000000" };
            renderPage();
            await enterDays("10");
            expect(screen.getByRole("alert")).toHaveTextContent("Not enough HONEY: you hold 500.");
            expect(screen.getByTestId("extend-holdings")).toHaveTextContent("You hold 500 HONEY ✗");
            expect(button(step("Extra days"), "Review extension")).toBeDisabled();
        });

        it("restarts a finished reward from today", async () => {
            queryParams.current = new URLSearchParams({ id: FINISHED.reward_id });
            renderPage();
            expect(screen.getByTestId("extend-terms")).toHaveTextContent("End dateEnded");
            await enterDays("10");
            expect(screen.getByTestId("extend-new-end")).toHaveTextContent("New end date30 Oct");
        });
    });

    describe("Review", () => {
        it("lists what leaves the wallet, what stakers get and what is permanent, then signs MsgUpdateStakingReward with the days added", async () => {
            renderPage();
            await enterDays("10");
            await userEvent.click(button(step("Extra days"), "Review extension"));

            const review = step("Review");
            const leaves = within(review).getByRole("region", { name: "Leaves your wallet" });
            expect(leaves).toHaveTextContent(/Extra rewards\s*HONEY\s*1,000 HONEY/);
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("10 more days for everyone staking HONEY/BZE LP");
            expect(within(review).getByRole("region", { name: "Permanent" })).toHaveTextContent("Extra tokens are committed to stakers");

            await userEvent.click(extendButton());
            expect(sentMsgs()).toEqual([{
                typeUrl: "/bze.rewards.MsgUpdateStakingReward",
                value: { creator: "bze1me", rewardId: RUNNING.reward_id, duration: "10" },
            }]);
        });

        it("can be walked without a wallet, which it then asks for", async () => {
            wallet.address = undefined;
            renderPage();
            await enterDays("10");
            expect(screen.queryByTestId("extend-holdings")).not.toBeInTheDocument();
            await userEvent.click(button(step("Extra days"), "Review extension"));
            expect(screen.getByText("Connect your wallet to extend this reward.")).toBeInTheDocument();
            expect(extendButton()).toBeDisabled();
        });
    });

    describe("Done", () => {
        it("celebrates the extra days and sends people to stake on the DEX", async () => {
            renderPage();
            await enterDays("10");
            await userEvent.click(button(step("Extra days"), "Review extension"));
            await userEvent.click(extendButton());
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));

            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("10 more days for HONEY/BZE LP stakers.");
            expect(screen.getByText("Everyone staking HONEY/BZE LP keeps sharing 100 HONEY a day until 5 Nov.")).toBeInTheDocument();
            expect(refreshMock).toHaveBeenCalled();
            expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");

            const recommended = screen.getByTestId("done-recommended");
            expect(recommended).toHaveTextContent("Stake on DEX");
            expect(screen.queryByTestId("done-more")).not.toBeInTheDocument();
        });
    });

    describe("Reward", () => {
        it("lists the running rewards when there is no id, searchable by staked token", async () => {
            queryParams.current = new URLSearchParams();
            renderPage();
            expect(step("Reward")).toHaveAttribute("data-state", "active");
            const options = () => screen.getAllByTestId("extend-reward-option");
            // The finished reward is left out.
            expect(options()).toHaveLength(2);
            expect(options()[0]).toHaveTextContent("Stake HONEY/BZE LP · earn 100 HONEY a day");
            expect(options()[0]).toHaveTextContent("#0000000000000003 · 6 of 30 · ends 26 Oct");
            expect(options()[1]).toHaveTextContent("Stake VDL · earn 5 BZE a day");

            await userEvent.type(screen.getByRole("textbox", { name: "Search rewards" }), "vdl");
            expect(options()).toHaveLength(1);

            await userEvent.click(options()[0]);
            expect(step("Reward")).toHaveAttribute("data-state", "done");
            expect(step("Reward")).toHaveTextContent("Stake VDL · earn 5 BZE a day");
            expect(step("Extra days")).toHaveAttribute("data-state", "active");
        });

        it("says when nothing matches the search", async () => {
            queryParams.current = new URLSearchParams();
            renderPage();
            await userEvent.type(screen.getByRole("textbox", { name: "Search rewards" }), "nothing");
            expect(screen.getByTestId("extend-reward-empty")).toHaveTextContent("No running simple reward matches this search.");
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
