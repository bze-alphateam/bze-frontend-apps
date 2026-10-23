import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";

const { REWARDS, TICKERS } = vi.hoisted(() => ({
    REWARDS: [
        { reward_id: "1", staking_denom: "factory/bze1a/uhoney", prize_denom: "ubze", staked_amount: "10", payouts: 1, duration: 30 },
        { reward_id: "2", staking_denom: "factory/bze1b/uwax", prize_denom: "ubze", staked_amount: "5", payouts: 1, duration: 30 },
    ] as unknown as StakingRewardSDKType[],
    TICKERS: { "factory/bze1a/uhoney": "HONEY", "factory/bze1b/uwax": "WAX", ubze: "BZE" } as Record<string, string>,
}));

// The staking page's data hooks are mocked so the test feeds the reward lists directly (no wallet,
// no chain). The cards are stubbed to show which reward they render; the compounded section shows
// the search term it was handed.
vi.mock("@/hooks/useNativeStakingData", () => ({
    useNativeStakingData: () => ({ stakingData: undefined, isLoading: true, reload: vi.fn() }),
}));
vi.mock("@/hooks/useRewardsStakingData", () => ({
    useRewardsStakingData: () => ({ rewards: REWARDS, isLoading: false, addressData: undefined, reload: vi.fn() }),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: undefined }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...await importActual<typeof import("@bze/bze-ui-kit")>(),
    useDenomRewardsData: () => ({ items: [], isLoading: false, hasError: false, reload: vi.fn() }),
    useAssets: () => ({
        isVerifiedAsset: () => true,
        denomTicker: (denom: string) => TICKERS[denom] ?? denom,
        nativeAsset: undefined,
        denomDecimals: () => 6,
    }),
    useAssetsValue: () => ({ totalUsdValue: () => new BigNumber(0) }),
}));
vi.mock("@/components/ui/staking/native-staking", () => ({ NativeStakingCard: () => <div data-testid="native-staking" /> }));
vi.mock("@/components/ui/staking/rewards-staking", () => ({
    RewardsStakingBox: ({ stakingReward }: { stakingReward: StakingRewardSDKType }) => (
        <div data-testid="simple-reward">{TICKERS[stakingReward.staking_denom]}</div>
    ),
}));
vi.mock("@/components/ui/staking/denom-rewards-section", () => ({
    DenomRewardsSection: ({ searchTerm }: { searchTerm: string }) => <div data-testid="compounded-search">{searchTerm}</div>,
}));
vi.mock("@/components/ui/staking/rewards-staking-modals", () => ({ RewardsStakingActionModal: () => null }));

import StakingPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const searchBox = () => screen.getByRole("textbox", { name: "Search staking opportunities" });
const shownRewards = () => screen.getAllByTestId("simple-reward").map(el => el.textContent);

beforeEach(() => window.history.replaceState({}, "", "/staking"));
afterEach(() => window.history.replaceState({}, "", "/"));

describe("Staking page search", () => {
    it("lists every reward with an empty search when the URL has no ?search=", () => {
        render(<StakingPage />, { wrapper });
        expect(searchBox()).toHaveValue("");
        expect(shownRewards()).toEqual(["HONEY", "WAX"]);
    });

    it("fills the search box from ?search= and filters both reward lists", async () => {
        window.history.replaceState({}, "", "/staking?search=HONEY");
        render(<StakingPage />, { wrapper });

        await waitFor(() => expect(searchBox()).toHaveValue("HONEY"));
        expect(shownRewards()).toEqual(["HONEY"]);
        expect(screen.getByTestId("compounded-search")).toHaveTextContent("HONEY");
    });

    it("reads ?search= once: typing afterwards changes only the local search", async () => {
        window.history.replaceState({}, "", "/staking?search=HONEY");
        render(<StakingPage />, { wrapper });
        await waitFor(() => expect(searchBox()).toHaveValue("HONEY"));

        await userEvent.clear(searchBox());
        await userEvent.type(searchBox(), "wax");
        expect(shownRewards()).toEqual(["WAX"]);
        expect(window.location.search).toBe("?search=HONEY");
    });

    it("shows the Network staking box only while the search is empty", async () => {
        window.history.replaceState({}, "", "/staking?search=HONEY");
        render(<StakingPage />, { wrapper });
        await waitFor(() => expect(searchBox()).toHaveValue("HONEY"));
        expect(screen.queryByTestId("native-staking")).not.toBeInTheDocument();
        expect(screen.queryByText("Network staking")).not.toBeInTheDocument();

        await userEvent.clear(searchBox());
        expect(screen.getByTestId("native-staking")).toBeInTheDocument();
        expect(screen.getByText("Network staking")).toBeInTheDocument();

        await userEvent.type(searchBox(), "wax");
        expect(screen.queryByTestId("native-staking")).not.toBeInTheDocument();
    });
});
