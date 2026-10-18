import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import type {AddressRewardsStaking, DenomRewardHolderItem} from "@bze/bze-ui-kit";

import {claimAllMessages, tokenWalletPositions} from "./wallet";

const T = "factory/bze1owner/upage";
const ME = "bze1me";

function holdersPool(amount: string, pending: { denom: string; amount: string }[], unlocks: string[] = []): DenomRewardHolderItem {
    return {
        denomReward: {staking_denom: T, lock: 3, min_stake: "1", staked_amount: "100000"},
        position: {participant: {address: ME, staking_denom: T, amount}, pending},
        unlocks: unlocks.map((unlock, i) => ({staking_denom: T, amount: unlock, unlockEpoch: 100 + i})),
    };
}

function program(id: string, stakingDenom: string, prizeDenom: string, distributedStake = "0.5"): StakingRewardSDKType {
    return {
        reward_id: id, prize_amount: "10", prize_denom: prizeDenom, staking_denom: stakingDenom, duration: 30,
        payouts: 1, min_stake: 0n, lock: 1, staked_amount: "5000", distributed_stake: distributedStake,
    };
}

function addressPrograms(stakes: Record<string, [string, string]>, unlocking: Record<string, string[]> = {}): AddressRewardsStaking {
    return {
        address: ME,
        active: new Map(Object.entries(stakes).map(([id, [amount, joinedAt]]) => [id, {address: ME, reward_id: id, amount, joined_at: joinedAt}])),
        unlocking: new Map(Object.entries(unlocking).map(([id, amounts]) => [id, amounts.map((amount) => ({
            index: `1/${id}/${ME}`, address: ME, amount, denom: T, unlockEpoch: new BigNumber(1), rewardId: id,
        }))])),
    };
}

const typeUrls = (msgs: { typeUrl: string }[]) => msgs.map((msg) => msg.typeUrl);

describe("tokenWalletPositions", () => {
    it("sums the holders pool, the programs staking T and everything unlocking", () => {
        const positions = tokenWalletPositions({
            denom: T,
            holdersPool: holdersPool("5000", [], ["400", "600"]),
            programs: [program("1", T, "ubze"), program("2", T, T), program("3", "ubze", T)],
            addressPrograms: addressPrograms(
                {"1": ["1500", "0.5"], "2": ["500", "0.5"], "3": ["9999", "0.5"]},
                {"1": ["250"], "3": ["7777"]},
            ),
        });

        expect(positions.holdersPool.toFixed()).toBe("5000");
        // Program 3 pays T but stakes BZE: it is Earn's, not the wallet's.
        expect(positions.programs.toFixed()).toBe("2000");
        expect(positions.unlocking.toFixed()).toBe("1250");
    });

    it("is all zero without a holders pool or programs", () => {
        const positions = tokenWalletPositions({denom: T, programs: []});

        expect(positions.holdersPool.toFixed()).toBe("0");
        expect(positions.programs.toFixed()).toBe("0");
        expect(positions.unlocking.toFixed()).toBe("0");
        expect(positions.pending).toEqual([]);
    });

    it("groups pending rewards per denom across the pool and the programs, biggest first", () => {
        const positions = tokenWalletPositions({
            denom: T,
            holdersPool: holdersPool("5000", [{denom: T, amount: "34"}, {denom: "uusdc", amount: "0"}, {denom: "ubze", amount: "13"}]),
            // 1000 × (0.5 − 0.2) = 300 BZE; 100 × (0.5 − 0.4) = 10 T
            programs: [program("1", T, "ubze"), program("2", T, T)],
            addressPrograms: addressPrograms({"1": ["1000", "0.2"], "2": ["100", "0.4"]}),
        });

        expect(positions.pending.map((coin) => [coin.denom, coin.amount.toFixed()])).toEqual([
            ["ubze", "313"],
            [T, "44"],
        ]);
    });
});

describe("claimAllMessages", () => {
    it("claims only the holders pool when only it has something pending", () => {
        const positions = tokenWalletPositions({
            denom: T,
            holdersPool: holdersPool("5000", [{denom: T, amount: "34"}]),
            programs: [program("1", T, "ubze")],
            addressPrograms: addressPrograms({"1": ["1000", "0.5"]}),
        });

        const msgs = claimAllMessages(ME, T, positions);
        expect(typeUrls(msgs)).toEqual(["/bze.rewards.MsgClaimDenomRewards"]);
        expect(msgs[0].value).toEqual(expect.objectContaining({creator: ME, denom: T}));
    });

    it("claims only the programs with something pending when the pool has nothing", () => {
        const positions = tokenWalletPositions({
            denom: T,
            holdersPool: holdersPool("5000", [{denom: T, amount: "0"}]),
            programs: [program("1", T, "ubze"), program("2", T, "ubze"), program("3", "ubze", T)],
            addressPrograms: addressPrograms({"1": ["1000", "0.2"], "2": ["1000", "0.5"], "3": ["1000", "0.1"]}),
        });

        const msgs = claimAllMessages(ME, T, positions);
        expect(typeUrls(msgs)).toEqual(["/bze.rewards.MsgClaimStakingRewards"]);
        expect(msgs[0].value).toEqual(expect.objectContaining({creator: ME, rewardId: "1"}));
    });

    it("claims the pool and every paying program in one list", () => {
        const positions = tokenWalletPositions({
            denom: T,
            holdersPool: holdersPool("5000", [{denom: "ubze", amount: "13"}]),
            programs: [program("1", T, "ubze"), program("2", T, T)],
            addressPrograms: addressPrograms({"1": ["1000", "0.2"], "2": ["100", "0.4"]}),
        });

        const msgs = claimAllMessages(ME, T, positions);
        expect(typeUrls(msgs)).toEqual([
            "/bze.rewards.MsgClaimDenomRewards",
            "/bze.rewards.MsgClaimStakingRewards",
            "/bze.rewards.MsgClaimStakingRewards",
        ]);
        expect(msgs.slice(1).map((msg) => (msg.value as { rewardId: string }).rewardId)).toEqual(["1", "2"]);
    });

    it("builds nothing when nothing is pending", () => {
        const positions = tokenWalletPositions({
            denom: T,
            holdersPool: holdersPool("5000", []),
            programs: [program("1", T, "ubze")],
            addressPrograms: addressPrograms({"1": ["1000", "0.5"]}),
        });

        expect(claimAllMessages(ME, T, positions)).toEqual([]);
    });
});
