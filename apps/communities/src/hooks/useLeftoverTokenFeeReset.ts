'use client';

import {useEffect} from "react";
import {
    getFromLocalStorage,
    removeFromLocalStorage,
    setInLocalStorage,
    TTL_NO_EXPIRY,
    useSettings,
} from "@bze/bze-ui-kit";

// The token page's fee denom, while the token page is the one that set it.
const MARKER_KEY = "communities:feeDenomSetByTokenPage";

/** Records that the token page made `denom` the preferred fee denom (not the viewer). */
export function markTokenPageFeeDenom(denom: string) {
    setInLocalStorage(MARKER_KEY, denom, TTL_NO_EXPIRY);
}

/** The token page no longer holds the preferred fee denom. */
export function clearTokenPageFeeDenom() {
    removeFromLocalStorage(MARKER_KEY);
}

/**
 * Resets a fee denom the token page left behind. The token page resets the preferred fee denom
 * to BZE when it unmounts, which never happens when the browser is closed on it. Outside the
 * token page, a preferred denom still matching the token page's marker goes back to BZE; one the
 * viewer picked since (marker stale) or without any marker is left alone.
 */
export function useLeftoverTokenFeeReset() {
    const {isLoaded, feeDenom, updatePreferredFeeDenom} = useSettings();

    useEffect(() => {
        if (!isLoaded) return;

        const leftover = getFromLocalStorage(MARKER_KEY);
        if (!leftover) return;

        if (feeDenom === leftover) updatePreferredFeeDenom(undefined);
        clearTokenPageFeeDenom();
    }, [isLoaded, feeDenom, updatePreferredFeeDenom]);
}
