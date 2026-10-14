import {
    type BrandingFont,
    brandingFont,
    brandingFontsStylesheetUrl,
    type BrandingPalette,
    type DenomBranding,
    type DenomBrandingRecord,
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

/** WCAG contrast ratio of two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `hex` (text on a primary-coloured button). */
export function contrastText(hex: string): string {
    return contrastRatio(hex, "#000000") > contrastRatio(hex, "#FFFFFF") ? "#000000" : "#FFFFFF";
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

/**
 * Every stored kit by denom, fetched with one query and cached for `ttlMs` (the directory cards).
 * Fails open like the per-denom cache: a failed query resolves to an empty map (every card gets
 * the neutral strip) and is not cached.
 */
export function createBrandKitListCache(
    fetchAll: () => Promise<DenomBrandingRecord[]>,
    ttlMs: number = BRAND_KIT_TTL_MS,
    now: Clock = Date.now,
) {
    let entry: { kits: Map<string, DenomBranding>; at: number } | undefined;

    const get = async (): Promise<Map<string, DenomBranding>> => {
        if (entry && now() - entry.at < ttlMs) return entry.kits;

        try {
            const records = await fetchAll();
            entry = {kits: new Map(records.map((record) => [record.denom, record.branding])), at: now()};
            return entry.kits;
        } catch (e) {
            console.error("failed to load the brand kits", e);
            return new Map();
        }
    };

    return {get};
}

/** The colour a directory card is drawn in: the kit's primary for `mode`, `undefined` without a kit. */
export const cardBrandColor = (kit: DenomBranding | null | undefined, mode: BrandingPalette): string | undefined =>
    kit?.[mode].primary;
