import BigNumber from "bignumber.js";

/** Longest route a swap may take (Business Logic R8). */
export const MAX_SWAP_HOPS = 3;

/** The slippage chips, in percent; 1 % is preselected. */
export const SLIPPAGE_OPTIONS = [0.5, 1, 2] as const;
export const DEFAULT_SLIPPAGE = 1;

/** A pool as the routing needs it: its two denoms. */
export interface PoolPair {
    base: string;
    quote: string;
}

/** A held token the Get tab could pay with. */
export interface HeldToken {
    denom: string;
    /** Base units. */
    amount: BigNumber;
    USDValue: BigNumber;
}

/**
 * The least the swap may return (base units): the expected output minus the slippage, rounded down,
 * so the chain fails the swap rather than fill below what the user accepted (R8).
 */
export function minimumOutput(expected: BigNumber, slippagePercent: number): BigNumber {
    return expected
        .multipliedBy(new BigNumber(100).minus(slippagePercent))
        .dividedBy(100)
        .integerValue(BigNumber.ROUND_FLOOR);
}

/** Price impact for display: two decimals, "<0.01%" for anything smaller but not zero. */
export function formatPriceImpact(percent: BigNumber): string {
    if (percent.lte(0)) return "0%";
    if (percent.lt("0.01")) return "<0.01%";

    return `${percent.toFixed(2, BigNumber.ROUND_HALF_UP)}%`;
}

/** Whether `denom` sits in at least one pool; a token in none is not tradable yet (R8). */
export function isTradable(denom: string, pools: PoolPair[]): boolean {
    return pools.some((pool) => pool.base === denom || pool.quote === denom);
}

/** Every denom that reaches `target` through at most `maxHops` pools (`target` excluded). */
export function denomsWithRoute(target: string, pools: PoolPair[], maxHops = MAX_SWAP_HOPS): Set<string> {
    const neighbours = new Map<string, string[]>();
    const link = (from: string, to: string) => neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
    for (const pool of pools) {
        link(pool.base, pool.quote);
        link(pool.quote, pool.base);
    }

    const reached = new Set<string>([target]);
    let frontier = [target];
    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
        const next: string[] = [];
        for (const denom of frontier) {
            for (const neighbour of neighbours.get(denom) ?? []) {
                if (reached.has(neighbour)) continue;
                reached.add(neighbour);
                next.push(neighbour);
            }
        }
        frontier = next;
    }
    reached.delete(target);

    return reached;
}

/**
 * The tokens the Get tab offers to pay with: held (non-zero), not T itself, and with a route to T.
 * Highest USD value first, so the first one is the default.
 */
export function payableTokens<H extends HeldToken>(held: H[], target: string, pools: PoolPair[]): H[] {
    const routable = denomsWithRoute(target, pools);

    return held
        .filter((token) => token.denom !== target && token.amount.gt(0) && routable.has(token.denom))
        .sort((a, b) => b.USDValue.comparedTo(a.USDValue) ?? 0);
}

/**
 * The tokens T can be sold into: every denom with a route of at most 3 hops from T that has a
 * known asset, `preferred` (BZE) first as the default, then by ticker.
 */
export function receivableTokens<A extends { denom: string; ticker: string }>(
    target: string,
    pools: PoolPair[],
    assetOf: (denom: string) => A | undefined,
    preferred: string,
): A[] {
    return [...denomsWithRoute(target, pools)]
        .map(assetOf)
        .filter((asset): asset is A => asset !== undefined)
        .sort((a, b) => Number(b.denom === preferred) - Number(a.denom === preferred) || a.ticker.localeCompare(b.ticker));
}
