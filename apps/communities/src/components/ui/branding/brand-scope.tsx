'use client';

import React, {useMemo} from "react";
import {preinit} from "react-dom";
import {Box} from "@chakra-ui/react";
import type {DenomBranding} from "@bze/bze-ui-kit";

import {useColorMode} from "@/components/ui/color-mode";
import {brandCssVars, brandFontStylesheetUrl, resolveBrandFont} from "@/lib/brand-kit";

interface BrandScopeProps {
    kit: DenomBranding | null | undefined;
    children: React.ReactNode;
}

/**
 * Applies a token's on-chain brand kit to its subtree: the palette of the active colour mode as
 * CSS variables (re-resolved live when the mode changes) and the kit's font when it is curated.
 * Without a kit, or before the colour mode is known, it renders the children untouched.
 *
 * Portaled UI (toasts, the wallet/settings sidebars, transaction dialogs) sits outside the
 * subtree in the DOM and keeps the BeeZee theme.
 */
export function BrandScope({kit, children}: BrandScopeProps) {
    const {colorMode} = useColorMode();
    const mode = colorMode === "dark" || colorMode === "light" ? colorMode : undefined;

    const style = useMemo(
        () => (kit && mode ? brandCssVars(kit, mode) as React.CSSProperties : undefined),
        [kit, mode],
    );
    const font = kit ? resolveBrandFont(kit.font) : undefined;

    // Only curated fonts are ever loaded. preinit dedupes and, unlike a `<link precedence>`, does
    // not suspend the page while the stylesheet downloads (display=swap covers the gap).
    if (style && font) {
        preinit(brandFontStylesheetUrl(font), {as: "style", precedence: "default"});
    }

    if (!style) {
        return <>{children}</>;
    }

    return (
        <Box
            data-testid="brand-scope"
            display="contents"
            style={style}
            color="var(--brand-text)"
            fontFamily={font ? "var(--chakra-fonts-body)" : undefined}
        >
            {children}
        </Box>
    );
}
