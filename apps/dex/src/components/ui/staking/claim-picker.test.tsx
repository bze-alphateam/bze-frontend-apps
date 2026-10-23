import { describe, expect, it } from "vitest";
import BigNumber from "bignumber.js";
import type { StakingRewardSDKType } from "@bze/bzejs/bze/rewards/store";
import type { DenomRewardHolderItem, NativeStakingData } from "@bze/bze-ui-kit";
import { claimMessages, claimSpec } from "@/components/ui/staking/claim-picker-modal";
import { buildStakingRows, type StakingLookups } from "@/lib/staking-list";

const lookups: StakingLookups = {
    ticker: (d) => d,
    verified: () => true,
    isLp: () => false,
    usdValue: () => new BigNumber(0),
};

const bze = (n: number) => ({ denom: "ubze", amount: new BigNumber(n).shiftedBy(6) });

const native: NativeStakingData = {
    averageApr: "10", unlockDuration: "21", totalStaked: bze(1000), minAmount: bze(0), averageDailyDistribution: bze(1),
    currentStaking: {
        staked: bze(10),
        unbonding: { total: bze(0), firstUnlock: {} },
        pendingRewards: { total: bze(2), validators: ["bzevaloper1a", "bzevaloper1b"] },
    },
};

const rows = buildStakingRows({
    native,
    nativeDenom: "ubze",
    simple: [{ reward_id: "0014", staking_denom: "ubze", prize_denom: "ubze", prize_amount: "1", staked_amount: "1", duration: 10, payouts: 1, lock: 1, min_stake: "0", distributed_stake: "0" } as StakingRewardSDKType],
    compounded: [{ denomReward: { staking_denom: "factory/bze1x/tok", staked_amount: "1", lock: 0, min_stake: "0" }, unlocks: [] } as unknown as DenomRewardHolderItem],
}, lookups);

describe("claimMessages", () => {
    it("claims native staking from every validator, a simple reward by id and a compounded one by denom", () => {
        const [nativeRow] = rows.filter((r) => r.kind === "native");
        expect(claimMessages(nativeRow, "bze1me").map((m) => [m.typeUrl, (m.value as { validatorAddress: string }).validatorAddress])).toEqual([
            ["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward", "bzevaloper1a"],
            ["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward", "bzevaloper1b"],
        ]);

        const simple = rows.find((r) => r.kind === "simple")!;
        expect(claimMessages(simple, "bze1me")).toEqual([
            expect.objectContaining({ value: expect.objectContaining({ creator: "bze1me", rewardId: "0014" }) }),
        ]);

        const compounded = rows.find((r) => r.kind === "compounded")!;
        expect(claimMessages(compounded, "bze1me")).toEqual([
            expect.objectContaining({ value: expect.objectContaining({ creator: "bze1me", denom: "factory/bze1x/tok" }) }),
        ]);
    });
});

describe("claimSpec", () => {
    it("sizes the gas by message kind and count", () => {
        expect(claimSpec(rows)).toEqual([
            { kind: "withdraw-delegator-reward", count: 2 },
            { kind: "claim-staking-reward", count: 1 },
            { kind: "claim-denom-rewards", count: 1 },
        ]);
        expect(claimSpec(rows.filter((r) => r.kind === "simple"))).toEqual([{ kind: "claim-staking-reward", count: 1 }]);
    });
});
