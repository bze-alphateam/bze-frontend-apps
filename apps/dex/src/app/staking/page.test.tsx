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
// no chain). The tables are stubbed to show the names of the rows they were handed; the toolbar is real.
vi.mock("@/hooks/useNativeStakingData", () => ({
    useNativeStakingData: () => ({
        stakingData: {
            averageApr: "10", unlockDuration: "21",
            totalStaked: { denom: "ubze", amount: new BigNumber(1) }, minAmount: { denom: "ubze", amount: new BigNumber(0) },
            averageDailyDistribution: { denom: "ubze", amount: new BigNumber(1) },
        },
        isLoading: false,
        reload: vi.fn(),
    }),
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
    useAssetsValue: () => ({ denomUsdValue: () => new BigNumber(0) }),
}));
vi.mock("@/components/ui/staking/staking-table", async (importActual) => ({
    ...await importActual<typeof import("@/components/ui/staking/staking-table")>(),
    PositionsCard: () => <div data-testid="positions"/>,
    ExploreTable: ({ page }: { page: { items: { name: string }[] } }) => (
        <div>{page.items.map((r) => <div key={r.name} data-testid="reward-row">{r.name}</div>)}</div>
    ),
}));

import StakingPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const searchBox = () => screen.getByRole("textbox", { name: "Search rewards" });
const shownRewards = () => screen.queryAllByTestId("reward-row").map(el => el.textContent);

beforeEach(() => window.history.replaceState({}, "", "/staking"));
afterEach(() => window.history.replaceState({}, "", "/"));

describe("Staking page search", () => {
    it("lists every reward with an empty search when the URL has no ?search=", () => {
        render(<StakingPage />, { wrapper });
        expect(searchBox()).toHaveValue("");
        expect(shownRewards()).toEqual(["BZE Native Staking", "HONEY #1", "WAX #2"]);
    });

    it("fills the search box from ?search= and filters the list", async () => {
        window.history.replaceState({}, "", "/staking?search=HONEY");
        render(<StakingPage />, { wrapper });

        await waitFor(() => expect(searchBox()).toHaveValue("HONEY"));
        expect(shownRewards()).toEqual(["HONEY #1"]);
    });

    it("reads ?search= once: typing afterwards changes only the local search", async () => {
        window.history.replaceState({}, "", "/staking?search=HONEY");
        render(<StakingPage />, { wrapper });
        await waitFor(() => expect(searchBox()).toHaveValue("HONEY"));

        await userEvent.clear(searchBox());
        await userEvent.type(searchBox(), "wax");
        expect(shownRewards()).toEqual(["WAX #2"]);
        expect(window.location.search).toBe("?search=HONEY");
    });

    it("shows native staking only while the search is empty", async () => {
        window.history.replaceState({}, "", "/staking?search=HONEY");
        render(<StakingPage />, { wrapper });
        await waitFor(() => expect(searchBox()).toHaveValue("HONEY"));
        expect(shownRewards()).not.toContain("BZE Native Staking");

        await userEvent.clear(searchBox());
        expect(shownRewards()).toContain("BZE Native Staking");

        await userEvent.type(searchBox(), "wax");
        expect(shownRewards()).toEqual(["WAX #2"]);
    });

    it("filters by kind with the chips and goes back to every reward on All", async () => {
        render(<StakingPage />, { wrapper });

        await userEvent.click(screen.getByRole("button", { name: "Compounded" }));
        expect(shownRewards()).toEqual([]);
        await userEvent.click(screen.getByRole("button", { name: "All" }));
        expect(shownRewards()).toHaveLength(3);
    });
});
