import {describe, expect, it, vi} from "vitest";

import {type EarnPositionsQueries, loadEarnPositions} from "./useEarnPositions";

const ME = "bze1me";
const GUILD = "factory/bze1guild/uguild";

const queries = (extra: Partial<EarnPositionsQueries> = {}): EarnPositionsQueries => ({
    getDenomRewardParticipations: vi.fn(async () => [{address: ME, staking_denom: GUILD, amount: "5"}]),
    getStakingRewardParticipants: vi.fn(async () => [{address: ME, reward_id: "7", amount: "3", joined_at: "0"}]),
    ...extra,
});

describe("loadEarnPositions", () => {
    it("reads both kinds of stake once, address-wide", async () => {
        const q = queries();

        const positions = await loadEarnPositions(ME, q);

        expect(q.getDenomRewardParticipations).toHaveBeenCalledTimes(1);
        expect(q.getDenomRewardParticipations).toHaveBeenCalledWith(ME);
        expect(q.getStakingRewardParticipants).toHaveBeenCalledTimes(1);
        expect(q.getStakingRewardParticipants).toHaveBeenCalledWith(ME);
        expect(positions.pools.map((p) => p.staking_denom)).toEqual([GUILD]);
        expect(positions.programs.map((p) => p.reward_id)).toEqual(["7"]);
    });

    it("drops only the half whose read failed", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const positions = await loadEarnPositions(ME, queries({
            getDenomRewardParticipations: async () => {
                throw new Error("node down");
            },
        }));

        expect(positions.pools).toEqual([]);
        expect(positions.programs.map((p) => p.reward_id)).toEqual(["7"]);
    });
});
