import { BRANDING_COLOR_KEYS, BRANDING_PALETTES, BRANDING_TEMPLATES, isValidBrandingColor } from '@bze/bze-ui-kit'
import type { BrandingColorKey, BrandingField, BrandingPalette, BrandingTemplate, DenomBranding } from '@bze/bze-ui-kit'

/** The brand kit editor page (BFE-293): its own page, opened from the token page with `?return=`. */
export const BRAND_KIT_PATH = '/brand-kit'

export function brandKitHref(denom: string): string {
    return `${BRAND_KIT_PATH}?denom=${encodeURIComponent(denom)}`
}

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

/**
 * The fields of `kit` that no longer match `template` (font included), for the "changed from
 * the template" marks. Hex case is ignored: #b45309 is still the template's colour.
 */
export function changedFromTemplate(kit: DenomBranding, template: BrandingTemplate): BrandingField[] {
    const changed: BrandingField[] = kit.font === template.branding.font ? [] : ['font']
    for (const palette of BRANDING_PALETTES) {
        for (const key of BRANDING_COLOR_KEYS) {
            if (kit[palette][key].toLowerCase() !== template.branding[palette][key].toLowerCase()) changed.push(`${palette}.${key}`)
        }
    }
    return changed
}

/** The template a stored kit is exactly (hex case ignored), so an untouched template kit reads "Based on Honey". */
export function templateOfKit(kit: DenomBranding | null): BrandingTemplate | undefined {
    if (!kit) return undefined
    return BRANDING_TEMPLATES.find(t => changedFromTemplate(kit, t).length === 0)
}

/** The collapsed template box's line: which template the kit is based on and whether it was edited since. */
export function templateSummary(template: BrandingTemplate | undefined, changedCount: number): string {
    if (!template) return `${BRANDING_TEMPLATES.length} ready-made colour sets, each with a font. One click fills both palettes.`
    return `Based on ${template.name}${changedCount > 0 ? ' · edited' : ''}`
}

/** The Undo bar's text after a template was applied. */
export function undoText(template: BrandingTemplate, fontLabel: string, changedCount: number): string {
    const applied = `${template.name} set all eight colours and the font (${fontLabel}).`
    if (changedCount === 0) return applied
    return `${applied} You changed ${changedCount} ${changedCount === 1 ? 'field' : 'fields'} since.`
}
