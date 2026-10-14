import {describe, expect, it, vi} from "vitest";
import type {DenomReward} from "@bze/bze-ui-kit";

import {type EarnQueries, loadEarnSources} from "./useEarnOpportunities";

const T = "factory/bze1owner/upage";
const GUILD = "factory/bze1guild/uguild";
const VDL = "factory/bze1other/uvdl";

const pool = (staking_denom: string): DenomReward => ({staking_denom, lock: 1, min_stake: "1", staked_amount: "1"});
const schedule = (staking_denom: string) => ({
    schedule_id: "1", staking_denom, prize_denom: T, daily_amount: "1", duration: 10, payouts: 1,
});

const queries = (extra: Partial<EarnQueries> = {}): EarnQueries => ({
    getStakingRewards: vi.fn(async () => []),
    getAllDenomRewards: vi.fn(async () => [pool(T), pool(GUILD), pool(VDL)]),
    getDenomRewardSchedules: vi.fn(async (denom: string) => [schedule(denom)]),
    ...extra,
});

describe("loadEarnSources", () => {
    it("reads the schedules of every other token's pool, never T's own", async () => {
        const q = queries();

        const {pools} = await loadEarnSources(T, q);

        expect(vi.mocked(q.getDenomRewardSchedules).mock.calls.map(([denom]) => denom)).toEqual([GUILD, VDL]);
        expect(pools.map((p) => p.denomReward.staking_denom)).toEqual([GUILD, VDL]);
        expect(pools[0].schedules).toEqual([schedule(GUILD)]);
    });

    it("drops only the pool whose schedules failed", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const q = queries({
            getDenomRewardSchedules: async (denom: string) => {
                if (denom === GUILD) throw new Error("node down");
                return [schedule(denom)];
            },
        });

        const {pools} = await loadEarnSources(T, q);

        expect(pools.map((p) => p.denomReward.staking_denom)).toEqual([VDL]);
    });

    it("keeps the programs when the pools can't be read, and the other way round", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fail = async () => {
            throw new Error("node down");
        };

        const noPools = await loadEarnSources(T, queries({getAllDenomRewards: fail}));
        expect(noPools.pools).toEqual([]);

        const noPrograms = await loadEarnSources(T, queries({getStakingRewards: fail}));
        expect(noPrograms.programs).toEqual([]);
        expect(noPrograms.pools).toHaveLength(2);
    });
});
