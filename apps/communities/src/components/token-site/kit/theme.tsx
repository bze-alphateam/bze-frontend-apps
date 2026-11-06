'use client';

import React, {createContext, useContext, useMemo} from "react";
import {preinit} from "react-dom";
import {Box} from "@chakra-ui/react";
import {type BrandingPalette, DEFAULT_DENOM_BRANDING, type DenomBranding, useToasterTheme} from "@bze/bze-ui-kit";

import {useColorMode} from "@/components/ui/color-mode";
import {brandFontStylesheetUrl, resolveBrandFont} from "@/lib/brand-kit";
import {tokenSiteVars} from "@/lib/token-site/theme";

import {tokenSiteGlowVars, tokenSiteToasterTheme} from "./hive-glow";
import {ts} from "./tokens";

interface TokenSiteThemeValue {
    kit: DenomBranding;
    mode: BrandingPalette;
    /** Both palettes as `--ts-light-*` / `--ts-dark-*`; portaled UI re-applies them, with `tokenSiteModeCss`, on its own root. */
    vars: Record<string, string>;
}

const PALETTES: BrandingPalette[] = ["light", "dark"];

/** The `--ts-*` values of one palette: colours, surfaces and font, then the Hive Glow gradients. */
const paletteVars = (kit: DenomBranding, mode: BrandingPalette) => ({...tokenSiteVars(kit, mode), ...tokenSiteGlowVars(kit[mode])});

const inMode = (name: string, mode: BrandingPalette) => name.replace(/^--ts-/, `--ts-${mode}-`);

/**
 * Both palettes of a kit on one element, as `--ts-light-*` and `--ts-dark-*`. The markup is the same
 * whatever the colour mode, so the server's HTML and the browser's first render always agree;
 * `tokenSiteModeCss` picks the palette from the colour-mode class in CSS, before any script runs.
 */
export function tokenSitePaletteVars(kit: DenomBranding): Record<string, string> {
    return Object.fromEntries(PALETTES.flatMap((mode) => Object.entries(paletteVars(kit, mode)).map(([name, value]) => [inMode(name, mode), value])));
}

const VAR_NAMES = Object.keys(paletteVars(DEFAULT_DENOM_BRANDING, "light"));
const pointAt = (mode: BrandingPalette) => Object.fromEntries(VAR_NAMES.map((name) => [name, `var(${inMode(name, mode)})`]));

/**
 * Maps every `--ts-*` variable to the light palette, or to the dark one under the `.dark` class
 * next-themes sets on `<html>`. Only variable names, never kit values, so nothing on-chain reaches
 * a stylesheet: the values stay in the element's inline style.
 */
export const tokenSiteModeCss = {...pointAt("light"), _dark: pointAt("dark")};

const TokenSiteThemeContext = createContext<TokenSiteThemeValue | null>(null);

/**
 * Themes the token site with a brand kit: the palette of the app's colour mode and its Hive Glow
 * gradient and glow (`tokenSiteGlow`) as `--ts-*` variables on a wrapper element (both palettes
 * inline, the mode picked in CSS: `tokenSiteModeCss`), and the kit's
 * font when it is a curated one. While it is mounted the toasts take the same surface
 * (`tokenSiteToasterTheme`); other pages keep the app toasts.
 */
export function TokenSiteTheme({kit, children}: { kit: DenomBranding; children: React.ReactNode }) {
    const {colorMode} = useColorMode();
    const mode: BrandingPalette = colorMode === "dark" ? "dark" : "light";
    const vars = useMemo(() => tokenSitePaletteVars(kit), [kit]);
    const value = useMemo(() => ({kit, mode, vars}), [kit, mode, vars]);
    // The toaster renders outside the site and only after the page is up, so it takes the current palette's values.
    const toasterTheme = useMemo(() => tokenSiteToasterTheme(kit[mode], paletteVars(kit, mode)), [kit, mode]);
    useToasterTheme(toasterTheme);

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
                css={tokenSiteModeCss}
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
