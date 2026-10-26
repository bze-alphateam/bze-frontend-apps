import { describe, expect, it } from 'vitest'
import { BRANDING_TEMPLATES, DEFAULT_DENOM_BRANDING, brandingFromTemplate } from '@bze/bze-ui-kit'
import {
    brandKitHref,
    changedFromTemplate,
    colorPickerValue,
    sameBranding,
    templateOfKit,
    templateSummary,
    undoText,
    withBrandingColor,
} from './brand-kit'

const HONEY = BRANDING_TEMPLATES.find(t => t.id === 'honey')!

describe('withBrandingColor', () => {
    it('replaces one colour and leaves the rest of the kit untouched', () => {
        const next = withBrandingColor(DEFAULT_DENOM_BRANDING, 'dark', 'primary', '#123456')

        expect(next.dark).toEqual({ ...DEFAULT_DENOM_BRANDING.dark, primary: '#123456' })
        expect(next.light).toBe(DEFAULT_DENOM_BRANDING.light)
        expect(DEFAULT_DENOM_BRANDING.dark.primary).not.toBe('#123456')
    })
})

describe('colorPickerValue', () => {
    it('lowercases a valid hex and falls back to black while typing', () => {
        expect(colorPickerValue('#ABCDEF')).toBe('#abcdef')
        expect(colorPickerValue('#ABC')).toBe('#000000')
        expect(colorPickerValue('')).toBe('#000000')
    })
})

describe('sameBranding', () => {
    it('treats a hex case change as a change, since the chain stores the kit verbatim', () => {
        const upper = withBrandingColor(DEFAULT_DENOM_BRANDING, 'light', 'text', '#ABCDEF')
        const lower = withBrandingColor(DEFAULT_DENOM_BRANDING, 'light', 'text', '#abcdef')

        expect(sameBranding(upper, { ...upper })).toBe(true)
        expect(sameBranding(upper, lower)).toBe(false)
        expect(sameBranding(null, null)).toBe(true)
        expect(sameBranding(DEFAULT_DENOM_BRANDING, null)).toBe(false)
    })
})

describe('brandKitHref', () => {
    it('opens the editor page for one denom', () => {
        expect(brandKitHref('factory/bze1abc/utok')).toBe('/brand-kit?denom=factory%2Fbze1abc%2Futok')
    })
})

describe('changedFromTemplate', () => {
    it('is empty right after applying a template, since it fills the font and both palettes', () => {
        expect(changedFromTemplate(brandingFromTemplate(HONEY), HONEY)).toEqual([])
    })

    it('lists the edited colours and the font, ignoring hex case', () => {
        let kit = withBrandingColor(brandingFromTemplate(HONEY), 'dark', 'primary', '#123456')
        kit = withBrandingColor(kit, 'light', 'primary', HONEY.branding.light.primary.toLowerCase())
        kit = { ...kit, font: 'roboto' }

        expect(changedFromTemplate(kit, HONEY)).toEqual(['font', 'dark.primary'])
    })
})

describe('templateOfKit', () => {
    it('recognises a stored kit that is exactly a template', () => {
        expect(templateOfKit(brandingFromTemplate(HONEY))?.id).toBe('honey')
        expect(templateOfKit(withBrandingColor(brandingFromTemplate(HONEY), 'light', 'text', '#000001'))).toBeUndefined()
        expect(templateOfKit(null)).toBeUndefined()
    })
})

describe('templateSummary / undoText', () => {
    it('says which template the kit is based on and whether it was edited', () => {
        expect(templateSummary(undefined, 0)).toMatch(/^20 ready-made colour sets/)
        expect(templateSummary(HONEY, 0)).toBe('Based on Honey')
        expect(templateSummary(HONEY, 2)).toBe('Based on Honey · edited')
    })

    it('counts the fields changed since the template', () => {
        expect(undoText(HONEY, 'Poppins', 0)).toBe('Honey set all eight colours and the font (Poppins).')
        expect(undoText(HONEY, 'Poppins', 1)).toBe('Honey set all eight colours and the font (Poppins). You changed 1 field since.')
        expect(undoText(HONEY, 'Poppins', 3)).toMatch(/You changed 3 fields since\.$/)
    })
})
