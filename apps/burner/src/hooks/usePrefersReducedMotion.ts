import {useSyncExternalStore} from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const media = window.matchMedia(QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
};

const getSnapshot = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;

/** Whether the user asked the system for reduced motion; false on the server. */
export const usePrefersReducedMotion = () => useSyncExternalStore(subscribe, getSnapshot, () => false);
