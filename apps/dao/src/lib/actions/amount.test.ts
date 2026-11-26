import {describe, expect, it} from "vitest";
import {parseTokenAmount} from "./amount";

describe("parseTokenAmount", () => {
    it("shifts by the exponent with exact math", () => {
        expect(parseTokenAmount("1", 6)).toEqual({ok: true, base: "1000000"});
        expect(parseTokenAmount(" 0.000001 ", 6)).toEqual({ok: true, base: "1"});
        expect(parseTokenAmount("9007199254740993.1", 1)).toEqual({ok: true, base: "90071992547409931"});
        expect(parseTokenAmount("1000000000000000000000", 18)).toEqual({ok: true, base: "1000000000000000000000000000000000000000"});
    });

    it("refuses more decimals than the token has instead of cutting them", () => {
        expect(parseTokenAmount("0.1234567", 6)).toEqual({ok: false, error: "This token has at most 6 decimals."});
        expect(parseTokenAmount("1.5", 0)).toEqual({ok: false, error: "This token has no decimals: enter a whole number."});
    });

    it.each(["", "  ", "x", "1,5", ".5", "5.", "-1", "+1", "1e5", "0x10"])("refuses %j", (text) => {
        expect(parseTokenAmount(text, 6).ok).toBe(false);
    });

    it("refuses zero", () => {
        expect(parseTokenAmount("0", 6)).toEqual({ok: false, error: "The amount must be more than zero."});
        expect(parseTokenAmount("0.000", 6)).toEqual({ok: false, error: "The amount must be more than zero."});
    });
});
