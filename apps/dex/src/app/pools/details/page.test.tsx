import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import { createHiveGlowSystem } from "@bze/bze-ui-kit";

// The page's data hooks are faked; the DAO notice is the real one, fed by a stubbed fetch that
// stands in for BZE Scan behind the app's /api/scan proxy.
const LP = "factory/bze1pool/lp1";
const ASSETS: Record<string, { ticker: string; decimals: number }> = {
    ubze: { ticker: "BZE", decimals: 6 }, uusdc: { ticker: "USDC", decimals: 6 }, [LP]: { ticker: "LP", decimals: 6 },
};

let rewardsMap: Map<string, StakingRewardSDKType>;
let addressData: { active: Map<string, unknown>; unlocking: Map<string, unknown[]> } | undefined;

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1test" }) }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigationWithParams: () => ({ toPoolsPage: vi.fn(), idParam: "1" }) }));
vi.mock("@/hooks/useRewardsStakingData", () => ({
    useRewardsStakingData: () => ({ rewardsMap, addressData, reload: vi.fn() }),
}));
vi.mock("@/hooks/useLockedLiquidity", () => ({
    useLockedLiquidity: () => ({ lockedForeverAmount: "0", lockedForeverUsdValue: null, isLoading: false }),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useLiquidityPool: () => ({
        pool: { id: "1", base: "ubze", quote: "uusdc", lp_denom: LP, fee: "0.003", fee_dest: {}, reserve_base: "1000000", reserve_quote: "1000000" },
        poolData: undefined,
        userShares: new BigNumber(50_000_000),
        userSharesPercentage: "1",
        userReserveBase: new BigNumber(1),
        userReserveQuote: new BigNumber(1),
        calculateOppositeAmount: vi.fn(),
        calculateSharesFromAmounts: vi.fn(),
    }),
    useAsset: (denom: string) => ({ asset: ASSETS[denom] && { denom, ...ASSETS[denom] }, isLoading: false }),
    useAssets: () => ({ denomTicker: (d: string) => ASSETS[d]?.ticker ?? d, denomDecimals: () => 6, isLoading: false }),
    useAssetPrice: () => ({ price: new BigNumber(0), isUSDC: false, totalUsdValue: () => new BigNumber(0), isLoading: false }),
    useAssetsValue: () => ({ totalUsdValue: () => new BigNumber(0) }),
    useHaltedDenoms: () => ({ isDenomHalted: () => false, isPoolHalted: () => false }),
    useBalance: () => ({ balance: { denom: "ubze", amount: new BigNumber(0) } }),
    useBZETx: () => ({ tx: vi.fn(), progressTrack: "" }),
    useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
    useMaxSpendable: () => ({ amount: new BigNumber(0), balance: new BigNumber(0), inputValue: "0", isLoading: false }),
    useCanAffordTx: () => ({ canAfford: true, message: "", isLoading: false }),
}));

import PoolDetailsPage from "./page";

const reward = (id: string): StakingRewardSDKType => ({
    reward_id: id, staking_denom: LP, prize_denom: "ubze", prize_amount: "1000000", staked_amount: "100000000",
    min_stake: "1000000", lock: 7, duration: 30, payouts: 1, distributed_stake: "0",
}) as unknown as StakingRewardSDKType;

const NOTICE = "dao-source-notice";
// The shared reader keeps an answer a minute per source, so each test uses a reward of its own.
let counter = 100;
let rewardId: string;
let scan: { daos: unknown; proposals: unknown; sources: string[]; proposalCalls: number };
const realFetch = globalThis.fetch;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

beforeEach(() => {
    rewardId = String(++counter);
    rewardsMap = new Map([[rewardId, reward(rewardId)]]);
    addressData = undefined;
    scan = { daos: { items: [], next_cursor: null }, proposals: { items: [], next_cursor: null }, sources: [], proposalCalls: 0 };
    globalThis.fetch = (vi.fn(async (url: string) => {
        const u = new URL(url, "http://dex.test");
        if (u.searchParams.has("member")) return new Response("{}", { status: 400 });
        if (u.pathname.endsWith("/daos")) {
            scan.sources.push(u.searchParams.get("source") ?? "");
            return new Response(JSON.stringify(scan.daos), { status: 200 });
        }
        scan.proposalCalls++;
        return new Response(JSON.stringify(scan.proposals), { status: 200 });
    })) as unknown as typeof fetch;
});
afterEach(() => {
    cleanup();
    globalThis.fetch = realFetch;
});

const withOpenProposals = (n: number) => {
    scan.daos = { items: [{ id: 3, name: "Club", type: "stake" }], next_cursor: null };
    scan.proposals = { items: Array.from({ length: n }, (_, i) => ({ id: 10 + i, dao_id: 3, title: `P${i}`, status: "voting" })), next_cursor: null };
};
const lockedStake = () => {
    addressData = {
        active: new Map([[rewardId, { address: "bze1test", reward_id: rewardId, amount: "20000000", joined_at: "0.1" }]]),
        unlocking: new Map(),
    };
};
const renderPage = () => render(<PoolDetailsPage />, { wrapper: ({ children }) => <ChakraProvider value={createHiveGlowSystem("dex")}>{children}</ChakraProvider> });
const openBoostTab = () => fireEvent.click(screen.getByRole("tab", { name: /Boost/ }));

describe("Pool details page DAO notice", () => {
    it("warns when you pick a simple reward to lock LP shares in that a DAO uses", async () => {
        withOpenProposals(2);
        renderPage();
        openBoostTab();
        expect(screen.queryByTestId(NOTICE)).toBeNull();

        fireEvent.click(await screen.findByRole("radio", { name: new RegExp(`Reward #${rewardId}`) }));

        expect(await screen.findByTestId(NOTICE)).toHaveTextContent("Stake you add now won't count on its 2 open proposals");
        expect(scan.sources).toEqual([`sr/${rewardId}`]);
    });

    it("says nothing about a reward no DAO uses", async () => {
        renderPage();
        openBoostTab();
        fireEvent.click(await screen.findByRole("radio", { name: new RegExp(`Reward #${rewardId}`) }));

        await waitFor(() => expect(scan.sources).toEqual([`sr/${rewardId}`]));
        await settle();
        expect(screen.queryByTestId(NOTICE)).toBeNull();
    });

    it("warns on the Unlock of a locked position that it lowers the votes on the open proposals", async () => {
        withOpenProposals(1);
        lockedStake();
        renderPage();

        expect(await screen.findByTestId(NOTICE)).toHaveTextContent(
            "Leaving now lowers your votes on 1 open proposal of DAO Club, and joining again won't bring them back.",
        );
        expect(screen.getByRole("button", { name: "Unlock" })).toBeEnabled();
    });

    it("says nothing on the Unlock when no proposal is open", async () => {
        scan.daos = { items: [{ id: 3, name: "Club", type: "stake" }], next_cursor: null };
        lockedStake();
        renderPage();

        await waitFor(() => expect(scan.proposalCalls).toBe(1));
        await settle();
        expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
        expect(screen.queryByTestId(NOTICE)).toBeNull();
    });
});
