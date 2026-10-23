import { describe, it, expect } from "vitest";
import { estimateStakeDailyRewards } from "./stake-estimate";

describe("estimateStakeDailyRewards", () => {
    it("keeps a sole staker at the full daily prize and shows no gain", () => {
        // 2215 already locked, nobody else staked, locking 1000 more.
        const est = estimateStakeDailyRewards(100, 2215, 2215, 1000)!;

        expect(est.daily.toNumber()).toBe(100);
        expect(est.current.toNumber()).toBe(100);
        expect(est.gain.toNumber()).toBe(0);
    });

    it("counts only the other stakers as competition", () => {
        // 1000 of 3000 is ours, locking 1000 more: 2000 / 4000 of the prize.
        const est = estimateStakeDailyRewards(100, 3000, 1000, 1000)!;

        expect(est.daily.toNumber()).toBe(50);
        expect(est.current.toNumber()).toBeCloseTo(33.3333, 4);
        expect(est.gain.toNumber()).toBeCloseTo(16.6667, 4);
    });

    it("gives a new staker their share of the total after the stake", () => {
        const est = estimateStakeDailyRewards(100, 2215, 0, 1000)!;

        expect(est.daily.toNumber()).toBeCloseTo(31.1042, 4);
        expect(est.current.toNumber()).toBe(0);
        expect(est.gain.toNumber()).toBe(est.daily.toNumber());
    });

    it("gives the first staker the whole prize", () => {
        const est = estimateStakeDailyRewards(100, 0, 0, 5)!;

        expect(est.daily.toNumber()).toBe(100);
        expect(est.gain.toNumber()).toBe(100);
    });

    it("never counts more than the total as the user's stake", () => {
        const est = estimateStakeDailyRewards(100, 1000, 5000, 1000)!;

        expect(est.daily.toNumber()).toBe(100);
        expect(est.gain.toNumber()).toBe(0);
    });

    it("returns null when nothing is added", () => {
        expect(estimateStakeDailyRewards(100, 2215, 2215, 0)).toBeNull();
        expect(estimateStakeDailyRewards(100, 2215, 2215, "abc")).toBeNull();
    });
});
