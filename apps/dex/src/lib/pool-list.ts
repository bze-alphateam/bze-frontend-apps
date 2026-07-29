import { toBigNumber } from "@bze/bze-ui-kit";
import type { Balance, LiquidityPoolData } from "@bze/bze-ui-kit";
import type { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";

// Pure list logic for the liquidity pools page, extracted so it can be
// unit-tested without React / next / wallet wiring. Free of next/* and React
// imports; the page passes its context-hook lookups (`denomTicker`,
// `getBalanceByDenom`) in as plain functions.

export type PoolSortField = "volume24h" | "totalLiquidity" | "apr";
export type PoolSortOrder = "asc" | "desc";

/**
 * Pools sorted by the chosen metric. Pools with no market data sort last (in
 * either direction). Returns a new array — the input, which comes straight from
 * a shared context/hook, is never sorted in place.
 */
export function sortPools(
    pools: readonly LiquidityPoolSDKType[],
    poolsData: Map<string, LiquidityPoolData>,
    sortField: PoolSortField,
    sortOrder: PoolSortOrder,
): LiquidityPoolSDKType[] {
    return [...pools].sort((poolA, poolB) => {
        const poolAData = poolsData.get(poolA.id);
        const poolBData = poolsData.get(poolB.id);
        if (!poolAData && !poolBData) return 0;
        if (!poolAData) return 1;
        if (!poolBData) return -1;

        let valueA = poolAData.usdVolume;
        let valueB = poolBData.usdVolume;
        if (sortField === "totalLiquidity") {
            valueA = poolAData.usdValue;
            valueB = poolBData.usdValue;
        } else if (sortField === "apr") {
            valueA = toBigNumber(poolAData.apr);
            valueB = toBigNumber(poolBData.apr);
        }

        if (sortOrder === "asc") {
            return valueA.minus(valueB).toNumber();
        }

        return valueB.minus(valueA).toNumber();
    });
}

/**
 * Pools whose base or quote ticker (or the `base-quote` pair) contains the search
 * term, case-insensitively. An empty term matches every pool. Ticker resolution
 * is delegated to the caller's `denomTicker` so this stays free of chain state.
 */
export function filterPoolsBySearch<T extends { base: string; quote: string }>(
    pools: readonly T[],
    denomTicker: (denom: string) => string,
    searchTerm: string,
): T[] {
    const searchLower = searchTerm.toLowerCase();
    return pools.filter((pool) => {
        const baseTicker = denomTicker(pool.base).toLowerCase();
        const quoteTicker = denomTicker(pool.quote).toLowerCase();

        return (
            baseTicker.includes(searchLower) ||
            quoteTicker.includes(searchLower) ||
            `${baseTicker}-${quoteTicker}`.toLowerCase().includes(searchLower)
        );
    });
}

export interface PartitionedPools<T> {
    userPools: T[];
    otherPools: T[];
}

/**
 * Split pools into ones the user provides liquidity to (a positive LP-token
 * balance) and everything else. A missing or zero balance lands in `otherPools`.
 */
export function partitionUserPools<T extends { lp_denom: string }>(
    pools: readonly T[],
    getBalanceByDenom: (denom: string) => Balance | undefined,
): PartitionedPools<T> {
    const userPools = pools.filter((pool) => {
        const balance = getBalanceByDenom(pool.lp_denom);
        return balance !== undefined && balance.amount.gt(0);
    });

    const otherPools = pools.filter((pool) => {
        const balance = getBalanceByDenom(pool.lp_denom);
        return !balance || balance.amount.isZero();
    });

    return { userPools, otherPools };
}
