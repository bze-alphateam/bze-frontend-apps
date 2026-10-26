import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {TradeViewChart} from "@bze/bze-ui-kit";

import {chartPolylines, chartRange, chartSeries, formatChartPrice, tokenPools} from "./chart";

const candle = (time: string, close: number): TradeViewChart => ({time, close, open: close, high: close, low: close, value: 0});

describe("chartSeries", () => {
    const candles = [candle("t1", 2), candle("t2", 4), candle("t3", 0.5)];

    it("keeps the close prices when T is the pool's base", () => {
        expect(chartSeries(candles, false)).toEqual([{time: "t1", price: 2}, {time: "t2", price: 4}, {time: "t3", price: 0.5}]);
    });

    it("inverts them when T is the pool's quote", () => {
        expect(chartSeries(candles, true)).toEqual([{time: "t1", price: 0.5}, {time: "t2", price: 0.25}, {time: "t3", price: 2}]);
    });

    it("drops what isn't a finite positive price", () => {
        const odd = [candle("zero", 0), candle("nan", Number.NaN), candle("inf", Number.POSITIVE_INFINITY), candle("ok", 3)];

        expect(chartSeries(odd, false)).toEqual([{time: "ok", price: 3}]);
        // Inverted, a zero close becomes Infinity and an infinite one 0: both dropped too.
        expect(chartSeries(odd, true)).toEqual([{time: "ok", price: 1 / 3}]);
    });

    it("is empty without candles", () => {
        expect(chartSeries([], false)).toEqual([]);
    });
});

describe("chartPolylines", () => {
    it("spreads time across the width and the price range across the height, highest on top", () => {
        const {line, area} = chartPolylines([{time: "a", price: 1}, {time: "b", price: 3}, {time: "c", price: 2}], 100, 50, 5);

        expect(line).toBe("0,45 50,5 100,25");
        expect(area).toBe("0,45 50,5 100,25 100,50 0,50");
    });

    it("draws a flat series, and a single point, across the middle", () => {
        expect(chartPolylines([{time: "a", price: 2}, {time: "b", price: 2}], 100, 50).line).toBe("0,25 100,25");
        expect(chartPolylines([{time: "a", price: 2}], 100, 50).line).toBe("0,25 100,25");
    });

    it("is empty without points", () => {
        expect(chartPolylines([], 100, 50)).toEqual({line: "", area: ""});
    });
});

describe("chartRange", () => {
    it("maps each chip to its candle size and count", () => {
        expect(chartRange("7D")).toMatchObject({minutes: 60, limit: 168});
        expect(chartRange("30D")).toMatchObject({minutes: 240, limit: 180});
        expect(chartRange("90D")).toMatchObject({minutes: 1440, limit: 90});
    });
});

describe("formatChartPrice", () => {
    it("keeps 4 decimals from 1 up and 4 significant digits below", () => {
        expect(formatChartPrice(12345.678912)).toBe("12,345.6789");
        expect(formatChartPrice(2)).toBe("2");
        expect(formatChartPrice(0.000012345678)).toBe("0.00001235");
        expect(formatChartPrice(0.5)).toBe("0.5");
    });
});

describe("tokenPools", () => {
    const T = "factory/bze1owner/upage";
    const pool = (base: string, quote: string) => ({id: `${base}_${quote}`, base, quote});
    const pools = [pool(T, "ubze"), pool("uatom", T), pool("ubze", "uusdc"), pool(T, "uusdc")];

    it("keeps T's pools, the most USD liquidity first", () => {
        const usd: Record<string, number> = {[`${T}_ubze`]: 100, [`uatom_${T}`]: 900, [`${T}_uusdc`]: 300};
        const value = (id: string) => (usd[id] === undefined ? undefined : new BigNumber(usd[id]));

        expect(tokenPools(T, pools, value).map((p) => p.id)).toEqual([`uatom_${T}`, `${T}_uusdc`, `${T}_ubze`]);
    });

    it("keeps the pool order for pools without liquidity data, after the ones with it", () => {
        const value = (id: string) => (id === `${T}_uusdc` ? new BigNumber(1) : undefined);

        expect(tokenPools(T, pools, value).map((p) => p.id)).toEqual([`${T}_uusdc`, `${T}_ubze`, `uatom_${T}`]);
    });

    it("is empty when T sits in no pool", () => {
        expect(tokenPools("uother", pools, () => undefined)).toEqual([]);
    });
});
