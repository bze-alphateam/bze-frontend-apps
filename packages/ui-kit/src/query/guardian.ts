import {getSettings} from "../storage/settings";
import {getFromLocalStorage, removeFromLocalStorage, setInLocalStorage} from "../storage/storage";

/**
 * x/guardian readers (chain v8.3.0). Raw REST because bzejs 3.2.0 has no guardian client.
 * v8.2.0 nodes answer these routes with HTTP 501: that, any other non-200 and any network error
 * mean "nothing closed / blocked / paused" (fail open — the chain enforces the switches anyway,
 * the UI only spares the user a refused tx). Failures are never cached.
 */

const CACHE_TTL_SECONDS = 60; // setInLocalStorage takes seconds
// A hung node must not block the bridge: a read gives up after this long and fails open.
const FETCH_TIMEOUT_MS = 3000;

const CLOSED_CHANNELS_KEY = "guardian:closed_channels";
const BLOCKED_DENOMS_KEY = "guardian:blocked_denoms";
const AUTOMATION_PAUSED_KEY = "guardian:automation_paused";

// Several components mount at once; they share one request per reader instead of racing the cache.
const inFlight = new Map<string, Promise<unknown>>();
// A v8.2.0 node answers 501 on every mount: log the failure once per reader, not on every call.
const logged = new Set<string>();
// Bumped by an invalidation: a read that started before it must not write its (older) answer to the cache.
const generation = new Map<string, number>();

const guardianUrl = (path: string): string => `${getSettings().endpoints.restEndpoint}/bze/guardian/v1/${path}`;

const fetchWithTimeout = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`timed out after ${FETCH_TIMEOUT_MS} ms`));
        }, FETCH_TIMEOUT_MS);
    });
    try {
        return await Promise.race([fetch(url, {signal: controller.signal}), timeout]);
    } finally {
        clearTimeout(timer);
    }
}

const readCache = <T>(key: string, isValid: (v: unknown) => v is T): T | undefined => {
    const cached = getFromLocalStorage(key);
    if (!cached) return undefined;
    try {
        const parsed = JSON.parse(cached);
        return isValid(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(i => typeof i === "string");
const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";

const cachedReader = <T>(
    key: string,
    path: string,
    fallback: T,
    isValid: (v: unknown) => v is T,
    pick: (body: Record<string, unknown>) => unknown,
): () => Promise<T> => {
    const fetchFresh = async (): Promise<T> => {
        const startedAt = generation.get(key) ?? 0;
        const isCurrent = () => (generation.get(key) ?? 0) === startedAt;
        try {
            const response = await fetchWithTimeout(guardianUrl(path));
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}`);
            }
            const value = pick(await response.json());
            if (!isValid(value)) {
                throw new Error("unexpected response shape");
            }
            if (isCurrent()) setInLocalStorage(key, JSON.stringify(value), CACHE_TTL_SECONDS);

            return value;
        } catch (e) {
            if (!logged.has(key)) {
                logged.add(key);
                console.error(`failed to fetch guardian ${path}:`, e);
            }
            return fallback;
        }
    }

    return async () => {
        const cached = readCache(key, isValid);
        if (cached !== undefined) return cached;

        let pending = inFlight.get(key) as Promise<T> | undefined;
        if (!pending) {
            const started: Promise<T> = fetchFresh().finally(() => {
                if (inFlight.get(key) === started) inFlight.delete(key);
            });
            pending = started;
            inFlight.set(key, pending);
        }

        return pending;
    }
}

/** BZE-side ids (`channel-3`) of the transfer channels the guardian closed. `[]` when none or on failure. */
export const getClosedChannels = cachedReader<string[]>(
    CLOSED_CHANNELS_KEY, "closed_channels", [], isStringArray, b => b.channel_ids ?? [],
);

/** Exact BZE-side denoms blocked from crossing chains (rate-limit blacklist). `[]` when none or on failure. */
export const getBlockedDenoms = cachedReader<string[]>(
    BLOCKED_DENOMS_KEY, "blocked_denoms", [], isStringArray, b => b.denoms ?? [],
);

/** True while the guardian paused the automation (burner countdown). `false` on failure. */
export const getAutomationPaused = cachedReader<boolean>(
    AUTOMATION_PAUSED_KEY, "automation_paused", false, isBoolean, b => b.paused ?? false,
);

/** Drops the cached pause flag so the next `getAutomationPaused()` asks the chain (after a pause/resume event). */
export const invalidateAutomationPaused = (): void => {
    generation.set(AUTOMATION_PAUSED_KEY, (generation.get(AUTOMATION_PAUSED_KEY) ?? 0) + 1);
    inFlight.delete(AUTOMATION_PAUSED_KEY);
    removeFromLocalStorage(AUTOMATION_PAUSED_KEY);
};
