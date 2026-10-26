import { describe, it, expect } from "vitest";
import {
    checkDistributeAmount,
    distributeMsgValue,
    hasStakers,
} from "./reward-distribute";

describe("hasStakers", () => {
    it("needs a positive staked total", () => {
        expect(hasStakers({ staked_amount: "1" })).toBe(true);
        expect(hasStakers({ staked_amount: "0" })).toBe(false);
        expect(hasStakers({ staked_amount: "" })).toBe(false);
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
