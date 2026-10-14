import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import type {AddressRewardsStaking, ExtendedPendingUnlockParticipantSDKType} from "@bze/bze-ui-kit";

import {
    fixedTermPrograms,
    isProgramFinished,
    programApr,
    programDaysLeft,
    programMessage,
    unlockingTotal,
} from "./fixed-term";

const T = "factory/bze1owner/upage";
const ME = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const program = (id: string, extra: Partial<StakingRewardSDKType> = {}): StakingRewardSDKType => ({
    reward_id: id,
    prize_amount: "500000000",
    prize_denom: "ubze",
    staking_denom: T,
    duration: 30,
    payouts: 7,
    min_stake: 50_000_000n,
    lock: 14,
    staked_amount: "6100000000000",
    distributed_stake: "0.5",
    ...extra,
});

const unlock = (rewardId: string, amount: string, epoch: number): ExtendedPendingUnlockParticipantSDKType => ({
    index: `${epoch}/${rewardId}/${ME}`, address: ME, amount, denom: T, unlockEpoch: new BigNumber(epoch), rewardId,
});

const addressData = (
    active: [string, string][] = [],
    unlocking: [string, ExtendedPendingUnlockParticipantSDKType[]][] = [],
): AddressRewardsStaking => ({
    address: ME,
    active: new Map(active.map(([id, amount]) => [id, {address: ME, reward_id: id, amount, joined_at: "0.25"}])),
    unlocking: new Map(unlocking),
});

const ids = (list: { program: StakingRewardSDKType }[]) => list.map((item) => item.program.reward_id);

describe("fixedTermPrograms", () => {
    const rewards = [
        program("01", {payouts: 30}), // finished, viewer staked
        program("02"), // running
        program("03", {staking_denom: "ubze", prize_denom: T}), // pays T: the Earn section's, not here
        program("04", {payouts: 31, duration: 30}), // finished, nobody here in it
        program("05", {payouts: 10, duration: 10}), // finished, viewer unlocking
        program("06", {prize_denom: "uusdc"}), // running, viewer staked
    ];

    it("keeps only the running programs staking T without a viewer", () => {
        expect(ids(fixedTermPrograms(rewards, T))).toEqual(["02", "06"]);
    });

    it("adds the finished programs the viewer is still in, after the running ones", () => {
        const mine = addressData([["01", "2000000000"], ["06", "1000000"]], [["05", [unlock("05", "300000000", 1500)]]]);

        expect(ids(fixedTermPrograms(rewards, T, mine))).toEqual(["02", "06", "01", "05"]);
    });

    it("attaches the viewer's stake, unlocks and pending prize", () => {
        const mine = addressData([["06", "1000000"]], [["06", [unlock("06", "5", 1)]]]);
        const [running, staked] = fixedTermPrograms(rewards, T, mine);

        expect(running.stake).toBeUndefined();
        expect(running.unlocking).toEqual([]);
        expect(running.pending.toString()).toBe("0");
        expect(staked.stake?.amount).toBe("1000000");
        expect(staked.unlocking).toHaveLength(1);
        // 1,000,000 staked × (0.5 − 0.25) distributed since joining.
        expect(staked.pending.toString()).toBe("250000");
    });

    it("is empty when no program stakes T", () => {
        expect(fixedTermPrograms([program("03", {staking_denom: "ubze"})], T)).toEqual([]);
    });
});

describe("program state", () => {
    it("is finished once every day was paid", () => {
        expect(isProgramFinished(program("1", {payouts: 29}))).toBe(false);
        expect(isProgramFinished(program("1", {payouts: 30}))).toBe(true);
    });

    it("counts the days left, never below 0", () => {
        expect(programDaysLeft(program("1"))).toBe(23);
        expect(programDaysLeft(program("1", {payouts: 32}))).toBe(0);
    });

    it("sums the unlocks", () => {
        expect(unlockingTotal([unlock("1", "100", 1), unlock("1", "250", 2)]).toString()).toBe("350");
        expect(unlockingTotal([]).toString()).toBe("0");
    });
});

describe("programApr", () => {
    const prices = {stakingPrice: new BigNumber("0.5"), prizePrice: new BigNumber("0.002")};

    it("converts both sides to USD when the prize is another token, like the DEX's box", () => {
        // 500 BZE × $0.002 = $1/day over 6.1M PAGE × $0.5 = $3.05M → 0.011967…%.
        const apr = programApr({program: program("1"), stakingDecimals: 6, prizeDecimals: 6, ...prices});

        expect(apr?.toString()).toBe("0.011967");
    });

    it("uses the raw amounts when the program pays in T, without prices", () => {
        // 10 PAGE a day over 1,000 PAGE staked = 365%.
        const self = program("1", {prize_denom: T, prize_amount: "10000000", staked_amount: "1000000000"});

        expect(programApr({program: self, stakingDecimals: 6, prizeDecimals: 6})?.toString()).toBe("365");
    });

    it("is hidden without a price on either side", () => {
        const base = {program: program("1"), stakingDecimals: 6, prizeDecimals: 6};

        expect(programApr({...base, stakingPrice: prices.stakingPrice})).toBeUndefined();
        expect(programApr({...base, prizePrice: prices.prizePrice})).toBeUndefined();
        expect(programApr({...base, stakingPrice: new BigNumber(0), prizePrice: prices.prizePrice})).toBeUndefined();
    });

    it("is hidden while nothing is staked", () => {
        expect(programApr({program: program("1", {staked_amount: "0"}), stakingDecimals: 6, prizeDecimals: 6, ...prices})).toBeUndefined();
    });
});

describe("programMessage", () => {
    it("builds one x/rewards message per action", () => {
        expect(programMessage("stake", ME, "0007", new BigNumber("1250000000"))).toEqual({
            typeUrl: "/bze.rewards.MsgJoinStaking",
            value: {creator: ME, rewardId: "0007", amount: "1250000000"},
        });
        expect(programMessage("claim", ME, "0007")).toEqual({
            typeUrl: "/bze.rewards.MsgClaimStakingRewards",
            value: {creator: ME, rewardId: "0007"},
        });
        expect(programMessage("unstake", ME, "0007")).toEqual({
            typeUrl: "/bze.rewards.MsgExitStaking",
            value: {creator: ME, rewardId: "0007"},
        });
    });
});
