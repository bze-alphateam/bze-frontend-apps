"use client";

import {useSyncExternalStore} from "react";

// Below Chakra's `md` breakpoint (48em). For the few places where the markup
// itself differs by width (a dialog vs a bottom sheet), not just the styles.

const QUERY = "(max-width: 47.99em)";

const media = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null);

const subscribe = (onChange: () => void) => {
    const m = media();
    m?.addEventListener("change", onChange);
    return () => m?.removeEventListener("change", onChange);
};

export function useIsPhone(): boolean {
    return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
}
