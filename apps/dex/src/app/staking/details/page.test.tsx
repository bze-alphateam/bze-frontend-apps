import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import type { DenomRewardHolderItem } from "@bze/bze-ui-kit";
import { buildStakingRows, type StakingLookups } from "@/lib/staking-list";

const state = vi.hoisted(() => ({ id: null as string | null, address: "bze1me" as string | undefined }));

const TICKERS: Record<string, string> = { ubze: "BZE", uvdl: "VDL", uatom: "ATOM" };
const PRICES: Record<string, number> = { ubze: 0.05, uvdl: 0.01 };
const usd = (d: string, u: BigNumber.Value) => new BigNumber(u).shiftedBy(-6).multipliedBy(PRICES[d] ?? 0);
const lookups: StakingLookups = { ticker: (d) => TICKERS[d] ?? d, verified: () => true, isLp: () => false, usdValue: usd };

const ROWS = buildStakingRows({
    nativeDenom: "ubze",
    simple: [{
        reward_id: "0014", prize_amount: "100000000", prize_denom: "uvdl", duration: 100, payouts: 90, lock: 7,
        staked_amount: "900000000", distributed_stake: "0", staking_denom: "ubze", min_stake: "1000000",
    } as StakingRewardSDKType],
    compounded: [{
        denomReward: { staking_denom: "ubze", staked_amount: "900000000", lock: 0, min_stake: "0" },
        dailyPrizes: [{ denom: "ubze", amount: "100000000" }, { denom: "uvdl", amount: "100000000" }, { denom: "uatom", amount: "5" }],
        unlocks: [],
    } as unknown as DenomRewardHolderItem],
}, lookups);

// The page's data comes from useStakingRows (mocked with real rows); the reward kind's dialog is
// stubbed to show what it was opened with.
vi.mock("@/hooks/useStakingRows", () => ({
    useStakingRows: () => ({ rows: ROWS, address: state.address, isLoading: false, reload: vi.fn() }),
}));
vi.mock("@/hooks/useNavigation", async (importActual) => ({
    ...await importActual<typeof import("@/hooks/useNavigation")>(),
    useNavigationWithParams: () => ({ idParam: state.id }),
}));
vi.mock("@/components/ui/staking/row-dialog", () => ({
    RowDialog: ({ row, view, amount }: { row: { id: string }; view: string; amount?: string }) => (
        <div data-testid="row-dialog">{`${row.id} ${view} ${amount ?? ""}`}</div>
    ),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...await importActual<typeof import("@bze/bze-ui-kit")>(),
    useAssets: () => ({ denomTicker: (d: string) => TICKERS[d] ?? d, denomDecimals: () => 6 }),
    useAsset: (d: string) => ({ asset: { denom: d, ticker: TICKERS[d] ?? d, decimals: 6, logo: "" } }),
    useAssetsValue: () => ({ denomUsdValue: usd }),
    useLiquidityPools: () => ({ getPoolByLpDenom: () => undefined }),
    useMaxSpendable: () => ({ balance: new BigNumber(500_000_000), amount: new BigNumber(500_000_000), inputValue: "500" }),
    useEpochs: () => ({ hourEpochInfo: undefined }),
    useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

import RewardDetailsPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const open = (id: string | null) => {
    state.id = id;
    render(<RewardDetailsPage />, { wrapper });
};

beforeEach(() => {
    state.address = "bze1me";
});

describe("Reward details page", () => {
    it("shows a simple reward's one prize and how many days it has left", () => {
        open("simple:0014");

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("BZE #14");
        expect(screen.getByRole("heading", { name: "Prize" })).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Prizes" })).getAllByTestId("reward-coin")).toHaveLength(1);
        const facts = screen.getByTestId("reward-facts");
        expect(facts).toHaveTextContent("Day 90 of 100");
        expect(facts).toHaveTextContent("10 days left");
        expect(facts).toHaveTextContent("7d");
    });

    it("estimates the income of a typed amount and stops at the reward's end", async () => {
        open("simple:0014");
        expect(screen.queryByTestId("income-estimate")).not.toBeInTheDocument();

        // 100 BZE on 900 staked = 10 % of 100 VDL a day = 10 VDL ($0.10)
        await userEvent.type(screen.getByRole("textbox", { name: "Amount to stake" }), "100");
        const estimate = screen.getByTestId("income-estimate");
        expect(estimate).toHaveTextContent("Estimated income for +100 BZE");
        expect(estimate).toHaveTextContent("Until it ends (10 days)");
        expect(estimate).not.toHaveTextContent("Per 30 days");
        expect(estimate).toHaveTextContent("Your share after: 10.00%");
    });

    it("lists every compounded prize and counts the priced ones", async () => {
        open("compounded:ubze");

        expect(screen.getByRole("heading", { name: "Prizes · 3 tokens" })).toBeInTheDocument();
        expect(screen.getByTestId("reward-facts")).toHaveTextContent("2 of 3 prizes priced");
        expect(screen.getByTestId("reward-facts")).toHaveTextContent("Instant");

        await userEvent.click(screen.getByRole("button", { name: "Max" }));
        const estimate = screen.getByTestId("income-estimate");
        expect(estimate).toHaveTextContent("Per year");
        expect(estimate).toHaveTextContent("leaves out the 1 prize with no price");
    });

    it("opens the stake step with the typed amount", async () => {
        open("compounded:ubze");
        await userEvent.type(screen.getByRole("textbox", { name: "Amount to stake" }), "42");
        await userEvent.click(screen.getByRole("button", { name: "Stake" }));

        expect(screen.getByTestId("row-dialog")).toHaveTextContent("compounded:ubze stake 42");
    });

    it("needs a wallet to stake but still estimates without one", async () => {
        state.address = undefined;
        open("simple:0014");

        await userEvent.type(screen.getByRole("textbox", { name: "Amount to stake" }), "100");
        expect(screen.getByTestId("income-estimate")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Stake" })).toBeDisabled();
    });

    it.each([["simple:9999"], ["native"], [null]])("says the reward is not found for id %s", (id) => {
        open(id);
        expect(screen.getByText("Reward not found")).toBeInTheDocument();
    });
});
