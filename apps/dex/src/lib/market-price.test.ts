import { describe, expect, it } from "vitest";

import { marketPriceLabel } from "./market-price";

describe("marketPriceLabel", () => {
    it("joins the last price and the quote ticker", () => {
        expect(marketPriceLabel(0.365, "TUSDC")).toBe("0.365 TUSDC");
        expect(marketPriceLabel(0, "TUSDC")).toBe("0 TUSDC");
    });

    it("shows a dash, never a bare ticker, for a market without trade data", () => {
        expect(marketPriceLabel(undefined, "TUSDC")).toBe("—");
    });

    it("shows a dash while the quote asset is unknown", () => {
        expect(marketPriceLabel(1.2, undefined)).toBe("—");
    });
});
