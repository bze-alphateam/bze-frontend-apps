import { describe, it, expect } from "vitest";
import type { Asset } from "@bze/bze-ui-kit";
import { createMarketMsgValue, marketPairProblem } from "./market-new";
import { dexMarketHref } from "./create-routes";

describe("marketPairProblem", () => {
    const tok = { denom: "utok", ticker: "TOK" } as Asset;
    const bze = { denom: "ubze", ticker: "BZE" } as Asset;
    const halted = { denom: "uhalt", ticker: "HALT", halted: true } as Asset;
    const none = () => false;
    const existing = (...ids: string[]) => (id: string) => ids.includes(id);

    it("waits for both sides", () => {
        expect(marketPairProblem("utok", "", tok, undefined, none)).toBeUndefined();
        expect(marketPairProblem("", "ubze", undefined, bze, none)).toBeUndefined();
    });

    it("accepts a new pair", () => {
        expect(marketPairProblem("utok", "ubze", tok, bze, none)).toBeUndefined();
    });

    it("rejects the same token twice", () => {
        expect(marketPairProblem("ubze", "ubze", bze, bze, none)).toEqual({ message: "Pick two different tokens." });
    });

    it("rejects a halted token on either side", () => {
        expect(marketPairProblem("uhalt", "ubze", halted, bze, none)?.message).toMatch(/^HALT is no longer tradeable on BZE/);
        expect(marketPairProblem("utok", "uhalt", tok, halted, none)?.message).toMatch(/^HALT is no longer tradeable on BZE/);
    });

    it("names an existing market stored in the picked direction (A/B)", () => {
        expect(marketPairProblem("utok", "ubze", tok, bze, existing("utok/ubze"))).toEqual({
            message: "This pair already has a market. Each pair gets exactly one.",
            existingMarketId: "utok/ubze",
        });
    });

    it("names an existing market stored the other way round (B/A), in its real direction", () => {
        expect(marketPairProblem("utok", "ubze", tok, bze, existing("ubze/utok"))?.existingMarketId).toBe("ubze/utok");
    });
});

describe("dexMarketHref", () => {
    it("links the market's DEX page with the id encoded", () => {
        expect(dexMarketHref("https://dex.test/", "ubze/factory/bze1x/tok"))
            .toBe(`https://dex.test/exchange/market?id=${encodeURIComponent("ubze/factory/bze1x/tok")}`);
    });
});

describe("createMarketMsgValue", () => {
    it("keeps the user's order, even when it isn't alphabetical", () => {
        expect(createMarketMsgValue({ creator: "bze1me", baseDenom: "utok", quoteDenom: "ubze" }))
            .toEqual({ creator: "bze1me", base: "utok", quote: "ubze" });
    });
});
