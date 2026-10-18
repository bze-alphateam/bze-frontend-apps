import type {BrandingColorKey, BrandingPalette, DenomBranding} from "../types/branding";

export interface BrandingFont {
    /** The slug stored on chain. */
    slug: string;
    /** Name shown to people. */
    label: string;
    /** CSS font-family stack, Google Fonts family first. */
    family: string;
}

/**
 * The fonts our apps can load for a brand kit (all Google Fonts). The chain accepts any slug
 * matching `^[a-z0-9-]{1,32}$`, but consumers render only these and fall back to their default
 * font otherwise — so editors offer only this list.
 */
export const BRANDING_FONTS: BrandingFont[] = [
    {slug: 'inter', label: 'Inter', family: "'Inter', sans-serif"},
    {slug: 'roboto', label: 'Roboto', family: "'Roboto', sans-serif"},
    {slug: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif"},
    {slug: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif"},
    {slug: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk', sans-serif"},
    {slug: 'jetbrains-mono', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace"},
];

export const BRANDING_PALETTES: BrandingPalette[] = ['light', 'dark'];

export const BRANDING_COLOR_KEYS: BrandingColorKey[] = ['background', 'text', 'primary', 'secondary'];

/** Starting point for a token without a kit: neutral backgrounds, a BZE-like yellow accent. */
export const DEFAULT_DENOM_BRANDING: DenomBranding = {
    font: 'inter',
    light: {background: '#FFFFFF', text: '#111827', primary: '#D97706', secondary: '#6B7280'},
    dark: {background: '#111827', text: '#F9FAFB', primary: '#FBBF24', secondary: '#9CA3AF'},
};
