import {
    type BrandingFont,
    brandingFont,
    brandingFontsStylesheetUrl,
    type BrandingPalette,
    type DenomBranding,
} from "@bze/bze-ui-kit";

/** Kits change only through an admin tx, so a token page may reuse one for this long. */
export const BRAND_KIT_TTL_MS = 5 * 60 * 1000;

/** The curated font of a kit, or `undefined` for a slug outside `BRANDING_FONTS` (render the default font). */
export const resolveBrandFont = (slug: string): BrandingFont | undefined => brandingFont(slug);

/** The single-family stylesheet of a curated font; nothing else is ever loaded. */
export const brandFontStylesheetUrl = (font: BrandingFont): string => brandingFontsStylesheetUrl([font]);

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
    const channel = (offset: number) => {
        const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Black or white, whichever reads better on `hex` (text on a primary-coloured button). */
export function contrastText(hex: string): string {
    const l = luminance(hex);
    return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#FFFFFF";
}

const mix = (color: string, percent: number, base: string) => `color-mix(in srgb, ${color} ${percent}%, ${base})`;

/**
 * CSS custom properties that rebrand a subtree with one palette of a kit: the four `--brand-*`
 * variables plus the Chakra tokens the token page draws with (page/panel backgrounds, text,
 * borders and the green accent palette), so cards, buttons and tabs follow the kit without each
 * component knowing about it. Gray and purple palettes are left alone.
 */
export function brandCssVars(kit: DenomBranding, mode: BrandingPalette): Record<string, string> {
    const {background: bg, text, primary, secondary} = kit[mode];
    const vars: Record<string, string> = {
        "--brand-bg": bg,
        "--brand-text": text,
        "--brand-primary": primary,
        "--brand-secondary": secondary,

        "--chakra-colors-bg": bg,
        "--chakra-colors-bg-subtle": bg,
        "--chakra-colors-bg-panel": mix(text, 3, bg),
        "--chakra-colors-bg-muted": mix(text, 6, bg),
        "--chakra-colors-bg-emphasized": mix(text, 12, bg),
        "--chakra-colors-fg": text,
        "--chakra-colors-fg-muted": mix(text, 68, bg),
        "--chakra-colors-fg-subtle": mix(text, 45, bg),
        "--chakra-colors-border": mix(text, 14, bg),
        "--chakra-colors-border-muted": mix(text, 10, bg),
        "--chakra-colors-border-subtle": mix(text, 8, bg),
    };

    // The app's accent palette is green (body colorPalette + explicit colorPalette="green" and
    // green.500/600 shades). Explicit uses re-read the green-* tokens; inherited ones read the
    // color-palette-* tokens the body already resolved, so both are overridden.
    const accent: Record<string, string> = {
        "500": primary,
        "600": secondary,
        solid: primary,
        contrast: contrastText(primary),
        fg: primary,
        muted: mix(primary, 25, bg),
        subtle: mix(primary, 12, bg),
        emphasized: mix(primary, 35, bg),
        "focus-ring": primary,
        border: primary,
    };
    for (const [key, value] of Object.entries(accent)) {
        vars[`--chakra-colors-green-${key}`] = value;
        vars[`--chakra-colors-color-palette-${key}`] = value;
    }

    const font = resolveBrandFont(kit.font);
    if (font) {
        vars["--chakra-fonts-body"] = font.family;
        vars["--chakra-fonts-heading"] = font.family;
    }

    return vars;
}

type Clock = () => number;

/**
 * A per-denom cache of brand kits in front of `fetchKit`. Fails open: a failed query resolves to
 * `null` (default theme) and is not cached, so the next visit retries.
 */
export function createBrandKitCache(
    fetchKit: (denom: string) => Promise<DenomBranding | null>,
    ttlMs: number = BRAND_KIT_TTL_MS,
    now: Clock = Date.now,
) {
    const entries = new Map<string, { kit: DenomBranding | null; at: number }>();

    const peek = (denom: string): DenomBranding | null | undefined => {
        const entry = entries.get(denom);
        if (!entry || now() - entry.at >= ttlMs) return undefined;
        return entry.kit;
    };

    const get = async (denom: string): Promise<DenomBranding | null> => {
        const cached = peek(denom);
        if (cached !== undefined) return cached;

        try {
            const kit = await fetchKit(denom);
            entries.set(denom, {kit, at: now()});
            return kit;
        } catch (e) {
            console.error("failed to load the brand kit of", denom, e);
            return null;
        }
    };

    return {get, peek};
}
