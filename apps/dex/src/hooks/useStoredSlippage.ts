import { useCallback, useSyncExternalStore } from "react";
import { normalizeSlippage } from "@/lib/slippage";
import type { SlippageStore } from "@/lib/slippage-store";

const serverSnapshot = () => null;

/**
 * The slippage a form applies, read from and written to `store`. The server render (and the
 * first client render) see the default, so the stored value never causes a hydration mismatch.
 */
export function useStoredSlippage(store: SlippageStore): [number, (value: number) => void] {
    const stored = useSyncExternalStore(store.subscribe, store.get, serverSnapshot);
    const setSlippage = useCallback((value: number) => store.set(value), [store]);
    return [normalizeSlippage(stored ?? undefined), setSlippage];
}
