import type { SystemStyleObject } from "@chakra-ui/react";

/**
 * The three top layouts of the swap page, picked on desktop with the layout switcher:
 * `aligned` (A, aligned bands), `centered` (B, swap centre stage) and `split` (C-3, swap left,
 * activity right). B is the default and the only layout below `lg`.
 */
export const SWAP_LAYOUTS = ["aligned", "centered", "split"] as const;

export type SwapLayout = (typeof SWAP_LAYOUTS)[number];

export const DEFAULT_SWAP_LAYOUT: SwapLayout = "centered";

/**
 * Local-storage key of the chosen layout. The value is the raw layout name (no JSON, no expiry,
 * no chain prefix) so the pre-paint script can read it before React loads.
 */
export const SWAP_LAYOUT_KEY = "dex:swap-layout";

/** The layout a stored value names; anything missing or unknown is the default. */
export function parseSwapLayout(value: unknown): SwapLayout {
    return SWAP_LAYOUTS.find((layout) => layout === value) ?? DEFAULT_SWAP_LAYOUT;
}

/** Where the switcher keeps the chosen layout; swappable for tests or another backend. */
export interface SwapLayoutStore {
    get(): SwapLayout;
    set(layout: SwapLayout): void;
}

/**
 * A layout store on local storage. Private mode, blocked storage or a throwing accessor read as
 * the default and drop the write: the page then simply stays on B.
 */
export function createLocalSwapLayoutStore(storage: () => Storage = () => window.localStorage): SwapLayoutStore {
    return {
        get() {
            try {
                return parseSwapLayout(storage().getItem(SWAP_LAYOUT_KEY));
            } catch {
                return DEFAULT_SWAP_LAYOUT;
            }
        },
        set(layout: SwapLayout) {
            try {
                storage().setItem(SWAP_LAYOUT_KEY, layout);
            } catch {
                // Not remembered; the switch itself still applies.
            }
        },
    };
}

/** Puts `layout` on `<html>`: the attribute for A and C-3, none for B (the CSS default). */
export function applySwapLayout(layout: SwapLayout, root: HTMLElement = document.documentElement): void {
    if (layout === DEFAULT_SWAP_LAYOUT) {
        delete root.dataset.swapLayout;
    } else {
        root.dataset.swapLayout = layout;
    }
}

/**
 * The inline `<head>` script of the root layout: sets the stored A or C-3 layout on `<html>`
 * before the first paint, so a returning user never sees B flash. Runs once, no listeners.
 */
export const SWAP_LAYOUT_SCRIPT =
    `try{var l=localStorage.getItem(${JSON.stringify(SWAP_LAYOUT_KEY)});` +
    `if(l==="aligned"||l==="split")document.documentElement.dataset.swapLayout=l}catch(e){}`;

type OtherLayout = Exclude<SwapLayout, "centered">;

/** The style selector for an element while `layout` is on `<html>`; nest only `lg` values in it. */
export const inLayout = <L extends OtherLayout>(layout: L) => `html[data-swap-layout=${layout}] &` as const;

/**
 * Shows a piece only in the given layouts, from `lg` up. A piece of B also shows below `lg`
 * (where B is the only layout); a piece of A or C-3 never does.
 */
export function showOnlyIn(layouts: readonly SwapLayout[], display = "block"): SystemStyleObject {
    const others: OtherLayout[] = ["aligned", "split"];
    if (layouts.includes(DEFAULT_SWAP_LAYOUT)) {
        return Object.fromEntries(
            others.filter((layout) => !layouts.includes(layout)).map((layout) => [inLayout(layout), { display: { lg: "none" } }]),
        ) as SystemStyleObject;
    }
    return {
        display: "none",
        ...Object.fromEntries(
            others.filter((layout) => layouts.includes(layout)).map((layout) => [inLayout(layout), { display: { lg: display } }]),
        ),
    } as SystemStyleObject;
}
