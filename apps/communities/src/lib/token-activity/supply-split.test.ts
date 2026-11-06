import {describe, expect, it} from "vitest";

import {formatShare, type SplitHolder, supplySplit, topWallets} from "./supply-split";

const moduleHolder = (address: string, balance: string): SplitHolder => ({address, balance, label: {kind: "module"}});
const wallet = (address: string, balance: string): SplitHolder => ({address, balance, label: null});

// NOAD on testnet (2026-11-05), base units with 6 decimals.
const NOAD_HOLDERS: SplitHolder[] = [
    wallet("creator", "965105382489"),
    wallet("w2", "17000000000"),
    wallet("w3", "9995000000"),
    moduleHolder("rewards", "7056000000"),
    moduleHolder("dex", "964433611"),
    wallet("w6", "614317350"),
    wallet("w7", "130856550"),
    moduleHolder("burner", "14010000"),
];

const amounts = (parts: ReturnType<typeof supplySplit>) => Object.fromEntries(parts.map((part) => [part.key, part.amount.toFixed()]));

describe("supplySplit", () => {
    it("splits NOAD's supply the way the canvas draws it", () => {
        const parts = supplySplit({
            supply: "1000880000000",
            holdersPoolStaked: "20000000",
            programsStaked: ["5000000"],
            rewardsModuleBalance: "7056000000",
            dexModuleBalance: "964433611",
            holders: NOAD_HOLDERS,
        });

        expect(parts.map((part) => part.label)).toEqual(["Staked", "Reward budgets", "On the DEX", "Top 10", "Rest"]);
        expect(amounts(parts)).toEqual({
            staked: "25000000",
            budgets: "7031000000",
            dex: "964433611",
            top10: "992845556389",
            rest: "14010000",
        });
        expect(parts.find((part) => part.key === "top10")?.share).toBeCloseTo(99.1973, 3);
    });

    it("adds every program staking T to the holders pool", () => {
        const [staked] = supplySplit({
            supply: 1000,
            holdersPoolStaked: 10,
            programsStaked: [5, "7", 0],
            rewardsModuleBalance: 100,
            dexModuleBalance: 0,
            holders: [],
        });

        expect(staked.amount.toFixed()).toBe("22");
    });

    it("clamps the reward budgets and the rest at 0", () => {
        const parts = supplySplit({
            supply: 100,
            holdersPoolStaked: 50,
            programsStaked: [],
            rewardsModuleBalance: 30,
            dexModuleBalance: 20,
            holders: [wallet("a", "90")],
        });

        expect(amounts(parts)).toMatchObject({budgets: "0", rest: "0"});
    });

    it("reads a missing or broken amount as 0", () => {
        const parts = supplySplit({
            supply: "",
            holdersPoolStaked: "nope",
            programsStaked: ["-5"],
            rewardsModuleBalance: "",
            dexModuleBalance: "",
            holders: [],
        });

        expect(parts.every((part) => part.amount.isZero() && part.share === 0)).toBe(true);
    });
});

describe("topWallets", () => {
    it("keeps the ten biggest wallets and leaves modules and IBC escrows out", () => {
        const holders = [
            moduleHolder("rewards", "900"),
            {address: "escrow", balance: "800", label: {kind: "ibc_escrow"}},
            ...Array.from({length: 12}, (_, i) => wallet(`w${i}`, String(100 - i))),
        ];

        const top = topWallets(holders);

        expect(top).toHaveLength(10);
        expect(top.map((holder) => holder.address)).toEqual(Array.from({length: 10}, (_, i) => `w${i}`));
    });

    it("keeps labelled wallets that are no module", () => {
        expect(topWallets([{address: "named", balance: "1", label: {kind: "known"}}])).toHaveLength(1);
    });
});

describe("formatShare", () => {
    it.each([
        [99.19733, "99.20 %"],
        [0.70498, "0.70 %"],
        [0.0014, "< 0.01 %"],
        [0, "0 %"],
        [Number.NaN, "0 %"],
    ])("writes %s as %s", (percent, text) => {
        expect(formatShare(percent)).toBe(text);
    });
});
