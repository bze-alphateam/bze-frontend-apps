'use client'

import {useEffect, useMemo, useState} from "react";
import {getRateLimit} from "../query/rate_limit";
import {nextRateLimitReset} from "../query/rate_limit";

export type RouteLimitDirection = 'send' | 'receive';

export interface UseRouteLimitResult {
    /** Raw micro-units still allowed today; undefined when the route has no limit (or it is unknown). */
    room?: bigint;
    /** True when the limit allows nothing at all (threshold 0, e.g. 0% receive). */
    stopped: boolean;
    /** Next reset in UTC when it can be derived. */
    nextReset?: Date;
    durationHours?: number;
    loading: boolean;
}

/**
 * Daily IBC limit left on a route (chain v8.3.0), for the BZE-side `channelId` and `denom`.
 * No limit while loading and when the query fails (fail open). Reloads when the route or
 * `refreshKey` changes; the query's 30 s cache keeps that cheap.
 */
export function useRouteLimit(
    channelId: string | undefined,
    denom: string | undefined,
    dir: RouteLimitDirection,
    refreshKey?: unknown,
): UseRouteLimitResult {
    const [state, setState] = useState<{key: string; limit: Awaited<ReturnType<typeof getRateLimit>>} | undefined>(undefined);
    const key = channelId && denom ? `${channelId}|${denom}` : undefined;

    useEffect(() => {
        if (!channelId || !denom) return;
        let cancelled = false;
        getRateLimit(channelId, denom).then(limit => {
            if (!cancelled) setState({key: `${channelId}|${denom}`, limit});
        });
        return () => { cancelled = true; };
    }, [channelId, denom, refreshKey]);

    return useMemo(() => {
        // a result for another route is stale
        if (!key) return {stopped: false, loading: false};
        if (!state || state.key !== key) return {stopped: false, loading: true};
        const limit = state.limit;
        if (!limit) return {stopped: false, loading: false};
        const threshold = dir === 'send' ? limit.sendThreshold : limit.recvThreshold;
        return {
            room: dir === 'send' ? limit.sendRoom : limit.recvRoom,
            stopped: threshold === BigInt(0),
            nextReset: nextRateLimitReset(new Date(), limit.durationHours),
            durationHours: limit.durationHours,
            loading: false,
        };
    }, [key, state, dir]);
}
