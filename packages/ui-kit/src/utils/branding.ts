import {BRANDING_COLOR_KEYS, BRANDING_FONTS, BRANDING_PALETTES, BrandingFont} from "../constants/branding";
import type {BrandingColorKey, BrandingPalette, DenomBranding} from "../types/branding";

// Same patterns as the chain (x/tokenfactory/types/denom_branding.go).
const BRANDING_FONT_REGEX = /^[a-z0-9-]{1,32}$/;
const BRANDING_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** A font slug the chain accepts (lowercase letters, digits and `-`, 1 to 32 characters). */
export const isValidBrandingFont = (font: string): boolean => BRANDING_FONT_REGEX.test(font);

/** A `#rrggbb` colour the chain accepts (hex digits in either case). */
export const isValidBrandingColor = (color: string): boolean => BRANDING_COLOR_REGEX.test(color);

/** The curated font of a slug, or `undefined` when our apps can't render it. */
export const brandingFont = (slug: string): BrandingFont | undefined =>
    BRANDING_FONTS.find(font => font.slug === slug);

/**
 * One Google Fonts stylesheet URL that loads `fonts` (default: every curated font) in the weights
 * the apps use, so a page can render a brand kit's font without bundling it.
 */
export function brandingFontsStylesheetUrl(fonts: BrandingFont[] = BRANDING_FONTS): string {
    const families = fonts.map(font => `family=${font.label.replace(/ /g, '+')}:wght@400;600;700`);
    return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

/** Field key of one colour in a kit, e.g. `light.background`. */
export type BrandingField = 'font' | `${BrandingPalette}.${BrandingColorKey}`;

/**
 * Field-level problems of a kit about to be saved; empty when it can be sent. Stricter than the
 * chain on the font: a slug outside `BRANDING_FONTS` is valid on chain but would render as the
 * default font everywhere, so the editor refuses it.
 */
export function validateDenomBranding(branding: DenomBranding): Partial<Record<BrandingField, string>> {
    const errors: Partial<Record<BrandingField, string>> = {};
    if (!branding.font) {
        errors.font = 'Pick a font.';
    } else if (!isValidBrandingFont(branding.font) || !brandingFont(branding.font)) {
        errors.font = 'Pick one of the listed fonts.';
    }

    for (const palette of BRANDING_PALETTES) {
        for (const key of BRANDING_COLOR_KEYS) {
            const value = branding[palette]?.[key] ?? '';
            if (!value) {
                errors[`${palette}.${key}`] = 'Required.';
            } else if (!isValidBrandingColor(value)) {
                errors[`${palette}.${key}`] = 'Use a 6-digit hex colour like #1A2B3C.';
            }
        }
    }

    return errors;
}
