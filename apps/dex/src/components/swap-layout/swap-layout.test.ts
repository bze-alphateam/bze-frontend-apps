import { describe, it, expect, afterEach } from "vitest";
import {
    applySwapLayout,
    createLocalSwapLayoutStore,
    parseSwapLayout,
    SWAP_LAYOUT_KEY,
    SWAP_LAYOUT_SCRIPT,
} from "./swap-layout";

/** Runs the pre-paint script against a stubbed `localStorage` and `document`; returns `<html>`'s dataset. */
function runScript(getItem: (key: string) => string | null) {
    const dataset: Record<string, string> = {};
    const run = new Function("localStorage", "document", SWAP_LAYOUT_SCRIPT);
    run({ getItem }, { documentElement: { dataset } });
    return dataset;
}

/** A Storage stand-in holding one map; `failing` makes every access throw (blocked storage). */
function fakeStorage(values: Record<string, string> = {}, failing = false): Storage {
    const fail = () => {
        throw new Error("storage blocked");
    };
    return {
        getItem: (key: string) => (failing ? fail() : values[key] ?? null),
        setItem: (key: string, value: string) => (failing ? fail() : void (values[key] = value)),
    } as unknown as Storage;
}

describe("swap layout pre-paint script", () => {
    it("reads the layout key", () => {
        const keys: string[] = [];
        runScript((key) => {
            keys.push(key);
            return null;
        });
        expect(keys).toEqual([SWAP_LAYOUT_KEY]);
    });

    it.each(["aligned", "split"])("sets the attribute for %s", (layout) => {
        expect(runScript(() => layout)).toEqual({ swapLayout: layout });
    });

    it.each([["centered"], ["garbage"], [""], [null]])("does nothing for %s", (value) => {
        expect(runScript(() => value)).toEqual({});
    });

    it("does nothing when getItem throws", () => {
        expect(() => runScript(() => {
            throw new Error("SecurityError");
        })).not.toThrow();
        expect(runScript(() => {
            throw new Error("SecurityError");
        })).toEqual({});
    });

    it("stays a few hundred bytes", () => {
        expect(SWAP_LAYOUT_SCRIPT.length).toBeLessThan(300);
    });
});

describe("parseSwapLayout", () => {
    it("keeps the three layout names", () => {
        expect(parseSwapLayout("aligned")).toBe("aligned");
        expect(parseSwapLayout("centered")).toBe("centered");
        expect(parseSwapLayout("split")).toBe("split");
    });

    it.each([[null], [undefined], ["Aligned"], ['"split"'], [42]])("falls back to centered for %s", (value) => {
        expect(parseSwapLayout(value)).toBe("centered");
    });
});

describe("createLocalSwapLayoutStore", () => {
    it("stores the raw layout name under the layout key", () => {
        const values: Record<string, string> = {};
        const store = createLocalSwapLayoutStore(() => fakeStorage(values));
        store.set("split");
        expect(values).toEqual({ [SWAP_LAYOUT_KEY]: "split" });
        expect(store.get()).toBe("split");
    });

    it("reads nothing stored or an unknown value as centered", () => {
        expect(createLocalSwapLayoutStore(() => fakeStorage()).get()).toBe("centered");
        expect(createLocalSwapLayoutStore(() => fakeStorage({ [SWAP_LAYOUT_KEY]: "wide" })).get()).toBe("centered");
    });

    it("reads blocked storage as centered and drops the write without throwing", () => {
        const store = createLocalSwapLayoutStore(() => fakeStorage({}, true));
        expect(store.get()).toBe("centered");
        expect(() => store.set("aligned")).not.toThrow();
    });

    it("reads centered when the storage accessor itself throws", () => {
        const store = createLocalSwapLayoutStore(() => {
            throw new Error("SecurityError");
        });
        expect(store.get()).toBe("centered");
        expect(() => store.set("split")).not.toThrow();
    });

    it("uses the window's local storage by default", () => {
        localStorage.setItem(SWAP_LAYOUT_KEY, "aligned");
        expect(createLocalSwapLayoutStore().get()).toBe("aligned");
        localStorage.clear();
    });
});

describe("applySwapLayout", () => {
    afterEach(() => {
        delete document.documentElement.dataset.swapLayout;
    });

    it("sets the attribute for A and C-3 and removes it for B", () => {
        applySwapLayout("aligned");
        expect(document.documentElement.getAttribute("data-swap-layout")).toBe("aligned");
        applySwapLayout("split");
        expect(document.documentElement.getAttribute("data-swap-layout")).toBe("split");
        applySwapLayout("centered");
        expect(document.documentElement.hasAttribute("data-swap-layout")).toBe(false);
    });
});
