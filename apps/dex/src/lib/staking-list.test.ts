import { describe, expect, it } from "vitest";
import BigNumber from "bignumber.js";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import type { AddressRewardsStaking, DenomRewardHolderItem, NativeStakingData } from "@bze/bze-ui-kit";
import {
    buildStakingRows,
    DEFAULT_STAKING_FILTERS,
    filterStakingRows,
    pageButtons,
    paginate,
    positionRows,
    sortStakingRows,
    type StakingLookups,
    type StakingRow,
} from "./staking-list";

const TICKERS: Record<string, string> = { ubze: "BZE", uvdl: "VDL", uatom: "ATOM", ulp: "BZE/USDC LP", uscam: "SCAM" };
const PRICES: Record<string, number> = { ubze: 0.05, uvdl: 0.01, ulp: 2 };

const lookups: StakingLookups = {
    ticker: (d) => TICKERS[d] ?? d,
    verified: (d) => d !== "uscam",
    isLp: (d) => d === "ulp",
    usdValue: (d, u) => new BigNumber(u).shiftedBy(-6).multipliedBy(PRICES[d] ?? 0),
};

const bze = (n: number) => ({ denom: "ubze", amount: new BigNumber(n).shiftedBy(6) });

function native(staked: number, pending: number): NativeStakingData {
    return {
        averageApr: "12.5",
        unlockDuration: "21",
        totalStaked: bze(1_000_000),
        minAmount: bze(0),
        averageDailyDistribution: bze(1_000),
        currentStaking: {
            staked: bze(staked),
            unbonding: { total: bze(0), firstUnlock: {} },
            pendingRewards: { total: bze(pending), validators: ["bzevaloper1a", "bzevaloper1b"] },
        },
    };
}

function simple(id: string, over: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType {
    return {
        reward_id: id, prize_amount: "1000000", prize_denom: "ubze", duration: 100, payouts: 10, lock: 7,
        staked_amount: "365000000", distributed_stake: "0", staking_denom: "ubze", min_stake: "1000000",
        ...over,
    } as StakingRewardSDKType;
}

function compounded(denom: string, daily?: { denom: string; amount: string }[], over: Partial<DenomRewardHolderItem> = {}): DenomRewardHolderItem {
    return {
        denomReward: { staking_denom: denom, staked_amount: "1000000000", lock: 0, min_stake: "100000000" } as DenomRewardHolderItem["denomReward"],
        dailyPrizes: daily,
        unlocks: [],
        ...over,
    };
}

const noAddress: AddressRewardsStaking = { address: "", active: new Map(), unlocking: new Map() };

const byId = (rows: StakingRow[], id: string) => rows.find((r) => r.id === id)!;

describe("buildStakingRows", () => {
    it("names each kind and works out the APR from the pool, in USD when the denoms differ", () => {
        const rows = buildStakingRows({
            native: native(0, 0),
            nativeDenom: "ubze",
            simple: [simple("0014"), simple("0015", { prize_denom: "uvdl", prize_amount: "36500000000", staked_amount: "1000000000" })],
            addressData: noAddress,
            compounded: [compounded("ubze", [{ denom: "uvdl", amount: "1000000" }])],
        }, lookups);

        expect(byId(rows, "native")).toMatchObject({ name: "BZE Native Staking", kind: "native", apr: 12.5, lockDays: 21, minStake: "0" });
        // 1 BZE a day on 365 BZE staked = 100 %
        expect(byId(rows, "simple:0014")).toMatchObject({ name: "BZE #14", apr: 100, status: "running", progress: { done: 10, duration: 100 } });
        // 36,500 VDL ($365) a day on 1,000 BZE ($50)
        expect(byId(rows, "simple:0015").apr).toBeCloseTo(266_450);
        expect(byId(rows, "compounded:ubze")).toMatchObject({ name: "BZE", kind: "compounded", status: "paying", earn: ["uvdl"] });
    });

    it("leaves the APR out when a prize has no price or the pool is empty", () => {
        const rows = buildStakingRows({
            nativeDenom: "ubze",
            simple: [simple("1", { prize_denom: "uatom" }), simple("2", { staked_amount: "0" })],
            compounded: [compounded("ubze", [{ denom: "uvdl", amount: "1" }, { denom: "uatom", amount: "1" }])],
        }, lookups);

        expect(byId(rows, "simple:1").apr).toBeUndefined();
        expect(byId(rows, "simple:2")).toMatchObject({ apr: undefined, status: "waiting" });
        expect(byId(rows, "compounded:ubze").apr).toBeUndefined();
    });

    it("gives a native position a claim only above the minimum, and estimates its daily share", () => {
        const small = byId(buildStakingRows({ native: native(10_000, 0.05), nativeDenom: "ubze", simple: [], compounded: [] }, lookups), "native");
        expect(small.position).toMatchObject({ stake: "10000000000", sharePct: 1, claimable: false });
        expect(small.position?.daily).toEqual([{ denom: "ubze", amount: "10000000" }]);

        const big = byId(buildStakingRows({ native: native(10_000, 3), nativeDenom: "ubze", simple: [], compounded: [] }, lookups), "native");
        expect(big.position?.claimable).toBe(true);
        expect(big.position?.pending).toEqual([{ denom: "ubze", amount: "3000000" }]);
    });

    it("reads a simple position's pending, share and unlocks from the address data", () => {
        const addressData: AddressRewardsStaking = {
            address: "bze1",
            active: new Map([["0014", { address: "bze1", reward_id: "0014", amount: "36500000", joined_at: "0" }]]),
            unlocking: new Map([["0014", [{ index: "1", reward_id: "0014", amount: "5000000", unlockEpoch: new BigNumber(500), rewardId: "0014" }]]]),
        } as unknown as AddressRewardsStaking;
        const row = byId(buildStakingRows({ nativeDenom: "ubze", simple: [simple("0014", { distributed_stake: "0.5" })], addressData, compounded: [] }, lookups), "simple:0014");

        expect(row.position).toMatchObject({ stake: "36500000", sharePct: 10, claimable: true });
        expect(row.position?.pending).toEqual([{ denom: "ubze", amount: "18250000" }]);
        expect(row.position?.daily).toEqual([{ denom: "ubze", amount: "100000" }]);
        expect(row.position?.unlocks).toEqual([{ amount: "5000000", unlockEpoch: 500 }]);
    });

    it("keeps only the compounded prizes worth claiming", () => {
        const item = compounded("ubze", [{ denom: "uvdl", amount: "1000" }], {
            position: {
                participant: { amount: "500000000" },
                pending: [{ denom: "uvdl", amount: "40" }, { denom: "uatom", amount: "0" }],
            } as unknown as DenomRewardHolderItem["position"],
        });
        const row = byId(buildStakingRows({ nativeDenom: "ubze", simple: [], compounded: [item] }, lookups), "compounded:ubze");

        expect(row.position).toMatchObject({ sharePct: 50, claimable: true, pending: [{ denom: "uvdl", amount: "40" }], daily: [{ denom: "uvdl", amount: "500" }] });
    });
});

describe("sortStakingRows", () => {
    it("puts native first, then verified by APR, then verified without one, then the rest", () => {
        const rows = buildStakingRows({
            native: native(0, 0),
            nativeDenom: "ubze",
            simple: [
                simple("1", { staking_denom: "uscam", prize_denom: "uscam" }),
                simple("2", { prize_denom: "uatom" }),
                simple("3", { prize_amount: "500000" }),
                simple("4"),
            ],
            compounded: [],
        }, lookups);

        expect(rows.map((r) => r.id)).toEqual(["native", "simple:4", "simple:3", "simple:2", "simple:1"]);
        expect(sortStakingRows([...rows].reverse()).map((r) => r.id)).toEqual(rows.map((r) => r.id));
    });
});

describe("filterStakingRows", () => {
    const rows = buildStakingRows({
        native: native(0, 0),
        nativeDenom: "ubze",
        simple: [
            simple("1", { payouts: 100 }),
            simple("2", { staking_denom: "uscam" }),
            simple("3", { staking_denom: "ulp", prize_denom: "uvdl" }),
        ],
        compounded: [compounded("uatom", [{ denom: "uvdl", amount: "1" }])],
    }, lookups);
    const ids = (f: Partial<typeof DEFAULT_STAKING_FILTERS>) =>
        filterStakingRows(rows, { ...DEFAULT_STAKING_FILTERS, ...f }).map((r) => r.id).sort();

    it("hides finished and unverified rewards by default", () => {
        expect(ids({})).toEqual(["compounded:uatom", "native", "simple:3"]);
        expect(ids({ showFinished: true, verifiedOnly: false })).toHaveLength(5);
    });

    it("filters by kind, LP staking tokens and the search over every ticker", () => {
        expect(ids({ kind: "simple" })).toEqual(["simple:3"]);
        expect(ids({ kind: "compounded" })).toEqual(["compounded:uatom"]);
        expect(ids({ kind: "lp" })).toEqual(["simple:3"]);
        expect(ids({ search: "vdl" })).toEqual(["compounded:uatom", "simple:3"]);
        expect(ids({ search: " VDL " })).toEqual(["compounded:uatom", "simple:3"]);
    });

    it("hides native staking while a search is active", () => {
        expect(ids({ search: "bze" })).not.toContain("native");
        expect(ids({ search: "  " })).toContain("native");
    });

    it("lists the viewer's positions apart", () => {
        expect(positionRows(rows)).toEqual([]);
    });
});

describe("paginate", () => {
    const items = Array.from({ length: 60 }, (_, i) => i);

    it("slices pages of 25 and clamps the page", () => {
        expect(paginate(items, 1)).toMatchObject({ page: 1, pageCount: 3, from: 1, to: 25, total: 60 });
        expect(paginate(items, 3).items).toEqual(items.slice(50));
        expect(paginate(items, 9).page).toBe(3);
        expect(paginate([], 4)).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0 });
    });
});

describe("pageButtons", () => {
    it("shows every page up to seven, otherwise the ends and the neighbours with gaps", () => {
        expect(pageButtons(1, 5)).toEqual([1, 2, 3, 4, 5]);
        expect(pageButtons(1, 42)).toEqual([1, 2, 3, 4, "…", 42]);
        expect(pageButtons(5, 42)).toEqual([1, "…", 4, 5, 6, "…", 42]);
        expect(pageButtons(42, 42)).toEqual([1, "…", 39, 40, 41, 42]);
    });
});
