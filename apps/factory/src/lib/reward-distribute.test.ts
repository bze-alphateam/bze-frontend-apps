import { describe, it, expect } from "vitest";
import {
    checkDistributeAmount,
    distributeHref,
    distributeMsgValue,
    hasStakers,
    linkedRewardId,
    searchDistributableRewards,
} from "./reward-distribute";

const reward = (reward_id: string, staking_denom: string, staked_amount: string, prize_denom = "uhoney") =>
    ({ reward_id, staking_denom, prize_denom, staked_amount });

const LP = reward("1", "ulp/hb", "5000000");
const LP_EMPTY = reward("2", "ulp/hb", "0");
const VDL = reward("3", "uvdl", "100", "ubze");
const VDL_2 = reward("4", "uvdl", "7", "uhoney");
const ticker = (d: string) => ({ uhoney: "HONEY", ubze: "BZE", uvdl: "VDL", "ulp/hb": "HONEY/BZE LP" }[d] ?? d);

describe("distributeHref", () => {
    it("links one reward, or the list", () => {
        expect(distributeHref("000000000007")).toBe("/reward/distribute?id=000000000007");
        expect(distributeHref()).toBe("/reward/distribute");
    });
});

describe("hasStakers", () => {
    it("needs a positive staked total", () => {
        expect(hasStakers({ staked_amount: "1" })).toBe(true);
        expect(hasStakers({ staked_amount: "0" })).toBe(false);
        expect(hasStakers({ staked_amount: "" })).toBe(false);
    });
});

describe("linkedRewardId", () => {
    const rewards = [LP, LP_EMPTY, VDL, VDL_2];

    it("takes ?id= as given, even an unknown one (the page shows not-found)", () => {
        expect(linkedRewardId(rewards, { id: "2" })).toBe("2");
        expect(linkedRewardId(rewards, { id: "99", staking: "uvdl" })).toBe("99");
    });

    it("preselects the only reward with stakers for ?staking=", () => {
        // The empty LP reward doesn't count.
        expect(linkedRewardId(rewards, { staking: "ulp/hb" })).toBe("1");
    });

    it("leaves the pick to the list when several rewards or none match", () => {
        expect(linkedRewardId(rewards, { staking: "uvdl" })).toBe("");
        expect(linkedRewardId(rewards, { staking: "unone" })).toBe("");
        expect(linkedRewardId(rewards, {})).toBe("");
    });
});

describe("searchDistributableRewards", () => {
    const rewards = [LP, LP_EMPTY, VDL, VDL_2];

    it("lists rewards with stakers only, in the chain's order", () => {
        expect(searchDistributableRewards(rewards, "", ticker).map(r => r.reward_id)).toEqual(["1", "3", "4"]);
    });

    it("searches the staked and the prize ticker", () => {
        expect(searchDistributableRewards(rewards, "vdl", ticker).map(r => r.reward_id)).toEqual(["3", "4"]);
        expect(searchDistributableRewards(rewards, " bze ", ticker).map(r => r.reward_id)).toEqual(["1", "3"]);
    });

    it("narrows to a linked staked denom", () => {
        expect(searchDistributableRewards(rewards, "", ticker, "uvdl").map(r => r.reward_id)).toEqual(["3", "4"]);
        expect(searchDistributableRewards(rewards, "honey", ticker, "uvdl").map(r => r.reward_id)).toEqual(["4"]);
    });
});

describe("checkDistributeAmount", () => {
    it("converts a valid amount to base units", () => {
        expect(checkDistributeAmount("1000", 6, "2000000000")).toEqual({ error: "", uAmount: "1000000000", short: false });
        expect(checkDistributeAmount(" 0.5 ", 6)).toEqual({ error: "", uAmount: "500000", short: false });
    });

    it("refuses an empty, zero, malformed or too precise amount", () => {
        expect(checkDistributeAmount("", 6).error).toBe("Amount is required.");
        expect(checkDistributeAmount("0", 6).error).toBe("Amount must be greater than zero.");
        expect(checkDistributeAmount("-1", 6).error).toBe("Enter a valid positive number.");
        expect(checkDistributeAmount("1.1234567", 6).error).toBe("At most 6 decimal places (the token's decimals).");
        expect(checkDistributeAmount("0", 6).uAmount).toBeUndefined();
    });

    it("flags more than the spendable balance, and the max itself is fine", () => {
        expect(checkDistributeAmount("10.000001", 6, "10000000").short).toBe(true);
        expect(checkDistributeAmount("10", 6, "10000000").short).toBe(false);
    });
});

describe("distributeMsgValue", () => {
    it("sends the reward id and the amount in base units", () => {
        expect(distributeMsgValue({ creator: "bze1me", rewardId: "000000000007", uAmount: "1000000000" }))
            .toEqual({ creator: "bze1me", rewardId: "000000000007", amount: "1000000000" });
    });
});
