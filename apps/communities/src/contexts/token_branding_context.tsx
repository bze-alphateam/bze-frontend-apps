'use client';

import React, {createContext, useContext, useMemo, useState} from "react";

/**
 * Branding shown in the shared chrome (navbar) when the user is on a token page.
 * On the directory/index page this is null and the navbar shows normal BeeZee branding.
 * See Business Logic §2 / Features & Usage §2 — a token page should feel like the
 * token's own site.
 */
export interface TokenBrand {
    name: string;
    ticker: string;
    logo: string;
}

interface TokenBrandingContextValue {
    brand: TokenBrand | null;
    setBrand: (brand: TokenBrand | null) => void;
}

const TokenBrandingContext = createContext<TokenBrandingContextValue | null>(null);

export function TokenBrandingProvider({children}: { children: React.ReactNode }) {
    const [brand, setBrand] = useState<TokenBrand | null>(null);

    const value = useMemo(() => ({brand, setBrand}), [brand]);

    return (
        <TokenBrandingContext.Provider value={value}>
            {children}
        </TokenBrandingContext.Provider>
    );
}

/**
 * Read/update the current token branding. The navbar reads `brand`; a token page
 * sets it (and clears it on unmount) once it resolves its asset.
 */
export function useTokenBranding(): TokenBrandingContextValue {
    const ctx = useContext(TokenBrandingContext);
    if (!ctx) {
        throw new Error("useTokenBranding must be used within a TokenBrandingProvider");
    }

    return ctx;
}
