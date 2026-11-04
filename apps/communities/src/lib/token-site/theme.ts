import type {BrandingColors, BrandingPalette, DenomBranding} from "@bze/bze-ui-kit";

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

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** `#rrggbb` → OKLab (L, a, b). */
function toOklab(hex: string): [number, number, number] {
    const [r, g, b] = [1, 3, 5].map((offset) => srgbToLinear(parseInt(hex.slice(offset, offset + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

/** OKLab → `#RRGGBB`, clamped to the sRGB gamut. */
function fromOklab([L, A, B]: [number, number, number]): string {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const channels = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];

    return `#${channels.map((c) => Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255).toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

/** `percent` % of `color` mixed into `base` in OKLab, as a hex colour (what `color-mix(in oklab, …)` paints). */
function mixHex(color: string, percent: number, base: string): string {
    const [c, b] = [toOklab(color), toOklab(base)];
    const t = percent / 100;

    return fromOklab([0, 1, 2].map((i) => c[i] * t + b[i] * (1 - t)) as [number, number, number]);
}

/**
 * The page's neutral surfaces, from the faintest to the strongest: the share of text mixed into
 * the background that each starts from, and the least contrast (WCAG ratio) it must reach on the
 * background. The shares are the design; the floors are what the weakest light template already
 * reaches with them, so light kits keep exactly those shares. On a very dark background, pure
 * black above all, a few percent of text in OKLab rounds back to the background itself (the
 * Terminal, Mono and Signal dark kits painted cards and borders `#000000` on `#000000`), so
 * there the share grows until the floor is reached.
 */
const SURFACES = [
    {key: "card", percent: 4, minContrast: 1.08},
    {key: "inset", percent: 6, minContrast: 1.12},
    {key: "hover", percent: 8, minContrast: 1.15},
    // The border also has to stand off the card it outlines.
    {key: "border", percent: 11, minContrast: 1.24, minOnCard: 1.15},
    {key: "line", percent: 16, minContrast: 1.38},
    {key: "borderStrong", percent: 18, minContrast: 1.44},
] as const;

/** A surface's share never grows past its design share plus this (text almost equal to the background). */
const SURFACE_MAX_LIFT = 40;

export type TokenSiteSurfaces = Record<(typeof SURFACES)[number]["key"], string>;

/**
 * The token site's neutral surfaces for one palette, as hex colours: the card, the inset block
 * inside a card, a row's hover, the border, a divider line and the strong border of controls.
 * Each is the text mixed into the background at its design share (`SURFACES`), raised until it
 * reaches its contrast floor on the background (the border also on the card), and never closer to the background than the
 * surface before it, so the order and spacing hold on every kit.
 */
export function tokenSiteSurfaces({background, text}: BrandingColors): TokenSiteSurfaces {
    const surfaces = {} as TokenSiteSurfaces;
    let previous: { percent: number; lifted: number } | undefined;
    for (const surface of SURFACES) {
        const {key, percent, minContrast} = surface;
        const minOnCard = "minOnCard" in surface ? surface.minOnCard : 1;
        const reads = (color: string) => contrastRatio(color, background) >= minContrast && (minOnCard === 1 || contrastRatio(color, surfaces.card) >= minOnCard);
        let lifted = previous ? Math.max(percent, previous.lifted + percent - previous.percent) : percent;
        while (lifted < percent + SURFACE_MAX_LIFT && !reads(mixHex(text, lifted, background))) {
            lifted++;
        }
        surfaces[key] = mixHex(text, lifted, background);
        previous = {percent, lifted};
    }

    return surfaces;
}

/**
 * The `--ts-*` CSS variables that theme the token site with one palette of a brand kit
 * (Business Logic R1): the kit's four colours, the text that reads on primary and secondary, the
 * muted text, the neutral surfaces (`tokenSiteSurfaces`), the danger red fitted to the background
 * (`dangerColor`) and the font. Nothing else colours the page.
 */
export function tokenSiteVars(kit: DenomBranding, mode: BrandingPalette): Record<string, string> {
    const {background, text, primary, secondary} = kit[mode];
    const {card, inset, border, borderStrong} = tokenSiteSurfaces(kit[mode]);
    const font = resolveBrandFont(kit.font);

    return {
        "--ts-bg": background,
        "--ts-fg": text,
        "--ts-pri": primary,
        "--ts-sec": secondary,
        "--ts-on-pri": contrastText(primary),
        "--ts-on-sec": contrastText(secondary),
        "--ts-muted": mix(text, 64, background),
        "--ts-card": card,
        "--ts-inset": inset,
        "--ts-border": border,
        "--ts-border-strong": borderStrong,
        "--ts-danger": dangerColor(background),
        // The curated family first ("'Inter', sans-serif" → "'Inter'"), then the system fallback.
        "--ts-font": font ? `${font.family.split(",")[0]}, ${TOKEN_SITE_FALLBACK_FONT}` : TOKEN_SITE_FALLBACK_FONT,
    };
}
