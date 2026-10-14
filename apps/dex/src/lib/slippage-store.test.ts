import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getKeyExpiry } from "@bze/bze-ui-kit";
import { AMM_SLIPPAGE_KEY, SLIPPAGE_TTL_SECONDS, createLocalSlippageStore } from "./slippage-store";

describe("createLocalSlippageStore", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("starts empty and gives back what was stored", () => {
        const store = createLocalSlippageStore(AMM_SLIPPAGE_KEY);
        expect(store.get()).toBeNull();

        store.set(0.3);

        expect(store.get()).toBe(0.3);
        expect(createLocalSlippageStore(AMM_SLIPPAGE_KEY).get()).toBe(0.3);
    });

    it("keys the entry under amm:slippage, so other forms can keep their own", () => {
        createLocalSlippageStore(AMM_SLIPPAGE_KEY).set(1);

        const keys = Object.keys(localStorage);
        expect(keys).toHaveLength(1);
        expect(keys[0].endsWith(":amm:slippage")).toBe(true);
        expect(createLocalSlippageStore("orders:slippage").get()).toBeNull();
    });

    it("forgets the value 30 days after it was last set", () => {
        const store = createLocalSlippageStore(AMM_SLIPPAGE_KEY);
        store.set(2);

        expect(getKeyExpiry(AMM_SLIPPAGE_KEY)?.toISOString()).toBe("2026-11-13T12:00:00.000Z");
        expect(SLIPPAGE_TTL_SECONDS).toBe(30 * 24 * 60 * 60);

        vi.setSystemTime(new Date("2026-11-13T11:59:59Z"));
        expect(store.get()).toBe(2);
        vi.setSystemTime(new Date("2026-11-13T12:00:01Z"));
        expect(store.get()).toBeNull();
    });

    it("ignores a stored value that is not a usable slippage", () => {
        const store = createLocalSlippageStore(AMM_SLIPPAGE_KEY);
        store.set(0.5);
        const [key] = Object.keys(localStorage);
        localStorage.setItem(key, JSON.stringify({ data: "999", expiry: 0 }));
        expect(store.get()).toBeNull();
        localStorage.setItem(key, JSON.stringify({ data: "abc", expiry: 0 }));
        expect(store.get()).toBeNull();
    });

    it("notifies subscribers on every change until they unsubscribe", () => {
        const store = createLocalSlippageStore(AMM_SLIPPAGE_KEY);
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        store.set(1);
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        store.set(2);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
