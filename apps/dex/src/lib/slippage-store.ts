import { getFromLocalStorage, setInLocalStorage } from "@bze/bze-ui-kit";
import { isValidSlippage } from "./slippage";

/** Where a form keeps the slippage the user last chose; swappable for tests or another backend. */
export interface SlippageStore {
    /** The stored slippage in percent, or null when nothing usable is stored. */
    get(): number | null;
    set(value: number): void;
    /** Calls `listener` after every `set`; returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
}

/** Local-storage key of the AMM swap form's slippage. Other forms get their own `amm:*` / `*:slippage` keys. */
export const AMM_SLIPPAGE_KEY = "amm:slippage";

/** How long a chosen slippage is remembered: 30 days from the last change. */
export const SLIPPAGE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * A slippage store on the app's prefixed local storage (ui-kit adds the storage version and the
 * chain id to the key). `set` also notifies subscribers so React can re-read the value.
 */
export function createLocalSlippageStore(key: string, ttlSeconds: number = SLIPPAGE_TTL_SECONDS): SlippageStore {
    const listeners = new Set<() => void>();
    return {
        get() {
            const raw = getFromLocalStorage(key);
            if (raw === null) return null;
            const value = Number(raw);
            return isValidSlippage(value) ? value : null;
        },
        set(value: number) {
            setInLocalStorage(key, String(value), ttlSeconds);
            listeners.forEach((listener) => listener());
        },
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
