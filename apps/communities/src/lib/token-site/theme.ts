import type {BrandingPalette, DenomBranding} from "@bze/bze-ui-kit";

import {contrastRatio, contrastText, resolveBrandFont} from "@/lib/brand-kit";

/** Font stack used when a kit's font is not one of the curated `BRANDING_FONTS`. */
export const TOKEN_SITE_FALLBACK_FONT = "system-ui, sans-serif";

/** Reds of one hue from light to dark; the danger colour is picked among them per background. */
const DANGER_REDS = ["#FFA39E", "#FF7A72", "#F5524A", "#DC3328", "#B92318", "#941B12", "#70140D"];
/** Index of the red tried first: the most saturated one, so danger looks the same on most kits. */
const DANGER_START = 3;
/** WCAG AA for normal text: danger is used for error text and outlined labels on the page. */
const DANGER_MIN_CONTRAST = 4.5;

/**
 * The danger colour (unstake, warnings, errors) for a kit's background: the red nearest the
 * saturated middle of `DANGER_REDS` that reaches AA contrast on it, walking lighter on a dark
 * background and darker on a light one. It is the same hue on every kit so it always means
 * danger, even when the kit's own primary is red (the kit then tells them apart by style:
 * danger is never a filled button).
 */
export function dangerColor(background: string): string {
    const darkBackground = contrastText(background) === "#FFFFFF";
    const step = darkBackground ? -1 : 1;
    for (let i = DANGER_START; i >= 0 && i < DANGER_REDS.length; i += step) {
        if (contrastRatio(DANGER_REDS[i], background) >= DANGER_MIN_CONTRAST) {
            return DANGER_REDS[i];
        }
    }

    // A mid-tone background no red reaches AA on: the one that reads best.
    return DANGER_REDS.reduce((best, red) => (contrastRatio(red, background) > contrastRatio(best, background) ? red : best));
}

const mix = (color: string, percent: number, base: string) => `color-mix(in oklab, ${color} ${percent}%, ${base})`;

/**
 * The `--ts-*` CSS variables that theme the token site with one palette of a brand kit
 * (Business Logic R1): the kit's four colours, the text that reads on primary and secondary, the
 * three tints derived from text and background, the danger red fitted to the background
 * (`dangerColor`) and the font. Nothing else colours the page.
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
        "--ts-danger": dangerColor(background),
        // The curated family first ("'Inter', sans-serif" → "'Inter'"), then the system fallback.
        "--ts-font": font ? `${font.family.split(",")[0]}, ${TOKEN_SITE_FALLBACK_FONT}` : TOKEN_SITE_FALLBACK_FONT,
    };
}
