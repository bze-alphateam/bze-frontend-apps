'use client';

import React, {createContext, useContext, useMemo} from "react";
import {preinit} from "react-dom";
import {Box} from "@chakra-ui/react";
import type {BrandingPalette, DenomBranding} from "@bze/bze-ui-kit";

import {useColorMode} from "@/components/ui/color-mode";
import {brandFontStylesheetUrl, resolveBrandFont} from "@/lib/brand-kit";
import {tokenSiteVars} from "@/lib/token-site/theme";

import {ts} from "./tokens";

interface TokenSiteThemeValue {
    kit: DenomBranding;
    mode: BrandingPalette;
    /** The `--ts-*` variables; portaled UI re-applies them on its own root. */
    vars: Record<string, string>;
}

const TokenSiteThemeContext = createContext<TokenSiteThemeValue | null>(null);

/**
 * Themes the token site with a brand kit: the palette of the app's colour mode as `--ts-*`
 * variables on a wrapper element, and the kit's font when it is a curated one.
 */
export function TokenSiteTheme({kit, children}: { kit: DenomBranding; children: React.ReactNode }) {
    const {colorMode} = useColorMode();
    const mode: BrandingPalette = colorMode === "dark" ? "dark" : "light";
    const vars = useMemo(() => tokenSiteVars(kit, mode), [kit, mode]);
    const value = useMemo(() => ({kit, mode, vars}), [kit, mode, vars]);

    // Only curated fonts are ever loaded. preinit dedupes and, unlike a `<link precedence>`, does
    // not suspend the page while the stylesheet downloads (display=swap covers the gap).
    const font = resolveBrandFont(kit.font);
    if (font) {
        preinit(brandFontStylesheetUrl(font), {as: "style", precedence: "default"});
    }

    return (
        <TokenSiteThemeContext.Provider value={value}>
            <Box
                data-testid="token-site"
                style={vars as React.CSSProperties}
                bg={ts.bg}
                color={ts.fg}
                fontFamily={ts.font}
                minH="100vh"
            >
                {children}
            </Box>
        </TokenSiteThemeContext.Provider>
    );
}

export function useTokenSiteTheme(): TokenSiteThemeValue {
    const value = useContext(TokenSiteThemeContext);
    if (!value) {
        throw new Error("useTokenSiteTheme must be used inside a TokenSiteTheme");
    }

    return value;
}
