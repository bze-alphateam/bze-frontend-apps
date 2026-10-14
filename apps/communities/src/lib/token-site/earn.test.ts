import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import type {DenomRewardSchedule} from "@bze/bze-ui-kit";

import {earnOpportunities, joinTickers, type PoolWithSchedules} from "./earn";

const T = "factory/bze1owner/upage";
const GUILD = "factory/bze1guild/uguild";
const VDL = "factory/bze1other/uvdl";
const decimals = () => 6;

// T pays 8,000 a day for 30 days (18 paid) to BZE stakers, 7-day unlock, 1M BZE staked.
const program = (id: string, extra: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType => ({
    reward_id: id,
    prize_amount: "8000000000",
    prize_denom: T,
    staking_denom: "ubze",
    duration: 30,
    payouts: 18,
    min_stake: 1_000_000n,
    lock: 7,
    staked_amount: "1000000000000",
    distributed_stake: "0",
    ...extra,
});

const schedule = (id: string, prize: string, daily: string, duration: number, payouts: number, staking = GUILD): DenomRewardSchedule => ({
    schedule_id: id, staking_denom: staking, prize_denom: prize, daily_amount: daily, duration, payouts,
});

// GUILD's pool: 2,000,000 GUILD staked, 5-day unlock.
const guildPool = (schedules: DenomRewardSchedule[]): PoolWithSchedules => ({
    denomReward: {staking_denom: GUILD, lock: 5, min_stake: "1", staked_amount: "2000000000000"},
    schedules,
});

const prices = (entries: [string, string][]) => new Map(entries.map(([denom, usd]) => [denom, new BigNumber(usd)]));

describe("earnOpportunities", () => {
    it("lists the running programs paying T and the other pools paying T, nothing else", () => {
        const list = earnOpportunities(
            T,
            [
                program("1"),
                program("2", {payouts: 30}), // finished
                program("3", {prize_denom: "ubze"}), // pays something else
                program("4", {staking_denom: T}), // staking T itself: the Stake section
            ],
            [
                guildPool([schedule("a", T, "1200000000", 60, 15), schedule("b", "ubze", "10", 10, 1), schedule("c", VDL, "10", 10, 1)]),
                {...guildPool([schedule("d", T, "5", 10, 1, T)]), denomReward: {staking_denom: T, lock: 1, min_stake: "1", staked_amount: "1"}},
                {...guildPool([schedule("e", "ubze", "5", 10, 1, VDL)]), denomReward: {staking_denom: VDL, lock: 1, min_stake: "1", staked_amount: "1"}},
            ],
            new Map(),
            decimals,
        );

        expect(list.map((item) => [item.kind, item.key])).toEqual([["program", "program-1"], ["pool", "pool-" + GUILD]]);
        expect(list[1]).toMatchObject({stakingDenom: GUILD, lock: 5, otherPrizes: ["ubze", VDL]});
        expect(list[0]).toMatchObject({stakingDenom: "ubze", rewardId: "1", lock: 7, daysLeft: 12, otherPrizes: []});
    });

    it("sums a pool's running schedules paying T and keeps its longest run", () => {
        const [pool] = earnOpportunities(T, [], [guildPool([
            schedule("a", T, "1000000000", 60, 15),
            schedule("b", T, "200000000", 20, 10),
            schedule("c", T, "999000000", 10, 10), // finished
        ])], new Map(), decimals);

        expect(pool.daily.toFixed()).toBe("1200");
        expect(pool.daysLeft).toBe(45);
    });

    it("leaves out a pool whose only schedule paying T is finished", () => {
        expect(earnOpportunities(T, [], [guildPool([schedule("a", T, "1", 10, 10), schedule("b", "ubze", "1", 10, 1)])], new Map(), decimals)).toEqual([]);
    });

    it("gives the APR in USD when every price is known, and hides it otherwise", () => {
        const pools = [guildPool([schedule("a", T, "1200000000", 60, 15), schedule("b", "ubze", "1000000000", 60, 15)])];
        const all = prices([[T, "0.05"], ["ubze", "0.01"], [GUILD, "0.02"]]);

        const [sr, dr] = earnOpportunities(T, [program("1")], pools, all, decimals);
        // 8,000 × $0.05 × 365 ÷ (1M × $0.01) × 100.
        expect(sr.apr?.toFixed(1)).toBe("1460.0");
        // (1,200 × $0.05 + 1,000 × $0.01) × 365 ÷ (2M × $0.02) × 100: over the pool's whole prize set.
        expect(dr.apr?.toFixed(3)).toBe("63.875");

        // Without BZE's price neither APR can be told: BZE is the program's stake and one of the pool's prizes.
        const noBze = earnOpportunities(T, [program("1")], pools, prices([[T, "0.05"], [GUILD, "0.02"]]), decimals);
        expect(noBze.map((item) => item.apr)).toEqual([undefined, undefined]);
    });

    it("sorts by APR, the ones without last, then by T paid per day", () => {
        const list = earnOpportunities(
            T,
            [
                program("low", {staked_amount: "4000000000000"}),
                program("high"),
                program("bigNoApr", {staking_denom: VDL, prize_amount: "9000000000"}),
                program("smallNoApr", {staking_denom: VDL, prize_amount: "1000000"}),
            ],
            [],
            prices([[T, "0.05"], ["ubze", "0.01"]]),
            decimals,
        );

        expect(list.map((item) => item.rewardId)).toEqual(["high", "low", "bigNoApr", "smallNoApr"]);
    });
});

describe("joinTickers", () => {
    it("reads like a sentence", () => {
        expect(joinTickers([])).toBe("");
        expect(joinTickers(["BZE"])).toBe("BZE");
        expect(joinTickers(["GUILD", "BZE"])).toBe("GUILD and BZE");
        expect(joinTickers(["GUILD", "BZE", "VDL"])).toBe("GUILD, BZE and VDL");
    });
});
