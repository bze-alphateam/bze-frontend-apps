import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import {
    MAX_DURATION_DAYS,
    MAX_LOCK_DAYS,
    MIN_DURATION_DAYS,
    escrowAmount,
    extractRewardId,
    minStakeToChain,
    programBalances,
    validateDays,
    validateMinStake,
} from "./reward-new";

describe("validateDays", () => {
    it.each([
        ["0", ""],
        ["3650", ""],
        ["3651", "Must be between 0 and 3,650 days."],
    ])("lock %s → %j", (value, error) => {
        expect(validateDays(value, 0, MAX_LOCK_DAYS)).toBe(error);
    });

    it.each([
        ["0", "Must be between 1 and 36,500 days."],
        ["1", ""],
        ["36500", ""],
        ["36501", "Must be between 1 and 36,500 days."],
    ])("duration %s → %j", (value, error) => {
        expect(validateDays(value, MIN_DURATION_DAYS, MAX_DURATION_DAYS)).toBe(error);
    });

    it("wants a whole number", () => {
        expect(validateDays("", 1, 10)).toBe("Required.");
        expect(validateDays("1.5", 1, 10)).toBe("Enter a whole number of days.");
        expect(validateDays("-1", 0, 10)).toBe("Enter a whole number of days.");
    });
});

describe("min stake", () => {
    it("treats empty and 0 as no minimum", () => {
        expect(validateMinStake("", 6)).toBe("");
        expect(validateMinStake("0", 6)).toBe("");
        expect(minStakeToChain("", 6)).toBe("0");
        expect(minStakeToChain(" 0 ", 6)).toBe("0");
    });

    it("sends a value in base units", () => {
        expect(validateMinStake("2.5", 6)).toBe("");
        expect(minStakeToChain("2.5", 6)).toBe("2500000");
        expect(minStakeToChain("1", 12)).toBe("1000000000000");
    });

    it("rejects an invalid value", () => {
        expect(validateMinStake("abc", 6)).not.toBe("");
    });
});

describe("escrowAmount", () => {
    it("is prize per day × days in base units", () => {
        expect(escrowAmount("1.5", 6, "30").toFixed()).toBe("45000000");
    });
});

describe("programBalances", () => {
    const fee = { denom: "ubze", amount: "100" };
    const noGas = { denom: "ubze", amount: new BigNumber(0) };
    const base = {
        escrow: new BigNumber(1000),
        fee,
        gasFee: noGas,
        paysWithAlt: false,
    };

    it("prize = fee denom, paid natively: the balance covers escrow + fee together", () => {
        const enough = programBalances({ ...base, prizeDenom: "ubze", prizeBalance: new BigNumber(1100), feeBalance: new BigNumber(1100) });
        expect(enough).toEqual({ hasEnoughForEscrow: true, hasEnoughForFee: true, canPayFee: true });

        const short = programBalances({ ...base, prizeDenom: "ubze", prizeBalance: new BigNumber(1099), feeBalance: new BigNumber(1099) });
        expect(short).toEqual({ hasEnoughForEscrow: false, hasEnoughForFee: false, canPayFee: false });
    });

    it("prize = fee denom, fee paid with the alternate token: the escrow alone must fit", () => {
        const result = programBalances({ ...base, paysWithAlt: true, prizeDenom: "ubze", prizeBalance: new BigNumber(1000), feeBalance: new BigNumber(1000) });
        expect(result).toEqual({ hasEnoughForEscrow: true, hasEnoughForFee: false, canPayFee: true });
    });

    it("different denoms: each balance covers its own part", () => {
        const result = programBalances({ ...base, prizeDenom: "utok", prizeBalance: new BigNumber(1000), feeBalance: new BigNumber(100) });
        expect(result).toEqual({ hasEnoughForEscrow: true, hasEnoughForFee: true, canPayFee: true });

        const noFee = programBalances({ ...base, prizeDenom: "utok", prizeBalance: new BigNumber(1000), feeBalance: new BigNumber(99) });
        expect(noFee.canPayFee).toBe(false);
        const noPrize = programBalances({ ...base, prizeDenom: "utok", prizeBalance: new BigNumber(999), feeBalance: new BigNumber(100) });
        expect(noPrize.hasEnoughForEscrow).toBe(false);
    });

    it("gas in the fee denom comes on top of the fee", () => {
        const gas = { denom: "ubze", amount: new BigNumber(5) };
        expect(programBalances({ ...base, gasFee: gas, prizeDenom: "utok", prizeBalance: new BigNumber(1000), feeBalance: new BigNumber(104) }).hasEnoughForFee).toBe(false);
        expect(programBalances({ ...base, gasFee: gas, prizeDenom: "utok", prizeBalance: new BigNumber(1000), feeBalance: new BigNumber(105) }).hasEnoughForFee).toBe(true);
        // Gas in another denom does not count.
        const otherGas = { denom: "uusdc", amount: new BigNumber(5) };
        expect(programBalances({ ...base, gasFee: otherGas, prizeDenom: "utok", prizeBalance: new BigNumber(1000), feeBalance: new BigNumber(100) }).hasEnoughForFee).toBe(true);
    });

    it("is false everywhere while the escrow or fee is unknown", () => {
        const result = programBalances({ ...base, escrow: undefined, fee: undefined, prizeDenom: "ubze", prizeBalance: new BigNumber(1e9), feeBalance: new BigNumber(1e9) });
        expect(result).toEqual({ hasEnoughForEscrow: false, hasEnoughForFee: false, canPayFee: false });
    });
});

describe("extractRewardId", () => {
    it("reads the JSON-encoded reward_id of the create event", () => {
        const res = {
            events: [
                { type: "coin_spent", attributes: [{ key: "amount", value: "100ubze" }] },
                {
                    type: "bze.rewards.StakingRewardCreateEvent",
                    attributes: [
                        { key: "prize_denom", value: "\"ubze\"" },
                        { key: "reward_id", value: "\"0000000000000042\"" },
                    ],
                },
            ],
        };
        expect(extractRewardId(res)).toBe("0000000000000042");
    });

    it("is undefined without the event", () => {
        expect(extractRewardId({ events: [] })).toBeUndefined();
        expect(extractRewardId({})).toBeUndefined();
    });
});
