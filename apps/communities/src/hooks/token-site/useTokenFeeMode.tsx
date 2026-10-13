'use client';

import React, {createContext, useCallback, useContext, useEffect, useState} from "react";
import {
    getFromLocalStorage,
    removeFromLocalStorage,
    setInLocalStorage,
    TTL_NO_EXPIRY,
    useFeeTokens,
    useSettings,
} from "@bze/bze-ui-kit";

export interface TokenFeeMode {
    /** The fee tokens are still loading: neither mode is known yet. */
    isLoading: boolean;
    /** T can pay network fees itself (a BZE pool deep enough, T not halted). */
    eligible: boolean;
    /** Not eligible, once known: every transaction needs BZE for its fee (low-liquidity mode). */
    needsBze: boolean;
    /** The denom the page pays network fees in: T when eligible and not opted out, else BZE. */
    feeDenom: string;
    /** The viewer turned "Pay network fees in T" off for this token. */
    optOut: boolean;
    setOptOut: (optOut: boolean) => void;
}

const optOutKey = (denom: string) => `communities:feeOptOut:${denom}`;
const readOptOut = (denom: string) => getFromLocalStorage(optOutKey(denom)) === "1";

/**
 * The token page's fee mode (Business Logic R12, R13). An eligible T pays network fees by
 * default, unless the viewer opted out for it; any other token pays in BZE. The choice is applied
 * to the app-wide preferred fee denom, re-applied when eligibility flips, and reset to BZE when
 * the page goes away, so the directory and other tokens start from BZE.
 */
export function useTokenFeeMode(denom: string): TokenFeeMode {
    const {isValidFeeDenom, isLoading, nativeDenom} = useFeeTokens();
    const {feeDenom: preferred, updatePreferredFeeDenom} = useSettings();
    const eligible = !isLoading && denom !== nativeDenom && isValidFeeDenom(denom);

    // The stored opt-out of this denom, re-read when the page moves to another token.
    const [stored, setStored] = useState(() => ({denom, optOut: readOptOut(denom)}));
    let optOut = stored.optOut;
    if (stored.denom !== denom) {
        optOut = readOptOut(denom);
        setStored({denom, optOut});
    }

    const feeDenom = eligible && !optOut ? denom : nativeDenom;

    useEffect(() => {
        if (isLoading || preferred === feeDenom) return;
        updatePreferredFeeDenom(feeDenom === nativeDenom ? undefined : feeDenom);
    }, [isLoading, preferred, feeDenom, nativeDenom, updatePreferredFeeDenom]);

    useEffect(() => () => {
        updatePreferredFeeDenom(undefined);
    }, [updatePreferredFeeDenom]);

    const setOptOut = useCallback((next: boolean) => {
        if (next) setInLocalStorage(optOutKey(denom), "1", TTL_NO_EXPIRY);
        else removeFromLocalStorage(optOutKey(denom));
        setStored({denom, optOut: next});
    }, [denom]);

    return {isLoading, eligible, needsBze: !isLoading && !eligible, feeDenom, optOut, setOptOut};
}

const TokenFeeModeContext = createContext<TokenFeeMode | null>(null);

/** Applies the page token's fee mode once, for the whole token site; rendered by `TokenSite`. */
export function TokenFeeModeProvider({denom, children}: { denom: string; children: React.ReactNode }) {
    const mode = useTokenFeeMode(denom);

    return <TokenFeeModeContext.Provider value={mode}>{children}</TokenFeeModeContext.Provider>;
}

/** The page token's fee mode, as applied by `TokenFeeModeProvider`. */
export function useFeeMode(): TokenFeeMode {
    const value = useContext(TokenFeeModeContext);
    if (!value) {
        throw new Error("useFeeMode must be used inside a TokenFeeModeProvider");
    }

    return value;
}
