import {getRestClient} from "./client";
import {LcdPagination, readAllPages} from "./lcd";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";

/**
 * Denoms halted by governance in tradebin (chain v8.2.0, `MsgHaltDenoms` / `MsgUnhaltDenoms`).
 * The chain refuses orders, swaps, liquidity adds and market/pool creation involving them, and
 * refuses them as tx fee denom; cancelling orders, removing liquidity and transfers stay open.
 */

const CACHE_KEY = "halted_denoms";
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes — setInLocalStorage takes seconds

// Several components mount at once on a page; they share one request instead of racing the cache.
let inFlight: Promise<string[]> | undefined;

const fetchHaltedDenoms = async (): Promise<string[]> => {
    try {
        const client = await getRestClient();
        const denoms = await readAllPages<string>(async (pagination) => {
            const response = await client.bze.tradebin.haltedDenoms({pagination}) as unknown as {
                denoms?: string[];
                pagination?: LcdPagination
            };

            return {list: response.denoms, pagination: response.pagination};
        });
        setInLocalStorage(CACHE_KEY, JSON.stringify(denoms), CACHE_TTL_SECONDS);

        return denoms;
    } catch (e) {
        // Fail open and cache nothing: a node older than v8.2.0 answers 501 (code 12), and the chain
        // enforces the halt anyway — the UI only spares the user a rejected tx.
        console.error("failed to fetch halted denoms:", e);
        return [];
    }
}

/** Every denom halted on the chain, cached for 5 minutes. `[]` when the query fails. */
export const getHaltedDenoms = async (): Promise<string[]> => {
    const cached = getFromLocalStorage(CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
                return parsed as string[];
            }
        } catch {
            // ignore parse error, refetch
        }
    }

    if (!inFlight) {
        inFlight = fetchHaltedDenoms().finally(() => {
            inFlight = undefined;
        });
    }

    return inFlight;
}
