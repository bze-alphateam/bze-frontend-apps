import { describe, expect, it } from 'vitest'
import { DEFAULT_DENOM_BRANDING } from '../constants/branding'
import { isValidBrandingColor, isValidBrandingFont, validateDenomBranding } from './branding'

describe('isValidBrandingFont', () => {
    it.each(['inter', 'space-grotesk', 'a', '0', '-', 'a'.repeat(32), 'my-font-2'])('accepts %s', (font) => {
        expect(isValidBrandingFont(font)).toBe(true)
    })

    it.each(['', 'Inter', 'space grotesk', 'space_grotesk', 'a'.repeat(33), 'font\n', 'é'])('refuses %j', (font) => {
        expect(isValidBrandingFont(font)).toBe(false)
    })
})

describe('isValidBrandingColor', () => {
    it.each(['#000000', '#ffffff', '#FFFFFF', '#aBc123'])('accepts %s', (color) => {
        expect(isValidBrandingColor(color)).toBe(true)
    })

    it.each(['', '000000', '#fff', '#fffffff', '#gggggg', ' #ffffff', '#ffffff ', '#ffffff\n', 'red', '#ffffffff'])(
        'refuses %j',
        (color) => {
            expect(isValidBrandingColor(color)).toBe(false)
        },
    )
})

describe('validateDenomBranding', () => {
    it('has no errors for a complete kit', () => {
        expect(validateDenomBranding(DEFAULT_DENOM_BRANDING)).toEqual({})
    })

    it('names each bad or missing field', () => {
        const errors = validateDenomBranding({
            font: 'inter',
            light: { ...DEFAULT_DENOM_BRANDING.light, primary: '#12345' },
            dark: { ...DEFAULT_DENOM_BRANDING.dark, text: '' },
        })

        expect(errors).toEqual({
            'light.primary': 'Use a 6-digit hex colour like #1A2B3C.',
            'dark.text': 'Required.',
        })
    })

    it('refuses a font the chain accepts but our apps cannot render', () => {
        expect(validateDenomBranding({ ...DEFAULT_DENOM_BRANDING, font: 'comic-sans' }).font).toBe('Pick one of the listed fonts.')
        expect(validateDenomBranding({ ...DEFAULT_DENOM_BRANDING, font: '' }).font).toBe('Pick a font.')
    })
})
