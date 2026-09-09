import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";

import {
    exceedsSpendable,
    quickAmount,
    validateDelegationAmount,
} from "./delegate-amount";

const DECIMALS = 6;
// 10 BZE expressed in uamount (6 decimals).
const TEN_BZE_UAMOUNT = "10000000";
// 10 BZE minus a 0.0045 BZE gas reserve.
const SPENDABLE_UAMOUNT = "9995500";

describe("validateDelegationAmount", () => {
    it("accepts a positive amount within balance", () => {
        expect(validateDelegationAmount("5", TEN_BZE_UAMOUNT, DECIMALS)).toBeNull();
    });

    it("accepts spending the exact full balance when no spendable limit is known", () => {
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

    it("accepts the exact spendable amount and flags anything above it as leaving no fee reserve", () => {
        expect(validateDelegationAmount("9.9955", TEN_BZE_UAMOUNT, DECIMALS, SPENDABLE_UAMOUNT)).toBeNull();
        expect(validateDelegationAmount("9.9956", TEN_BZE_UAMOUNT, DECIMALS, SPENDABLE_UAMOUNT)).toBe("no-fee-reserve");
        expect(validateDelegationAmount("10", TEN_BZE_UAMOUNT, DECIMALS, SPENDABLE_UAMOUNT)).toBe("no-fee-reserve");
    });

    it("still reports insufficient-balance above the balance even with a spendable limit", () => {
        expect(validateDelegationAmount("11", TEN_BZE_UAMOUNT, DECIMALS, SPENDABLE_UAMOUNT)).toBe("insufficient-balance");
    });
});

describe("exceedsSpendable", () => {
    const available = new BigNumber("10");
    const spendable = new BigNumber("9.9955");

    it("is false for an empty amount", () => {
        expect(exceedsSpendable("", spendable, available)).toBe(false);
    });

    it("is true when the amount eats into the gas reserve", () => {
        expect(exceedsSpendable("10", spendable, available)).toBe(true);
        expect(exceedsSpendable("9.9956", spendable, available)).toBe(true);
    });

    it("is false when the reserve is left intact", () => {
        expect(exceedsSpendable("9.9955", spendable, available)).toBe(false);
        expect(exceedsSpendable("5", spendable, available)).toBe(false);
    });

    it("is false when there is no balance at all", () => {
        expect(exceedsSpendable("1", new BigNumber(0), new BigNumber(0))).toBe(false);
    });
});

describe("quickAmount", () => {
    const available = new BigNumber("10");

    it("takes the given fraction of the balance", () => {
        expect(quickAmount(available, 0.25, DECIMALS)).toBe("2.5");
        expect(quickAmount(available, 0.5, DECIMALS)).toBe("5");
        expect(quickAmount(available, 1, DECIMALS)).toBe("10");
    });

    it("rounds down to the token's decimal precision so the result never exceeds the balance", () => {
        // A third of 10 is 3.3333… — clamped to 6 decimal places.
        expect(quickAmount(available, 1 / 3, DECIMALS)).toBe("3.333333");
        // 2/3 of 10 is 6.6666… — rounding half-up would give 6.666667, above 2/3.
        expect(quickAmount(available, 2 / 3, DECIMALS)).toBe("6.666666");
    });
});
