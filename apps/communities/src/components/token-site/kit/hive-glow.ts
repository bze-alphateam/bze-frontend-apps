import type {BrandingColors} from "@bze/bze-ui-kit";

import {contrastRatio} from "@/lib/brand-kit";

/** How much darker the gradient's end is than the kit's primary (the app Ink gradient rule). */
const GRADIENT_DARKEN = 0.25;
/** Primary and secondary strength of the glow at the top of the hero, in percent. */
export const GLOW_PRIMARY = 18;
export const GLOW_SECONDARY = 10;
/** Below this contrast on the background the hero word starts from a tint toward the text colour. */
const HERO_WORD_MIN_CONTRAST = 4.5;
/** Share of the primary in that tint (the rest is the kit's text colour). */
const HERO_WORD_TINT = 70;

const mix = (color: string, percent: number, base: string) => `color-mix(in oklab, ${color} ${percent}%, ${base})`;

/** `#rrggbb` with every channel scaled down by `amount` (0.25 = 25 % darker). */
export function darken(hex: string, amount: number): string {
    const channel = (offset: number) => {
        const value = Math.round(parseInt(hex.slice(offset, offset + 2), 16) * (1 - amount));
        return value.toString(16).padStart(2, "0").toUpperCase();
    };

    return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export interface TokenSiteGlow {
    /** The gradient's end: the primary 25 % darker. */
    primaryDark: string;
    /** Buttons, the featured card's edge and the burn bar: primary → primary 25 % darker. */
    gradient: string;
    /**
     * The hero's gradient word. Same as `gradient` when the primary reads on the background;
     * otherwise (e.g. a dark blue primary on a dark kit) it runs from a tint of the primary toward
     * the text colour to the primary, so the name stays readable.
     */
    heroGradient: string;
    /** Radial glow at the top of the hero: primary at 18 %, secondary at 10 %. */
    glow: string;
}

/**
 * Hive Glow's gradient, hero word and glow for one palette of a token's brand kit. The token site
 * has the same structure as the BeeZee apps, but its colour comes from the kit, never from BeeZee.
 */
export function tokenSiteGlow({background, text, primary, secondary}: BrandingColors): TokenSiteGlow {
    const primaryDark = darken(primary, GRADIENT_DARKEN);
    const gradient = `linear-gradient(135deg, ${primary}, ${primaryDark})`;
    const heroFrom = contrastRatio(primary, background) < HERO_WORD_MIN_CONTRAST ? mix(primary, HERO_WORD_TINT, text) : primary;

    return {
        primaryDark,
        gradient,
        heroGradient: heroFrom === primary ? gradient : `linear-gradient(135deg, ${heroFrom}, ${primary})`,
        glow: `radial-gradient(70% 80% at 70% 0%, ${mix(primary, GLOW_PRIMARY, "transparent")}, ${mix(secondary, GLOW_SECONDARY, "transparent")} 45%, transparent 75%)`,
    };
}

/** `tokenSiteGlow` as the `--ts-*` variables the kit's components read. */
export function tokenSiteGlowVars(palette: BrandingColors): Record<string, string> {
    const {primaryDark, gradient, heroGradient, glow} = tokenSiteGlow(palette);

    return {
        "--ts-pri2": primaryDark,
        "--ts-gradient": gradient,
        "--ts-hero-gradient": heroGradient,
        "--ts-glow": glow,
        "--ts-inset": mix(palette.text, 6, palette.background),
    };
}
