import { isValidBrandingColor } from '@bze/bze-ui-kit'
import type { BrandingColorKey, BrandingPalette, DenomBranding } from '@bze/bze-ui-kit'

/** A copy of `kit` with one colour replaced. */
export function withBrandingColor(kit: DenomBranding, palette: BrandingPalette, key: BrandingColorKey, value: string): DenomBranding {
    return { ...kit, [palette]: { ...kit[palette], [key]: value } }
}

/**
 * The value for a native colour picker, which only takes lowercase `#rrggbb`: the typed hex when
 * it is valid, black while it is still being typed.
 */
export function colorPickerValue(hex: string): string {
    return isValidBrandingColor(hex) ? hex.toLowerCase() : '#000000'
}

/**
 * Whether two kits store the same thing. The chain keeps hex digits verbatim, so a case-only
 * change (#ABCDEF → #abcdef) is a real change and is not normalised away here.
 */
export function sameBranding(a: DenomBranding | null, b: DenomBranding | null): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}
