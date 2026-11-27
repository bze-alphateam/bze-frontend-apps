import {getSettings} from "../storage/settings";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";

/**
 * x/circuit disable list (chain v8.2.0 wires the route, v8.3.0 lets the guardian fill it with
 * `MsgDisableMessages`). The message router refuses every message whose type URL is on the list;
 * only governance re-enables them. Raw REST: any non-200 and any network error mean "nothing
 * paused" (fail open, the chain enforces the list anyway). Failures are never cached.
 */

const CACHE_KEY = "circuit:disabled_messages";
const CACHE_TTL_SECONDS = 60; // setInLocalStorage takes seconds

// Several components mount at once; they share one request instead of racing the cache.
let inFlight: Promise<string[]> | undefined;

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(i => typeof i === "string");

const readCache = (): string[] | undefined => {
    const cached = getFromLocalStorage(CACHE_KEY);
    if (!cached) return undefined;
    try {
        const parsed = JSON.parse(cached);
        return isStringArray(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

const fetchFresh = async (): Promise<string[]> => {
    try {
        const response = await fetch(`${getSettings().endpoints.restEndpoint}/cosmos/circuit/v1/disable_list`);
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`);
        }
        const body = await response.json() as {disabled_list?: unknown};
        const list = body?.disabled_list ?? [];
        if (!isStringArray(list)) {
            throw new Error("unexpected response shape");
        }
        setInLocalStorage(CACHE_KEY, JSON.stringify(list), CACHE_TTL_SECONDS);

        return list;
    } catch (e) {
        console.error("failed to fetch circuit disable list:", e);
        return [];
    }
}

/** Full type URLs (leading slash) of the message types the chain currently refuses. `[]` when none or on failure. */
export const getDisabledMessages = async (): Promise<string[]> => {
    const cached = readCache();
    if (cached !== undefined) return cached;

    if (!inFlight) {
        inFlight = fetchFresh().finally(() => {
            inFlight = undefined;
        });
    }

    return inFlight;
}

/** The type URLs among `typeUrls` that are on the disable list, in the order given. */
export const pausedAmong = (disabled: string[], typeUrls: string[]): string[] => {
    const set = new Set(disabled);
    return typeUrls.filter(url => set.has(url));
}
