'use client';

import {useCallback, useMemo, useState} from "react";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {bze} from "@bze/bzejs";
import {
    ammRouter,
    amountToBigNumberUAmount,
    getChainName,
    type SwapRouteResult,
    uAmountToBigNumberAmount,
    useAssets,
    useBZETx,
    useLiquidityPools,
} from "@bze/bze-ui-kit";

import {isTradable, MAX_SWAP_HOPS, minimumOutput} from "@/lib/token-site/swap";

const {multiSwap} = bze.tradebin.MessageComposer.withTypeUrl;

/** `buy` swaps another token into T, `sell` swaps T into another token. */
export type SwapDirection = "buy" | "sell";

export interface TokenSwapParams {
    direction: SwapDirection;
    /** The token on the other side of T; undefined while none is picked. */
    other?: string;
    /** What goes in, in display units, as typed. */
    amountIn: string;
    /** Slippage tolerance in percent. */
    slippage: number;
}

export interface TokenSwap {
    from?: string;
    to?: string;
    /** Whether T sits in any pool; nothing can be swapped otherwise (R8). */
    isTradable: boolean;
    /** The amount in, in base units; undefined when the input is empty or not a positive number. */
    uAmountIn?: BigNumber;
    /** The expected output in display units of `to`. */
    expectedOut?: BigNumber;
    /** The least the swap may pay out (expected output less the slippage), in base units of `to`. */
    uMinOut?: BigNumber;
    /** Price impact in percent. */
    priceImpact?: BigNumber;
    route: SwapRouteResult | null;
    /** Why the amount can't be swapped as far as routing goes; '' when it can. */
    error: string;
    /** Signs and broadcasts the swap; true when the chain accepted it. */
    submit: () => Promise<boolean>;
    isSubmitting: boolean;
    progressTrack: string;
}

/**
 * An instant swap between T (`denom`) and another token through the AMM pools (Business Logic R8):
 * the best route of at most 3 hops, and a `multiSwap` whose minimum output is the expected output
 * less the slippage, so the chain fails the swap rather than fill worse. Shared by the wallet's Get
 * tab and the Trade section.
 */
export function useTokenSwap(denom: string, {direction, other, amountIn, slippage}: TokenSwapParams): TokenSwap {
    const {address} = useChain(getChainName());
    const {pools} = useLiquidityPools();
    const {denomDecimals} = useAssets();
    const {tx, progressTrack} = useBZETx();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const from = direction === "buy" ? other : denom;
    const to = direction === "buy" ? denom : other;
    const tradable = isTradable(denom, pools);

    // The router is shared app-wide; feed it the current pools before asking it for a route.
    const router = useMemo(() => {
        if (pools.length > 0) ammRouter.updatePools(pools);
        return ammRouter;
    }, [pools]);

    const uAmountIn = useMemo(() => {
        if (!from) return undefined;
        const amount = new BigNumber(amountIn);
        if (amount.isNaN() || !amount.gt(0)) return undefined;

        return amountToBigNumberUAmount(amount, denomDecimals(from)).integerValue(BigNumber.ROUND_FLOOR);
    }, [amountIn, denomDecimals, from]);

    const route = useMemo(() => {
        if (!tradable || !from || !to || !uAmountIn?.gt(0)) return null;
        try {
            return router.findOptimalRoute(from, to, uAmountIn, MAX_SWAP_HOPS);
        } catch (error) {
            console.error("Failed to find a swap route:", error);
            return null;
        }
    }, [router, tradable, from, to, uAmountIn]);

    const error = tradable && uAmountIn?.gt(0) && !route ? "No route for this amount" : "";
    const uMinOut = route ? minimumOutput(route.expectedOutput, slippage) : undefined;

    const submit = useCallback(async () => {
        if (!address || !route || !from || !to || !uAmountIn) return false;

        const msg = multiSwap({
            creator: address,
            routes: route.route,
            input: {denom: from, amount: uAmountIn.toFixed(0)},
            // The router only returns routes with a whole-unit output, so 1 never exceeds it;
            // the chain rejects a zero minimum output.
            minOutput: {denom: to, amount: BigNumber.max(minimumOutput(route.expectedOutput, slippage), 1).toFixed(0)},
        });
        setIsSubmitting(true);
        try {
            return await tx([msg]);
        } finally {
            setIsSubmitting(false);
        }
    }, [address, route, from, to, uAmountIn, slippage, tx]);

    return {
        from,
        to,
        isTradable: tradable,
        uAmountIn,
        expectedOut: route && to ? uAmountToBigNumberAmount(route.expectedOutput, denomDecimals(to)) : undefined,
        uMinOut,
        priceImpact: route?.priceImpact,
        route,
        error,
        submit,
        isSubmitting,
        progressTrack,
    };
}
