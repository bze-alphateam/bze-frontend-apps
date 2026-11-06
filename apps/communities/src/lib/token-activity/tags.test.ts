import {describe, expect, it} from "vitest";

import {ACTIVITY_TAGS, MSG, tagOf} from "./tags";

describe("tagOf", () => {
    it.each([
        [MSG.multiSwap, "Swap"],
        [MSG.addLiquidity, "Liquidity"],
        [MSG.removeLiquidity, "Liquidity"],
        [MSG.createLiquidityPool, "Liquidity"],
        [MSG.createOrder, "Order"],
        [MSG.fillOrders, "Order"],
        [MSG.cancelOrder, "Order"],
        [MSG.joinDenomReward, "Stake"],
        [MSG.joinStaking, "Stake"],
        [MSG.exitDenomReward, "Unstake"],
        [MSG.exitStaking, "Unstake"],
        [MSG.claimDenomRewards, "Claim"],
        [MSG.claimStakingRewards, "Claim"],
        [MSG.createStakingReward, "Rewards"],
        [MSG.updateStakingReward, "Rewards"],
        [MSG.distributeStakingRewards, "Rewards"],
        [MSG.createDenomReward, "Rewards"],
        [MSG.createDenomRewardSchedule, "Rewards"],
        [MSG.updateDenomRewardSchedule, "Rewards"],
        [MSG.distributeDenomRewards, "Rewards"],
        [MSG.createTradingReward, "Rewards"],
        [MSG.activateTradingReward, "Rewards"],
        [MSG.fundBurner, "Burn"],
        [MSG.burn, "Burn"],
        [MSG.startRaffle, "Raffle"],
        [MSG.joinRaffle, "Raffle"],
        [MSG.ibcTransfer, "Cross-chain"],
        [MSG.ibcRecvPacket, "Cross-chain"],
        [MSG.ibcAcknowledgement, "Cross-chain"],
        [MSG.ibcTimeout, "Cross-chain"],
        [MSG.mint, "Mint"],
        [MSG.send, "Transfer"],
        [MSG.multiSend, "Transfer"],
        ["/cosmos.staking.v1beta1.MsgDelegate", "Transfer"],
        [null, "Transfer"],
    ])("%s → %s", (typeUrl, tag) => {
        expect(tagOf(typeUrl)).toBe(tag);
    });

    it("lists every tag once", () => {
        expect(new Set(ACTIVITY_TAGS).size).toBe(ACTIVITY_TAGS.length);
        expect(ACTIVITY_TAGS).not.toContain("Fund rewards");
    });
});
