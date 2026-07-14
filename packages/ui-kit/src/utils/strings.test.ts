import { describe, it, expect } from 'vitest'
import { stringTruncateFromCenter, removeLeadingZeros } from './strings'

describe('stringTruncateFromCenter', () => {
    it('returns short strings unchanged', () => {
        expect(stringTruncateFromCenter('ubze', 8)).toBe('ubze')
        expect(stringTruncateFromCenter('12345678', 8)).toBe('12345678')
    })

    it('truncates from the center with an ellipsis', () => {
        expect(stringTruncateFromCenter('verylongdenom', 8)).toBe('very…nom')
    })

    it('keeps both ends of a bech32 address visible', () => {
        const addr = 'bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk'
        const truncated = stringTruncateFromCenter(addr, 12)
        expect(truncated.startsWith('bze13g')).toBe(true)
        expect(truncated.endsWith('pyhqk')).toBe(true)
        expect(truncated).toContain('…')
    })
})

describe('removeLeadingZeros', () => {
    it('strips leading zeros', () => {
        expect(removeLeadingZeros('000123')).toBe('123')
    })

    it('returns "0" when the string is all zeros', () => {
        expect(removeLeadingZeros('0000')).toBe('0')
    })

    it('leaves strings without leading zeros unchanged', () => {
        expect(removeLeadingZeros('123')).toBe('123')
    })
})
