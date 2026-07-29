import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";

import {
    FEE_RESERVE,
    canReserveForFees,
    isUsingFullBalance,
    quickAmount,
    reserveForFeesAmount,
    validateDelegationAmount,
} from "./delegate-amount";

const DECIMALS = 6;
// 10 BZE expressed in uamount (6 decimals).
const TEN_BZE_UAMOUNT = "10000000";

describe("validateDelegationAmount", () => {
    it("accepts a positive amount within balance", () => {
        expect(validateDelegationAmount("5", TEN_BZE_UAMOUNT, DECIMALS)).toBeNull();
    });

    it("accepts spending the exact full balance", () => {
        expect(validateDelegationAmount("10", TEN_BZE_UAMOUNT, DECIMALS)).toBeNull();
    });

    it("rejects an empty amount", () => {
        expect(validateDelegationAmount("", TEN_BZE_UAMOUNT, DECIMALS)).toBe("empty");
    });

    it("rejects zero and negative amounts", () => {
        expect(validateDelegationAmount("0", TEN_BZE_UAMOUNT, DECIMALS)).toBe("not-positive");
        expect(validateDelegationAmount("-1", TEN_BZE_UAMOUNT, DECIMALS)).toBe("not-positive");
    });

    it("rejects an amount above the wallet balance", () => {
        expect(validateDelegationAmount("11", TEN_BZE_UAMOUNT, DECIMALS)).toBe(
            "insufficient-balance",
        );
    });
});

describe("isUsingFullBalance", () => {
    const available = new BigNumber("10");

    it("is false for an empty amount", () => {
        expect(isUsingFullBalance("", available)).toBe(false);
    });

    it("is true when the amount meets or exceeds the available balance", () => {
        expect(isUsingFullBalance("10", available)).toBe(true);
        expect(isUsingFullBalance("12", available)).toBe(true);
    });

    it("is false when some balance is left over", () => {
        expect(isUsingFullBalance("9.99", available)).toBe(false);
    });

    it("is false when there is no balance at all", () => {
        expect(isUsingFullBalance("0", new BigNumber(0))).toBe(false);
    });
});

describe("quickAmount", () => {
    const available = new BigNumber("10");

    it("takes the given fraction of the balance", () => {
        expect(quickAmount(available, 0.25, DECIMALS)).toBe("2.5");
        expect(quickAmount(available, 0.5, DECIMALS)).toBe("5");
        expect(quickAmount(available, 1, DECIMALS)).toBe("10");
    });

    it("rounds to the token's decimal precision", () => {
        // A third of 10 is 3.3333… — clamped to 6 decimal places.
        expect(quickAmount(available, 1 / 3, DECIMALS)).toBe("3.333333");
    });
});

describe("reserveForFeesAmount", () => {
    it("subtracts the fee reserve from the available balance", () => {
        expect(reserveForFeesAmount(new BigNumber("10"), DECIMALS)).toBe("9.9");
    });
});

describe("canReserveForFees", () => {
    it("is true only when the balance strictly exceeds the fee reserve", () => {
        expect(canReserveForFees(new BigNumber("10"))).toBe(true);
        // Exactly the reserve is not enough — it must be exceeded.
        expect(canReserveForFees(FEE_RESERVE)).toBe(false);
        expect(canReserveForFees(new BigNumber("0.05"))).toBe(false);
    });
});
