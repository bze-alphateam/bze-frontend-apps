import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";

import { sumBurnAmounts } from "./burn-history";

function burn(denom: string, amount: string) {
    return { denom, amount: new BigNumber(amount) };
}

describe("sumBurnAmounts", () => {
    const history = [
        burn("ubze", "100"),
        burn("factory/x/uhoney", "50"),
        burn("ubze", "25"),
    ];

    it("sums only the entries matching the given denom", () => {
        expect(sumBurnAmounts(history, "ubze").toString()).toBe("125");
    });

    it("sums every entry when no denom is given", () => {
        expect(sumBurnAmounts(history).toString()).toBe("175");
    });

    it("is zero when nothing matches the denom", () => {
        expect(sumBurnAmounts(history, "uother").toString()).toBe("0");
    });

    it("is zero for an empty history", () => {
        expect(sumBurnAmounts([], "ubze").toString()).toBe("0");
    });

    it("does not mutate the input", () => {
        const input = [burn("ubze", "100"), burn("ubze", "25")];
        const before = input.map((b) => b.amount.toString());
        sumBurnAmounts(input, "ubze");
        expect(input.map((b) => b.amount.toString())).toEqual(before);
    });
});
