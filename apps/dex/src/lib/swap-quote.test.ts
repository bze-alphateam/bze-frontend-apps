import { describe, it, expect, vi } from "vitest";
import BigNumber from "bignumber.js";
import { createAmmRouter } from "@bze/bze-ui-kit";
import type { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";
import {
    parseAmountInput,
    quoteExactInput,
    quoteExactOutput,
    quoteSwap,
    SWAP_MAX_HOPS,
    type SwapRouter,
} from "./swap-quote";

function pool(id: string, base: string, quote: string, reserveBase: string, reserveQuote: string, fee = "0.003"): LiquidityPoolSDKType {
    return {
        id,
        base,
        quote,
        lp_denom: `ulp${id}`,
        creator: "bze1creator",
        fee,
        reserve_base: reserveBase,
        reserve_quote: reserveQuote,
        stable: false,
    };
}

// 5,000,000 BZE against 1,000 USDC: ~0.0002 USDC per BZE, so selling BZE for USDC has an
// input/output ratio of ~5,000 — far beyond the 10x bracket the old reverse search assumed.
const bzeUsdc = pool("1", "ubze", "uusdc", "5000000000000", "1000000000");
// A second hop for multi-hop quotes: 1,000 USDC against 100 ATOM.
const usdcAtom = pool("2", "uusdc", "uatom", "1000000000", "100000000");

/** The chain's single-hop output: fee and output truncated to whole micro units, like `swapTokens`. */
function constantProductOut(reserveIn: string, reserveOut: string, amountIn: BigNumber, fee = "0.003"): BigNumber {
    const feeAmount = amountIn.multipliedBy(fee).integerValue(BigNumber.ROUND_FLOOR);
    const inAfterFee = amountIn.minus(feeAmount);
    return inAfterFee.multipliedBy(reserveOut).dividedBy(new BigNumber(reserveIn).plus(inAfterFee)).integerValue(BigNumber.ROUND_FLOOR);
}

describe("parseAmountInput", () => {
    it("accepts positive numbers only", () => {
        expect(parseAmountInput("1000")?.toFixed()).toBe("1000");
        expect(parseAmountInput("0.5")?.toFixed()).toBe("0.5");
        expect(parseAmountInput("")).toBeNull();
        expect(parseAmountInput("0")).toBeNull();
        expect(parseAmountInput("-1")).toBeNull();
        expect(parseAmountInput("abc")).toBeNull();
        expect(parseAmountInput(".")).toBeNull();
    });
});

describe("quoteExactInput", () => {
    it("prices the sold amount through the pool", () => {
        const router = createAmmRouter([bzeUsdc]);
        const amountIn = new BigNumber("1000000000"); // 1000 BZE

        const quote = quoteExactInput(router, "ubze", "uusdc", amountIn);

        expect(quote).not.toBeNull();
        expect(quote!.amountIn).toBe(amountIn);
        // 1,000 BZE: fee 3,000,000, real 997,000,000, floor(997e6 * 1e9 / (5e12 + 997e6)) = 199,360.
        expect(quote!.amountOut.toFixed()).toBe("199360");
        expect(quote!.amountOut.toFixed()).toBe(constantProductOut(bzeUsdc.reserve_base, bzeUsdc.reserve_quote, amountIn).toFixed());
        expect(quote!.route.route).toEqual(["1"]);
    });

    it("is null when no pool connects the assets", () => {
        const router = createAmmRouter([bzeUsdc]);
        expect(quoteExactInput(router, "ubze", "uatom", new BigNumber(1000))).toBeNull();
    });
});

describe("quoteExactOutput", () => {
    it("finds the smallest whole-micro input that buys the target, even at a 5000:1 price ratio", () => {
        const router = createAmmRouter([bzeUsdc]);
        const target = new BigNumber("197332"); // 0.197332 USDC

        const quote = quoteExactOutput(router, "ubze", "uusdc", target);

        expect(quote).not.toBeNull();
        expect(quote!.amountIn.isInteger()).toBe(true);
        expect(quote!.amountOut.gte(target)).toBe(true);
        // One micro less no longer reaches the target: the input is minimal.
        const oneLess = quoteExactInput(router, "ubze", "uusdc", quote!.amountIn.minus(1));
        expect(oneLess!.amountOut.lt(target)).toBe(true);
        // Sanity: ~0.197 USDC costs on the order of 1000 BZE here.
        expect(quote!.amountIn.shiftedBy(-6).toNumber()).toBeGreaterThan(900);
        expect(quote!.amountIn.shiftedBy(-6).toNumber()).toBeLessThan(1100);
    });

    it("works in the cheap direction too, where the first guess already overshoots", () => {
        const router = createAmmRouter([bzeUsdc]);
        const target = new BigNumber("1000000000"); // 1000 BZE

        const quote = quoteExactOutput(router, "uusdc", "ubze", target);

        expect(quote).not.toBeNull();
        expect(quote!.amountOut.gte(target)).toBe(true);
        const oneLess = quoteExactInput(router, "uusdc", "ubze", quote!.amountIn.minus(1));
        expect(oneLess!.amountOut.lt(target)).toBe(true);
    });

    it("rounds a fractional micro target up, so the user never gets less than typed", () => {
        const router = createAmmRouter([bzeUsdc]);

        const quote = quoteExactOutput(router, "uusdc", "ubze", new BigNumber("1000000000.4"));

        expect(quote!.amountOut.gte("1000000001")).toBe(true);
    });

    it("bisects on whole-unit outputs, so the input bought is what the chain pays", () => {
        const router = createAmmRouter([bzeUsdc]);
        const target = new BigNumber("199360");

        const quote = quoteExactOutput(router, "ubze", "uusdc", target);

        expect(quote).not.toBeNull();
        expect(quote!.amountOut.isInteger()).toBe(true);
        expect(quote!.amountOut.toFixed()).toBe(constantProductOut(bzeUsdc.reserve_base, bzeUsdc.reserve_quote, quote!.amountIn).toFixed());
        expect(quote!.amountOut.gte(target)).toBe(true);
        expect(constantProductOut(bzeUsdc.reserve_base, bzeUsdc.reserve_quote, quote!.amountIn.minus(1)).lt(target)).toBe(true);
    });

    it("routes through several pools", () => {
        const router = createAmmRouter([bzeUsdc, usdcAtom]);
        const target = new BigNumber("1000000"); // 1 ATOM

        const quote = quoteExactOutput(router, "ubze", "uatom", target);

        expect(quote).not.toBeNull();
        expect(quote!.route.route).toEqual(["1", "2"]);
        expect(quote!.amountOut.gte(target)).toBe(true);
    });

    it("is null when the pools cannot deliver the target at any price", () => {
        const router = createAmmRouter([bzeUsdc]);
        // More USDC than the pool holds.
        expect(quoteExactOutput(router, "ubze", "uusdc", new BigNumber("2000000000"))).toBeNull();
    });

    it("is null for a missing route or a non-positive target", () => {
        const router = createAmmRouter([bzeUsdc]);
        expect(quoteExactOutput(router, "ubze", "uatom", new BigNumber(1000))).toBeNull();
        expect(quoteExactOutput(router, "ubze", "uusdc", new BigNumber(0))).toBeNull();
        expect(quoteExactOutput(router, "ubze", "uusdc", new BigNumber(-5))).toBeNull();
    });

    it("stops growing the bracket when the output stalls instead of looping", () => {
        // A router whose output never grows past 100, whatever the input.
        const findOptimalRoute = vi.fn((_f: string, _t: string, amountIn: BigNumber) => ({
            route: ["x"], path: ["a", "b"], pools: [], priceImpact: new BigNumber(0), totalFees: new BigNumber(0), feesPerHop: [],
            expectedOutput: BigNumber.min(amountIn, 100),
        }));
        const router: SwapRouter = { findOptimalRoute };

        expect(quoteExactOutput(router, "a", "b", new BigNumber(1000))).toBeNull();
        expect(findOptimalRoute.mock.calls.length).toBeLessThan(10);
        expect(findOptimalRoute).toHaveBeenCalledWith("a", "b", expect.anything(), SWAP_MAX_HOPS, true);
    });
});

describe("quoteSwap", () => {
    it("dispatches on the typed side", () => {
        const router = createAmmRouter([bzeUsdc]);
        const amount = new BigNumber("1000000000");

        const bySold = quoteSwap(router, { fromDenom: "ubze", toDenom: "uusdc", side: "from", amount });
        const byBought = quoteSwap(router, { fromDenom: "uusdc", toDenom: "ubze", side: "to", amount });

        expect(bySold!.amountIn).toBe(amount);
        expect(byBought!.amountOut.gte(amount)).toBe(true);
    });

    it("refuses the same asset on both sides and non-positive amounts", () => {
        const router = createAmmRouter([bzeUsdc]);
        expect(quoteSwap(router, { fromDenom: "ubze", toDenom: "ubze", side: "from", amount: new BigNumber(1) })).toBeNull();
        expect(quoteSwap(router, { fromDenom: "ubze", toDenom: "uusdc", side: "from", amount: new BigNumber(0) })).toBeNull();
        expect(quoteSwap(router, { fromDenom: "ubze", toDenom: "uusdc", side: "to", amount: new BigNumber(NaN) })).toBeNull();
    });
});
