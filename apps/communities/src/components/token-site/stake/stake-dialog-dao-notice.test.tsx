import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import {cleanup, render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {type Asset, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";

const T = "factory/bze1owner/upage";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

// Every data hook is faked; the DAO notice is the real one, fed by a stubbed fetch that stands in
// for BZE Scan behind the app's /api/scan proxy.
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAssetsContext: () => ({updateBalances: vi.fn()}),
    useAssets: () => ({denomTicker: () => "PAGE", denomDecimals: () => 6}),
    useBZETx: () => ({tx: vi.fn(), progressTrack: ""}),
    useMaxSpendable: () => ({amount: new BigNumber(5e8), balance: new BigNumber(5e8), inputValue: "500", isLoading: false}),
    useCanAffordTx: () => ({canAfford: true, message: "", isLoading: false, gasFee: {displayAmount: new BigNumber("0.02"), ticker: "BZE"}}),
}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: ME})}));

import {TokenSiteTheme} from "../kit";
import {StakeDialog, type StakeAction, type StakeTarget} from "./stake-dialog";

const ASSET: Asset = {type: "factory", denom: T, decimals: 6, name: "Page", ticker: "PAGE", logo: "", stable: false, verified: false, supply: 1n};

const program = (id: string): StakingRewardSDKType => ({
    reward_id: id, prize_amount: "500000000", prize_denom: "ubze", staking_denom: T, duration: 30, payouts: 7,
    min_stake: 50_000_000n, lock: 14, staked_amount: "6100000000000", distributed_stake: "0.5",
});
const stake = (id: string) => ({address: ME, reward_id: id, amount: "2000000000", joined_at: "0.25"});

// The shared reader keeps an answer a minute per source, so each test uses a program / denom of its own.
let counter = 0;
let scanDaos: unknown;
let scanProposals: unknown;
let sources: string[];
const realFetch = globalThis.fetch;

beforeEach(() => {
    scanDaos = {items: [], next_cursor: null};
    scanProposals = {items: [], next_cursor: null};
    sources = [];
    globalThis.fetch = (vi.fn(async (url: string) => {
        const u = new URL(url, "http://communities.test");
        if (u.searchParams.has("member")) return new Response("{}", {status: 400});
        if (u.pathname.endsWith("/daos")) {
            sources.push(u.searchParams.get("source") ?? "");
            return new Response(JSON.stringify(scanDaos), {status: 200});
        }
        return new Response(JSON.stringify(scanProposals), {status: 200});
    })) as unknown as typeof fetch;
});
afterEach(() => {
    cleanup();
    globalThis.fetch = realFetch;
});

const withOpenProposals = (n: number) => {
    scanDaos = {items: [{id: 3, name: "Club", type: "stake"}], next_cursor: null};
    scanProposals = {items: Array.from({length: n}, (_, i) => ({id: 10 + i, dao_id: 3, title: `P${i}`, status: "voting"})), next_cursor: null};
};

const open = (target: StakeTarget, action: StakeAction) =>
    render(<StakeDialog asset={ASSET} target={target} action={action} onClose={vi.fn()} onDone={vi.fn()}/>, {
        wrapper: ({children}: {children: ReactNode}) => (
            <ChakraProvider value={defaultSystem}><TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}>{children}</TokenSiteTheme></ChakraProvider>
        ),
    });

const fixedTerm = (withStake: boolean): StakeTarget => {
    const rewardId = `fx${++counter}`;
    const p = program(rewardId);
    return {kind: "sr", rewardId, item: {program: p, stake: withStake ? stake(rewardId) : undefined, unlocking: [], pending: new BigNumber(0)}};
};
const pool = (withStake: boolean): StakeTarget => {
    const stakingDenom = `factory/bze1owner/dao${++counter}`;
    return {
        kind: "dr", stakingDenom,
        item: {
            denomReward: {staking_denom: stakingDenom, lock: 7, min_stake: "100000000", staked_amount: "20000000000"},
            position: withStake ? {participant: {address: ME, staking_denom: stakingDenom, amount: "2000000000"}, pending: []} : undefined,
            unlocks: [],
        },
    };
};

describe("StakeDialog DAO notice", () => {
    it("warns a fixed-term program stake about the open proposals, and names the program's source", async () => {
        withOpenProposals(2);
        const target = fixedTerm(false);
        open(target, "stake");

        expect(await screen.findByTestId("dao-source-notice")).toHaveTextContent(
            "Stake you add now won't count on its 2 open proposals, and a top-up makes your whole stake here stop counting on them. Vote first, then add.",
        );
        expect(sources).toEqual([`sr/${(target as {rewardId: string}).rewardId}`]);
        // it never blocks the action: the stake button is still there
        expect(screen.getByRole("button", {name: "Stake"})).toBeInTheDocument();
    });

    it("warns a holders pool top-up, reading the pool's Denom Reward source", async () => {
        withOpenProposals(1);
        const target = pool(true);
        open(target, "stake");

        expect(await screen.findByTestId("dao-source-notice")).toHaveTextContent("its 1 open proposal,");
        expect(sources).toEqual([`dr/${(target as {stakingDenom: string}).stakingDenom}`]);
    });

    it("warns an unstake that it lowers the votes on the open proposals", async () => {
        withOpenProposals(2);
        open(fixedTerm(true), "unstake");

        expect(await screen.findByTestId("dao-source-notice")).toHaveTextContent(
            "Leaving now lowers your votes on 2 open proposals of DAO Club, and joining again won't bring them back.",
        );
    });

    it("shows one muted line when no proposal is open, and nothing on an unstake", async () => {
        scanDaos = {items: [{id: 3, name: "Club", type: "stake"}], next_cursor: null};
        open(pool(false), "stake");
        expect(await screen.findByTestId("dao-source-notice")).toHaveTextContent("This program's stake votes in DAO Club.");

        cleanup();
        open(pool(true), "unstake");
        await screen.findByRole("button", {name: "Unstake"});
        expect(screen.queryByTestId("dao-source-notice")).toBeNull();
    });

    it("shows no notice on a claim", async () => {
        withOpenProposals(2);
        open(fixedTerm(true), "claim");

        await screen.findByRole("button", {name: "Claim"});
        expect(screen.queryByTestId("dao-source-notice")).toBeNull();
    });
});
