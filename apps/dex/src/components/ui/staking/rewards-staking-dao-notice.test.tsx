import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { StakingRewardParticipantSDKType, StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import { createHiveGlowSystem } from "@bze/bze-ui-kit";
import { RewardsStakingActionModal } from "@/components/ui/staking/rewards-staking-modals";

// The dialog's data hooks are faked; the DAO notice is the real one, fed by a stubbed fetch that
// stands in for BZE Scan behind the app's /api/scan proxy.
const ASSETS: Record<string, { ticker: string; decimals: number }> = { ubze: { ticker: "BZE", decimals: 6 }, uprize: { ticker: "PRIZE", decimals: 6 } };
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1test" }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useAsset: (denom: string) => ({ asset: ASSETS[denom] && { denom, ...ASSETS[denom] }, isLoading: false }),
    useAssets: () => ({ denomTicker: (d: string) => ASSETS[d]?.ticker ?? d, isLoading: false }),
    useAssetPrice: () => ({ price: new BigNumber(0) }),
    useBalance: () => ({ balance: { denom: "ubze", amount: new BigNumber(50_000_000) } }),
    useBZETx: () => ({ tx: vi.fn(), progressTrack: "" }),
    useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
    useMaxSpendable: () => ({ amount: new BigNumber(50_000_000), balance: new BigNumber(50_000_000), inputValue: "50", isLoading: false }),
    useCanAffordTx: () => ({ canAfford: true, message: "", isLoading: false }),
}));

// The shared reader keeps an answer a minute per source, so each test uses a reward of its own.
let rewardId = 0;
const rewardOf = (id: string) => ({
    reward_id: id, staking_denom: "ubze", prize_denom: "uprize", prize_amount: "1000000", staked_amount: "100000000",
    min_stake: "1000000", lock: 7, duration: 30, payouts: 1, distributed_stake: "0",
}) as unknown as StakingRewardSDKType;
const STAKE = { address: "bze1test", reward_id: "7", amount: "20000000", joined_at: "0.1" } as unknown as StakingRewardParticipantSDKType;

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={createHiveGlowSystem("dex")}>{children}</ChakraProvider>;

const NOTICE = "dao-source-notice";
let scan: { daos: unknown; proposals: unknown; probe: number; sources: string[]; proposalCalls: number };

// Lets every pending Scan answer land and render, so an absent notice means it was really decided.
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

let reward: StakingRewardSDKType;
const realFetch = globalThis.fetch;

beforeEach(() => {
    reward = rewardOf(String(++rewardId));
    scan = { daos: { items: [], next_cursor: null }, proposals: { items: [], next_cursor: null }, probe: 400, sources: [], proposalCalls: 0 };
    globalThis.fetch = (vi.fn(async (url: string) => {
        const u = new URL(url, "http://dex.test");
        if (u.searchParams.has("member")) return new Response("{}", { status: scan.probe });
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

const open = (view: "stake" | "unstake", userStake?: StakingRewardParticipantSDKType) =>
    render(<RewardsStakingActionModal onClose={vi.fn()} stakingReward={reward} userStake={userStake} initialView={view} />, { wrapper });

const withOpenProposals = (n: number) => {
    scan.daos = { items: [{ id: 3, name: "Club", type: "stake" }], next_cursor: null };
    scan.proposals = { items: Array.from({ length: n }, (_, i) => ({ id: 10 + i, dao_id: 3, title: `P${i}`, status: "voting" })), next_cursor: null };
};

describe("RewardsStakingActionModal DAO notice", () => {
    it("warns a first join about the open proposals of a DAO that uses the program", async () => {
        withOpenProposals(2);
        open("stake");

        expect(await screen.findByTestId(NOTICE)).toHaveTextContent(
            "This program's stake votes in DAO Club. Stake you add now won't count on its 2 open proposals, and a top-up makes your whole stake here stop counting on them. Vote first, then add.",
        );
        expect(scan.sources).toEqual([`sr/${reward.reward_id}`]);
        // it never blocks the action
        expect(screen.getByRole("button", { name: /Confirm Stake/ })).toBeInTheDocument();
    });

    it("warns a top-up the same way", async () => {
        withOpenProposals(1);
        open("stake", STAKE);

        expect(await screen.findByTestId(NOTICE)).toHaveTextContent("won't count on its 1 open proposal,");
    });

    it("shows one muted line when no proposal is open", async () => {
        scan.daos = { items: [{ id: 3, name: "Club", type: "stake" }], next_cursor: null };
        open("stake");

        const line = await screen.findByTestId(NOTICE);
        expect(line).toHaveTextContent("This program's stake votes in DAO Club.");
        expect(line).toHaveAttribute("data-tone", "muted");
    });

    it("warns an exit that it lowers the votes on the open proposals", async () => {
        withOpenProposals(2);
        open("unstake", STAKE);

        expect(await screen.findByTestId(NOTICE)).toHaveTextContent(
            "Leaving now lowers your votes on 2 open proposals of DAO Club, and joining again won't bring them back.",
        );
    });

    it("says nothing on exit when no proposal is open", async () => {
        scan.daos = { items: [{ id: 3, name: "Club", type: "stake" }], next_cursor: null };
        open("unstake", STAKE);

        // the DAO is known and its open proposals were asked for: only then is "none open" a real answer
        await waitFor(() => expect(scan.proposalCalls).toBe(1));
        await settle();
        expect(screen.getByText("Confirm Unstake")).toBeInTheDocument();
        expect(screen.queryByTestId(NOTICE)).toBeNull();
    });

    it("says nothing when no DAO uses the program", async () => {
        open("stake");

        await waitFor(() => expect(scan.sources).toEqual([`sr/${reward.reward_id}`]));
        await settle();
        expect(screen.getByRole("button", { name: /Confirm Stake/ })).toBeInTheDocument();
        expect(screen.queryByTestId(NOTICE)).toBeNull();
        expect(scan.proposalCalls).toBe(0);
    });
});
