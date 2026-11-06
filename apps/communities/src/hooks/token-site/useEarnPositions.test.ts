import {describe, expect, it, vi} from "vitest";

import {type EarnPositionsQueries, loadEarnPositions} from "./useEarnPositions";

const ME = "bze1me";
const GUILD = "factory/bze1guild/uguild";
const VDL = "factory/bze1vdl/uvdl";
const T = "factory/bze1owner/upage";

const queries = (extra: Partial<EarnPositionsQueries> = {}): EarnPositionsQueries => ({
    getDenomRewardParticipations: vi.fn(async () => [{address: ME, staking_denom: GUILD, amount: "5"}]),
    getDenomRewardParticipant: vi.fn(async (address: string, denom: string) => ({
        participant: {address, staking_denom: denom, amount: "5"},
        pending: [{denom: T, amount: "64"}, {denom: GUILD, amount: "0"}, {denom: VDL, amount: "24"}],
    })),
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

    it("reads what each staked holders pool lets the viewer claim, one read per pool, zero coins left out", async () => {
        const q = queries({
            getDenomRewardParticipations: vi.fn(async () => [
                {address: ME, staking_denom: GUILD, amount: "5"},
                {address: ME, staking_denom: VDL, amount: "9"},
            ]),
        });

        const positions = await loadEarnPositions(ME, q);

        expect(q.getDenomRewardParticipant).toHaveBeenCalledTimes(2);
        expect(q.getDenomRewardParticipant).toHaveBeenCalledWith(ME, GUILD);
        expect(q.getDenomRewardParticipant).toHaveBeenCalledWith(ME, VDL);
        expect(positions.poolPending.get(GUILD)).toEqual([{denom: T, amount: "64"}, {denom: VDL, amount: "24"}]);
    });

    it("reads no pending without a holders pool stake, and none for a position gone meanwhile", async () => {
        const none = queries({getDenomRewardParticipations: vi.fn(async () => [])});
        expect((await loadEarnPositions(ME, none)).poolPending.size).toBe(0);
        expect(none.getDenomRewardParticipant).not.toHaveBeenCalled();

        const gone = await loadEarnPositions(ME, queries({getDenomRewardParticipant: async () => undefined}));
        expect(gone.poolPending.get(GUILD)).toEqual([]);
    });

    it("leaves a pool's pending unknown when its read fails, keeping the stakes and the other pools", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const positions = await loadEarnPositions(ME, queries({
            getDenomRewardParticipations: async () => [
                {address: ME, staking_denom: GUILD, amount: "5"},
                {address: ME, staking_denom: VDL, amount: "9"},
            ],
            getDenomRewardParticipant: async (address, denom) => {
                if (denom === GUILD) throw new Error("node down");
                return {participant: {address, staking_denom: denom, amount: "9"}, pending: [{denom: T, amount: "3"}]};
            },
        }));

        expect(positions.pools.map((p) => p.staking_denom)).toEqual([GUILD, VDL]);
        expect(positions.poolPending.has(GUILD)).toBe(false);
        expect(positions.poolPending.get(VDL)).toEqual([{denom: T, amount: "3"}]);
    });

    it("drops only the half whose read failed", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        const positions = await loadEarnPositions(ME, queries({
            getDenomRewardParticipations: async () => {
                throw new Error("node down");
            },
        }));

        expect(positions.pools).toEqual([]);
        expect(positions.poolPending.size).toBe(0);
        expect(positions.programs.map((p) => p.reward_id)).toEqual(["7"]);
    });
});
