import type {BrandingPalette, DenomBranding} from "@bze/bze-ui-kit";

import {contrastText, resolveBrandFont} from "@/lib/brand-kit";

/** Font stack used when a kit's font is not one of the curated `BRANDING_FONTS`. */
export const TOKEN_SITE_FALLBACK_FONT = "system-ui, sans-serif";

const mix = (color: string, percent: number, base: string) => `color-mix(in oklab, ${color} ${percent}%, ${base})`;

/**
 * The `--ts-*` CSS variables that theme the token site with one palette of a brand kit
 * (Business Logic R1): the kit's four colours, the text that reads on primary and secondary, the
 * three tints derived from text and background, and the font. Nothing else colours the page.
 */
export function tokenSiteVars(kit: DenomBranding, mode: BrandingPalette): Record<string, string> {
    const {background, text, primary, secondary} = kit[mode];
    const font = resolveBrandFont(kit.font);

    return {
        "--ts-bg": background,
        "--ts-fg": text,
        "--ts-pri": primary,
        "--ts-sec": secondary,
        "--ts-on-pri": contrastText(primary),
        "--ts-on-sec": contrastText(secondary),
        "--ts-muted": mix(text, 64, background),
        "--ts-card": mix(text, 4, background),
        "--ts-border": mix(text, 11, background),
        // The curated family first ("'Inter', sans-serif" → "'Inter'"), then the system fallback.
        "--ts-font": font ? `${font.family.split(",")[0]}, ${TOKEN_SITE_FALLBACK_FONT}` : TOKEN_SITE_FALLBACK_FONT,
    };
}
