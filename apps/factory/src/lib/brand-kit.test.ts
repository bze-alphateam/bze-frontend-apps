import { describe, expect, it } from 'vitest'
import { DEFAULT_DENOM_BRANDING } from '@bze/bze-ui-kit'
import { colorPickerValue, sameBranding, withBrandingColor } from './brand-kit'

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
