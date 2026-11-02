import BigNumber from "bignumber.js";
import type { SwapRouteResult } from "@bze/bze-ui-kit";

/** Longest route the swap form asks the router for. */
export const SWAP_MAX_HOPS = 3;

/** Which field of the swap form the user typed in; the other one is derived from the quote. */
export type SwapSide = "from" | "to";

/** The one piece of amount state the swap form keeps: the field the user edited and its raw text. */
export interface SwapInput {
    side: SwapSide;
    value: string;
}

/** The routing capability the form depends on; `AmmRouter` from ui-kit satisfies it. */
export interface SwapRouter {
    findOptimalRoute(
        fromDenom: string,
        toDenom: string,
        amountIn: BigNumber,
        maxHops: number,
        useCache?: boolean,
    ): SwapRouteResult | null;
}

export interface SwapRequest {
    fromDenom: string;
    toDenom: string;
    /** The side `amount` belongs to. */
    side: SwapSide;
    /** Micro units of that side's asset. */
    amount: BigNumber;
}

export interface SwapQuote {
    route: SwapRouteResult;
    /** Micro units of the sold asset. */
    amountIn: BigNumber;
    /** Micro units of the bought asset. */
    amountOut: BigNumber;
}

/** How many tenfold steps the exact-output search may grow the input before giving up. */
const MAX_BRACKET_STEPS = 20;

/** Parses a form amount; null when empty, not a number or not positive. */
export function parseAmountInput(value: string): BigNumber | null {
    if (!value) return null;
    const amount = new BigNumber(value);
    return amount.isNaN() || !amount.isFinite() || amount.lte(0) ? null : amount;
}

/** Both prices of a quote, in whole tokens; null where its denominator is zero. */
export interface SwapRates {
    /** Bought tokens per one sold token. */
    perSold: BigNumber | null;
    /** Sold tokens per one bought token. */
    perBought: BigNumber | null;
}

/** The quote's two prices, taken from its exact micro amounts rather than the form's text. */
export function swapRates(quote: SwapQuote, fromDecimals: number, toDecimals: number): SwapRates {
    const sold = quote.amountIn.shiftedBy(-fromDecimals);
    const bought = quote.amountOut.shiftedBy(-toDecimals);
    return {
        perSold: sold.gt(0) ? bought.dividedBy(sold) : null,
        perBought: bought.gt(0) ? sold.dividedBy(bought) : null,
    };
}

/** Quotes a swap for whichever side the user typed. */
export function quoteSwap(router: SwapRouter, request: SwapRequest): SwapQuote | null {
    const { fromDenom, toDenom, side, amount } = request;
    if (fromDenom === toDenom || !amount.isFinite() || amount.lte(0)) {
        return null;
    }
    return side === "from"
        ? quoteExactInput(router, fromDenom, toDenom, amount)
        : quoteExactOutput(router, fromDenom, toDenom, amount);
}

/** Sell exactly `amountIn`; the quote carries what it buys. */
export function quoteExactInput(
    router: SwapRouter,
    fromDenom: string,
    toDenom: string,
    amountIn: BigNumber,
): SwapQuote | null {
    const route = router.findOptimalRoute(fromDenom, toDenom, amountIn, SWAP_MAX_HOPS, true);
    return route ? { route, amountIn, amountOut: route.expectedOutput } : null;
}

/**
 * Buy at least `desiredOut`: finds the smallest whole-micro input whose expected output reaches
 * the target. The input is bracketed by growing it tenfold (so any price ratio works, unlike a
 * fixed multiple of the output), then bisected; null when no pool can deliver that much.
 */
export function quoteExactOutput(
    router: SwapRouter,
    fromDenom: string,
    toDenom: string,
    desiredOut: BigNumber,
): SwapQuote | null {
    const target = desiredOut.integerValue(BigNumber.ROUND_CEIL);
    if (!target.isFinite() || target.lte(0)) {
        return null;
    }

    // An input the router has no route for buys nothing: either no pool connects the pair, or the
    // input is dust the chain would refuse (a hop with no fee or no whole-unit output), which a
    // larger input may still cure.
    const outputFor = (amountIn: BigNumber): BigNumber =>
        router.findOptimalRoute(fromDenom, toDenom, amountIn, SWAP_MAX_HOPS, true)?.expectedOutput ?? new BigNumber(0);

    // Bracket: `low` buys less than the target, `high` at least the target.
    let low = new BigNumber(0);
    let high = target;
    let highOut = outputFor(high);
    for (let step = 0; highOut.lt(target); step++) {
        if (step >= MAX_BRACKET_STEPS) {
            return null;
        }
        const next = high.multipliedBy(10);
        const nextOut = outputFor(next);
        // Once something is bought, the output must keep growing with the input; if it does not,
        // the pools cannot deliver the target.
        if (highOut.gt(0) && nextOut.lte(highOut)) {
            return null;
        }
        low = high;
        high = next;
        highOut = nextOut;
    }

    // Bisect down to the smallest whole-micro input that still reaches the target.
    while (high.minus(low).gt(1)) {
        const mid = low.plus(high).dividedBy(2).integerValue(BigNumber.ROUND_FLOOR);
        if (outputFor(mid).gte(target)) {
            high = mid;
        } else {
            low = mid;
        }
    }

    const route = router.findOptimalRoute(fromDenom, toDenom, high, SWAP_MAX_HOPS, true);
    return route ? { route, amountIn: high, amountOut: route.expectedOutput } : null;
}
