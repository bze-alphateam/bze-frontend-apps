import BigNumber from "bignumber.js";
import type {TradeViewChart} from "@bze/bze-ui-kit";

/** The chart's range chips: candle size (minutes) and how many candles cover the range. */
export const CHART_RANGES = [
    {label: "7D", minutes: 60, limit: 168},
    {label: "30D", minutes: 240, limit: 180},
    {label: "90D", minutes: 1440, limit: 90},
] as const;

export type ChartRange = (typeof CHART_RANGES)[number]["label"];
export const DEFAULT_CHART_RANGE: ChartRange = "30D";

export const chartRange = (label: ChartRange) => CHART_RANGES.find((range) => range.label === label) ?? CHART_RANGES[1];

/** One point of the line: when, and the price of T in the pool's other token. */
export interface ChartPoint {
    time: string;
    price: number;
}

/**
 * The pool's candles as "X per T" close prices. The aggregator prices the pool's base in its
 * quote, so they are inverted when T is the quote; anything that isn't a finite positive price
 * (a zero close inverted, a malformed candle) is dropped.
 */
export function chartSeries(intervals: TradeViewChart[], tokenIsQuote: boolean): ChartPoint[] {
    return intervals
        .map((interval) => ({time: interval.time, price: tokenIsQuote ? 1 / interval.close : interval.close}))
        .filter((point) => Number.isFinite(point.price) && point.price > 0);
}

/**
 * The SVG `points` of the line and of its area in a `width` × `height` box: time runs left to
 * right, the lowest price sits at the bottom and the highest at the top, with `pad` kept free
 * above and below. A flat series is drawn across the middle; a single point as a flat line.
 */
export function chartPolylines(points: ChartPoint[], width: number, height: number, pad = 0): { line: string; area: string } {
    if (points.length === 0) return {line: "", area: ""};

    const prices = points.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = max - min;
    const usable = height - 2 * pad;
    const y = (price: number) => (spread === 0 ? height / 2 : pad + usable - ((price - min) / spread) * usable);
    const x = (index: number) => (points.length === 1 ? [0, width][index] : (index / (points.length - 1)) * width);
    const round = (value: number) => Math.round(value * 100) / 100;

    const coords = points.length === 1
        ? [[0, y(points[0].price)], [width, y(points[0].price)]]
        : points.map((point, index) => [x(index), y(point.price)]);
    const line = coords.map(([px, py]) => `${round(px)},${round(py)}`).join(" ");

    return {line, area: `${line} ${width},${height} 0,${height}`};
}

/** A price for the chart header: up to 4 decimals from 1 up, 4 significant digits below. */
export function formatChartPrice(price: number): string {
    const value = new BigNumber(price);
    if (value.gte(1)) return value.decimalPlaces(4, BigNumber.ROUND_HALF_UP).toFormat();

    return new BigNumber(value.toPrecision(4)).toFormat();
}

interface ChartPool {
    id: string;
    base: string;
    quote: string;
}

/**
 * The pools T sits in, the one with the most USD liquidity first (the chart's default);
 * pools without liquidity data keep their order after the ones that have it.
 */
export function tokenPools<P extends ChartPool>(denom: string, pools: P[], usdValue: (poolId: string) => BigNumber | undefined): P[] {
    const value = (pool: P) => usdValue(pool.id) ?? new BigNumber(-1);

    return pools
        .filter((pool) => pool.base === denom || pool.quote === denom)
        .map((pool, index) => ({pool, index}))
        .sort((a, b) => value(b.pool).comparedTo(value(a.pool)) || a.index - b.index)
        .map(({pool}) => pool);
}
