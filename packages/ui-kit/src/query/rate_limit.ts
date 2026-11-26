import {getSettings} from "../storage/settings";

/**
 * IBC rate limits (chain v8.3.0, cosmos/ibc-apps rate-limiting module). Raw REST, no bzejs client.
 *
 * Keys are the BZE-side channel id and the BZE-side denom, for both directions. The chain decides:
 * this only lets the forms spare the user a failed or refunded transfer, so every failure
 * (v8.2.0 nodes answer 501/404, network errors, odd payloads) means "no limit" (fail open).
 *
 * Whitelisted sender/receiver pairs bypass limits. None exist at the v8.3.0 upgrade, so they are
 * deliberately ignored here.
 */

export interface RateLimit {
    /** What can still be sent out today; never below 0. Raw micro-units. */
    sendRoom: bigint;
    /** What can still be received today; never below 0. Raw micro-units. */
    recvRoom: bigint;
    sendThreshold: bigint;
    recvThreshold: bigint;
    durationHours: number;
}

const CACHE_TTL_MS = 30_000;

const cache = new Map<string, {at: number; value: RateLimit | null}>();
// Several components mount at once; they share one request per route.
const inFlight = new Map<string, Promise<RateLimit | null>>();

const cacheKey = (channelId: string, denom: string) => `${channelId}|${denom}`;

const toBig = (v: unknown): bigint => {
    if (typeof v !== "string" && typeof v !== "number") throw new Error("not a number");
    return BigInt(v);
}

// threshold = floor(channel_value * percent / 100); a transfer is refused when net + amount > threshold.
const direction = (channelValue: bigint, percent: bigint, net: bigint) => {
    const threshold = (channelValue * percent) / BigInt(100);
    const room = threshold - net;
    return {threshold, room: room < BigInt(0) ? BigInt(0) : room};
}

/** Parses the by_denom response body; `null` when there is no (usable) limit. Exposed through getRateLimit only. */
const parse = (body: any): RateLimit | null => {
    const limit = body?.rate_limit;
    if (!limit) return null;

    const channelValue = toBig(limit.flow?.channel_value);
    // channel_value 0 never refuses anything
    if (channelValue === BigInt(0)) return null;

    const inflow = toBig(limit.flow?.inflow);
    const outflow = toBig(limit.flow?.outflow);
    const send = direction(channelValue, toBig(limit.quota?.max_percent_send), outflow - inflow);
    const recv = direction(channelValue, toBig(limit.quota?.max_percent_recv), inflow - outflow);
    const durationHours = Number(limit.quota?.duration_hours);
    if (!Number.isFinite(durationHours) || durationHours <= 0) return null;

    return {
        sendRoom: send.room,
        recvRoom: recv.room,
        sendThreshold: send.threshold,
        recvThreshold: recv.threshold,
        durationHours,
    };
}

const fetchFresh = async (channelId: string, denom: string): Promise<RateLimit | null> => {
    const url = `${getSettings().endpoints.restEndpoint}/Stride-Labs/ibc-rate-limiting/ratelimit/ratelimit/${encodeURIComponent(channelId)}/by_denom?denom=${encodeURIComponent(denom)}`;
    try {
        const response = await fetch(url);
        if (response.status !== 200) {
            // not cached: a node upgraded later should be picked up on the next read
            return null;
        }
        const value = parse(await response.json());
        cache.set(cacheKey(channelId, denom), {at: Date.now(), value});
        return value;
    } catch (e) {
        console.error("failed to fetch IBC rate limit:", e);
        return null;
    }
}

/**
 * The daily limit on (BZE-side channel, BZE-side denom), or `null` when there is none (or it could
 * not be read). Cached for 30 s per route.
 */
export const getRateLimit = async (channelId: string, denom: string): Promise<RateLimit | null> => {
    const key = cacheKey(channelId, denom);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    let pending = inFlight.get(key);
    if (!pending) {
        pending = fetchFresh(channelId, denom).finally(() => {
            inFlight.delete(key);
        });
        inFlight.set(key, pending);
    }

    return pending;
}

/** Drops cached limits, e.g. after a transfer moved the flow. */
export const clearRateLimitCache = (): void => {
    cache.clear();
}

/**
 * When the limit's window next resets, in UTC. The chain resets a limit when its hour epoch is a
 * multiple of `durationHours`, and the epoch started at a UTC hour: so only when the duration divides
 * 24 the reset is at a UTC hour that is a multiple of it. Otherwise `undefined`.
 */
export const nextRateLimitReset = (now: Date, durationHours: number): Date | undefined => {
    if (!Number.isInteger(durationHours) || durationHours <= 0 || 24 % durationHours !== 0) return undefined;
    const nextHour = (Math.floor(now.getUTCHours() / durationHours) + 1) * durationHours;
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nextHour));
}
