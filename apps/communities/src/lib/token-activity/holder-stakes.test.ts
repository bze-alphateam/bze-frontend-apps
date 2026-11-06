import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import type {AddressRewardsStaking, DenomRewardHolderItem, ExtendedPendingUnlockParticipantSDKType} from "@bze/bze-ui-kit";

import {holderStakePositions, totalStaked} from "./holder-stakes";

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const HOLDER = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const pool = (staked?: string, unlocks: {staking_denom: string; amount: string}[] = []): DenomRewardHolderItem => ({
    denomReward: {staking_denom: NOAD, lock: 7, min_stake: "1", staked_amount: "25000000"},
    position: staked ? {participant: {address: HOLDER, staking_denom: NOAD, amount: staked}, pending: []} : undefined,
    unlocks: unlocks.map((unlock) => ({...unlock, unlockEpoch: 100})),
});

const program = (reward_id: string, staking_denom: string, lock = 30): StakingRewardSDKType => ({
    reward_id, prize_amount: "1", prize_denom: "ubze", staking_denom, duration: 10, payouts: 0, min_stake: BigInt(1), lock, staked_amount: "0", distributed_stake: "0",
});

const unlock = (rewardId: string, amount: string): ExtendedPendingUnlockParticipantSDKType =>
    ({index: "x", address: HOLDER, amount, denom: NOAD, unlockEpoch: new BigNumber(1), rewardId});

const staking = (active: [string, string][], unlocking: [string, string][] = []): AddressRewardsStaking => ({
    address: HOLDER,
    active: new Map(active.map(([id, amount]) => [id, {address: HOLDER, reward_id: id, amount, joined_at: "0"}])),
    unlocking: new Map(unlocking.map(([id, amount]) => [id, [unlock(id, amount)]])),
});

describe("holderStakePositions", () => {
    it("lists the holders pool stake with its unlock time", () => {
        const positions = holderStakePositions({denom: NOAD, pool: pool("20000000"), programs: []});

        expect(positions).toEqual([expect.objectContaining({kind: "pool", lockDays: 7})]);
        expect(positions[0].staked.toFixed()).toBe("20000000");
        expect(totalStaked(positions).toFixed()).toBe("20000000");
    });

    it("keeps only programs staking T where the holder stakes or unlocks", () => {
        const positions = holderStakePositions({
            denom: NOAD,
            programs: [program("1", NOAD), program("2", NOAD), program("3", "ubze")],
            staking: staking([["1", "5"], ["3", "99"]], [["2", "7"]]),
        });

        expect(positions.map((position) => [position.id, position.staked.toFixed(), position.unlocking.toFixed()])).toEqual([["1", "5", "0"], ["2", "0", "7"]]);
        expect(totalStaked(positions).toFixed()).toBe("5");
    });

    it("keeps a pool position that is only unlocking, and drops one with nothing", () => {
        expect(holderStakePositions({denom: NOAD, pool: pool(undefined, [{staking_denom: NOAD, amount: "3"}]), programs: []})).toHaveLength(1);
        expect(holderStakePositions({denom: NOAD, pool: pool(), programs: []})).toEqual([]);
    });
});
