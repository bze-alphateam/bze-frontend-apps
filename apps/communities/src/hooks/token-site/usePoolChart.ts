'use client';

import {useEffect, useMemo, useState} from "react";
import {getTradingViewIntervals, type TradeViewChart} from "@bze/bze-ui-kit";

import {type ChartPoint, type ChartRange, chartRange, chartSeries} from "@/lib/token-site/chart";

export interface PoolChart {
    points: ChartPoint[];
    isLoading: boolean;
}

interface Loaded {
    key: string;
    intervals: TradeViewChart[];
}

/**
 * The price of T in one of its pools over `range` (Business Logic R8), from the aggregator's
 * candles for the pool id (`{base}_{quote}`): "X per T", inverted when T is the pool's quote.
 */
export function usePoolChart(poolId: string | undefined, tokenIsQuote: boolean, range: ChartRange): PoolChart {
    const {minutes, limit} = chartRange(range);
    const key = poolId ? `${poolId}|${minutes}|${limit}` : "";
    const [loaded, setLoaded] = useState<Loaded>();

    useEffect(() => {
        if (!poolId) return;

        let current = true;
        void getTradingViewIntervals(poolId, minutes, limit).then((intervals) => {
            if (current) setLoaded({key: `${poolId}|${minutes}|${limit}`, intervals});
        });

        return () => {
            current = false;
        };
    }, [poolId, minutes, limit]);

    // Until this pool and range answer, the previous series would be the wrong one.
    const intervals = loaded?.key === key ? loaded.intervals : undefined;
    const points = useMemo(() => (intervals ? chartSeries(intervals, tokenIsQuote) : []), [intervals, tokenIsQuote]);

    return {points, isLoading: Boolean(poolId) && intervals === undefined};
}
