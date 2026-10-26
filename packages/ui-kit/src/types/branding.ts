/**
 * On-chain token brand kit (chain v8.2.0, x/tokenfactory) as the REST gateway returns it: one
 * font slug and a light and a dark palette of four colours each. The chain stores a kit only when
 * it is complete and valid (all-or-nothing), so a stored kit always carries every field.
 */

/** One palette. Every value is a `#rrggbb` hex colour, stored verbatim (hex digit case kept). */
export interface BrandingColors {
    background: string;
    text: string;
    primary: string;
    secondary: string;
}

export interface DenomBranding {
    /** Font slug (`^[a-z0-9-]{1,32}$`). Consumers render only the slugs in `BRANDING_FONTS`. */
    font: string;
    light: BrandingColors;
    dark: BrandingColors;
}

export interface DenomBrandingRecord {
    denom: string;
    branding: DenomBranding;
}

export type BrandingPalette = 'light' | 'dark';
export type BrandingColorKey = keyof BrandingColors;

/** The look a brand kit template goes for; the editor filters templates by it. */
export type BrandingTemplateMood = 'neutral' | 'warm' | 'cool' | 'vivid' | 'pastel' | 'earthy' | 'contrast';

/**
 * A ready-made kit an editor can start from: a font and both palettes. Only the kit is stored on
 * chain when it is saved; the template it came from is not.
 */
export interface BrandingTemplate {
    /** Stable slug, e.g. `ink-paper`. */
    id: string;
    name: string;
    mood: BrandingTemplateMood;
    branding: DenomBranding;
}
