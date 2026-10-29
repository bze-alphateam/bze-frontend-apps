import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import {uPriceToMsgPrice} from "@bze/bze-ui-kit";
import {isAboveChainMinPrice} from "./order-price";

describe("isAboveChainMinPrice", () => {
    it("accepts prices above 1e-10", () => {
        expect(isAboveChainMinPrice(new BigNumber("0.00000005"))).toBe(true);
        expect(isAboveChainMinPrice(new BigNumber("0.00000000011"))).toBe(true);
    });

    it("refuses the floor itself and anything below, like the chain", () => {
        expect(isAboveChainMinPrice(new BigNumber("0.0000000001"))).toBe(false);
        expect(isAboveChainMinPrice(new BigNumber("0.00000000001"))).toBe(false);
        expect(isAboveChainMinPrice(new BigNumber(Infinity))).toBe(false);
    });

    // regression: a lowball bid between 1e-10 and 1e-7 went out as "5e-8", which the chain's
    // LegacyDec parser refuses
    it("prices it accepts go into the message in plain notation", () => {
        const uPrice = new BigNumber("0.00000005");
        expect(uPrice.toString()).toBe("5e-8");
        expect(isAboveChainMinPrice(uPrice)).toBe(true);
        expect(uPriceToMsgPrice(uPrice)).toBe("0.00000005");
    });
});
