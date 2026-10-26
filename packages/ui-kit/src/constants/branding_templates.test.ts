import { describe, expect, it } from 'vitest'
import { BRANDING_TEMPLATE_MOODS, BRANDING_TEMPLATES, brandingFromTemplate } from './branding_templates'
import { BRANDING_PALETTES } from './branding'
import { contrastRatio, contrastText, validateDenomBranding } from '../utils/branding'

// WCAG AA for normal text.
const AA = 4.5

describe('BRANDING_TEMPLATES', () => {
    it('has 12 to 20 templates with unique ids and names', () => {
        expect(BRANDING_TEMPLATES.length).toBeGreaterThanOrEqual(12)
        expect(BRANDING_TEMPLATES.length).toBeLessThanOrEqual(20)
        expect(new Set(BRANDING_TEMPLATES.map(t => t.id)).size).toBe(BRANDING_TEMPLATES.length)
        expect(new Set(BRANDING_TEMPLATES.map(t => t.name)).size).toBe(BRANDING_TEMPLATES.length)
    })

    it('covers every mood', () => {
        for (const { mood } of BRANDING_TEMPLATE_MOODS) {
            expect(BRANDING_TEMPLATES.some(t => t.mood === mood), mood).toBe(true)
        }
    })

    it.each(BRANDING_TEMPLATES.map(t => [t.name, t] as const))('%s is a kit the editor can save (#rrggbb colours, a listed font)', (_, t) => {
        expect(validateDenomBranding(t.branding)).toEqual({})
    })

    it.each(BRANDING_TEMPLATES.flatMap(t => BRANDING_PALETTES.map(p => [t.name, p, t] as const)))('%s %s reaches AA', (_, palette, t) => {
        const { background, text, primary, secondary } = t.branding[palette]

        expect(contrastRatio(text, background), 'text on background').toBeGreaterThanOrEqual(AA)
        expect(contrastRatio(primary, background), 'primary on background').toBeGreaterThanOrEqual(AA)
        expect(contrastRatio(secondary, background), 'secondary on background').toBeGreaterThanOrEqual(AA)
        expect(contrastRatio(contrastText(primary), primary), 'button label on primary').toBeGreaterThanOrEqual(AA)
    })
})

describe('brandingFromTemplate', () => {
    it('fills the font and both palettes with a copy of the template', () => {
        const honey = BRANDING_TEMPLATES.find(t => t.id === 'honey')!
        const kit = brandingFromTemplate(honey)

        expect(kit).toEqual(honey.branding)
        kit.light.primary = '#000000'
        kit.dark.text = '#000000'
        expect(honey.branding.light.primary).toBe('#B45309')
        expect(honey.branding.dark.text).toBe('#FEF3C7')
    })
})

describe('contrastRatio / contrastText', () => {
    it('measures the WCAG ratio either way round', () => {
        expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21)
        expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21)
        expect(contrastRatio('#777777', '#777777')).toBe(1)
    })

    it('picks black on light colours and white on dark ones', () => {
        expect(contrastText('#FFD000')).toBe('#000000')
        expect(contrastText('#1A2B3C')).toBe('#FFFFFF')
    })
})
