import BigNumber from "bignumber.js";
import { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";
import { toBigNumber } from "../utils/amount";
import {SwapRouteResult} from "../types/liquidity_pool";

export class AmmRouter {
    private static instance: AmmRouter;
    private routeMap: Map<string, Map<string, LiquidityPoolSDKType>> = new Map();

    private constructor() {}

    static getInstance(): AmmRouter {
        if (!AmmRouter.instance) {
            AmmRouter.instance = new AmmRouter();
        }
        return AmmRouter.instance;
    }

    /**
     * A standalone router over exactly these pools. Unlike the shared `ammRouter` singleton it
     * holds no global state, so a component can derive one from its pools (e.g. in a `useMemo`)
     * and quote synchronously during render, with quotes that follow pool updates.
     */
    static withPools(pools: LiquidityPoolSDKType[]): AmmRouter {
        const router = new AmmRouter();
        router.updatePools(pools);
        return router;
    }

    updatePools(pools: LiquidityPoolSDKType[]): void {
        this.routeMap = this.mapLiquidityPoolRoutes(pools);
    }

    private mapLiquidityPoolRoutes(
        pools: LiquidityPoolSDKType[]
    ): Map<string, Map<string, LiquidityPoolSDKType>> {
        const routeMap = new Map<string, Map<string, LiquidityPoolSDKType>>();

        for (const pool of pools) {
            if (!routeMap.has(pool.base)) {
                routeMap.set(pool.base, new Map());
            }
            routeMap.get(pool.base)!.set(pool.quote, pool);

            if (!routeMap.has(pool.quote)) {
                routeMap.set(pool.quote, new Map());
            }
            routeMap.get(pool.quote)!.set(pool.base, pool);
        }

        return routeMap;
    }

    private calculateTheoreticalOutputs(
        pools: LiquidityPoolSDKType[],
        path: string[],
        amountIn: BigNumber
    ): { withoutFees: BigNumber; withFees: BigNumber } {
        let theoreticalOutputNoFees = amountIn;
        let theoreticalOutputWithFees = amountIn;

        for (let i = 0; i < pools.length; i++) {
            const pool = pools[i];
            const currentDenom = path[i];
            const isBaseToQuote = pool.base === currentDenom;

            const reserveIn = toBigNumber(isBaseToQuote ? pool.reserve_base : pool.reserve_quote);
            const reserveOut = toBigNumber(isBaseToQuote ? pool.reserve_quote : pool.reserve_base);
            const midPrice = reserveOut.dividedBy(reserveIn);

            theoreticalOutputNoFees = theoreticalOutputNoFees.multipliedBy(midPrice);

            const fee = toBigNumber(pool.fee);
            theoreticalOutputWithFees = theoreticalOutputWithFees
                .multipliedBy(toBigNumber(1).minus(fee))
                .multipliedBy(midPrice);
        }

        return {
            withoutFees: theoreticalOutputNoFees,
            withFees: theoreticalOutputWithFees
        };
    }

    /**
     * One hop priced the way the chain's `swapTokens` prices it: the fee and the output are
     * truncated to whole micro units, so the quote never promises a fraction the chain does not
     * pay out. A hop the chain would refuse (no fee left on a fee-bearing pool, or no output)
     * yields an output of 0, which the route search drops.
     */
    private calculateSwapOutput(
        pool: LiquidityPoolSDKType,
        amountIn: BigNumber,
        isBaseToQuote: boolean
    ): { amountOut: BigNumber; fee: BigNumber } {
        const fee = toBigNumber(pool.fee);
        const reserveIn = toBigNumber(isBaseToQuote ? pool.reserve_base : pool.reserve_quote);
        const reserveOut = toBigNumber(isBaseToQuote ? pool.reserve_quote : pool.reserve_base);

        const feeAmount = amountIn.multipliedBy(fee).integerValue(BigNumber.ROUND_FLOOR);
        if (fee.gt(0) && feeAmount.lte(0)) {
            return { amountOut: toBigNumber(0), fee: feeAmount };
        }
        const amountInAfterFee = amountIn.minus(feeAmount);

        const amountOut = amountInAfterFee
            .multipliedBy(reserveOut)
            .dividedBy(reserveIn.plus(amountInAfterFee))
            .integerValue(BigNumber.ROUND_FLOOR);

        return { amountOut, fee: feeAmount };
    }

    /**
     * The best route for exactly this input. Which route is best depends on the amount: a thin
     * pool can beat a deep one on price for a small input and lose badly for a large one, so a
     * route must never be reused for another amount.
     */
    findOptimalRoute(
        fromDenom: string,
        toDenom: string,
        amountIn: BigNumber,
        maxHops: number
    ): SwapRouteResult | null {
        if (fromDenom === toDenom) {
            return null;
        }

        interface RouteNode {
            denom: string;
            amount: BigNumber;
            path: string[];
            poolIds: string[];
            pools: LiquidityPoolSDKType[];
            fees: BigNumber[];
            hops: number;
        }

        const queue: RouteNode[] = [{
            denom: fromDenom,
            amount: amountIn,
            path: [fromDenom],
            poolIds: [],
            pools: [],
            fees: [],
            hops: 0
        }];

        const bestAmounts = new Map<string, BigNumber>();
        bestAmounts.set(fromDenom, amountIn);

        let bestRoute: RouteNode | null = null;

        while (queue.length > 0) {
            queue.sort((a, b) => b.amount.comparedTo(a.amount) ?? 0);
            const current = queue.shift()!;

            if (current.denom === toDenom) {
                if (!bestRoute || current.amount.isGreaterThan(bestRoute.amount)) {
                    bestRoute = current;
                }
                continue;
            }

            if (current.hops >= maxHops) {
                continue;
            }

            const neighbors = this.routeMap.get(current.denom);
            if (!neighbors) continue;

            for (const [nextDenom, pool] of neighbors.entries()) {
                if (current.path.includes(nextDenom)) {
                    continue;
                }

                const isBaseToQuote = pool.base === current.denom;

                const { amountOut, fee } = this.calculateSwapOutput(pool, current.amount, isBaseToQuote);

                if (amountOut.lte(0)) {
                    continue;
                }

                const previousBest = bestAmounts.get(nextDenom);
                if (previousBest && amountOut.lte(previousBest)) {
                    continue;
                }

                bestAmounts.set(nextDenom, amountOut);

                queue.push({
                    denom: nextDenom,
                    amount: amountOut,
                    path: [...current.path, nextDenom],
                    poolIds: [...current.poolIds, pool.id],
                    pools: [...current.pools, pool],
                    fees: [...current.fees, fee],
                    hops: current.hops + 1
                });
            }
        }

        if (!bestRoute) {
            return null;
        }

        const theoretical = this.calculateTheoreticalOutputs(bestRoute.pools, bestRoute.path, amountIn);

        const totalFees = theoretical.withoutFees.minus(theoretical.withFees);
        const priceImpact = theoretical.withFees.isZero()
            ? toBigNumber(0)
            : theoretical.withFees.minus(bestRoute.amount).dividedBy(theoretical.withFees).multipliedBy(100);

        return {
            route: bestRoute.poolIds,
            path: bestRoute.path,
            pools: bestRoute.pools,
            expectedOutput: bestRoute.amount,
            priceImpact,
            totalFees,
            feesPerHop: bestRoute.fees
        };
    }
}

export const ammRouter = AmmRouter.getInstance();

export function createAmmRouter(pools: LiquidityPoolSDKType[]): AmmRouter {
    return AmmRouter.withPools(pools);
}
