import {describe, expect, it} from "vitest";
import {splitPotCoins} from "./next-burn";

describe("splitPotCoins", () => {
    it("burns native and factory coins and locks IBC coins and LP shares", () => {
        const coins = [
            {denom: "ubze", amount: "1"},
            {denom: "factory/bze1abc/uhoney", amount: "2"},
            {denom: "ibc/ABC123", amount: "3"},
            {denom: "ulp_7", amount: "4"},
        ];

        const {toBurn, toLock} = splitPotCoins(coins, "ubze");

        expect(toBurn.map(c => c.denom)).toEqual(["ubze", "factory/bze1abc/uhoney"]);
        expect(toLock.map(c => c.denom)).toEqual(["ibc/ABC123", "ulp_7"]);
    });

    it("returns empty groups for an empty pot", () => {
        expect(splitPotCoins([], "ubze")).toEqual({toBurn: [], toLock: []});
    });
});
