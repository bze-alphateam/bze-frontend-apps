import { describe, it, expect } from 'vitest'
import { sanitizeNumberInput } from './number'

describe('sanitizeNumberInput', () => {
    it('keeps digits and one decimal separator', () => {
        expect(sanitizeNumberInput('1a2,5')).toBe('12.5')
        expect(sanitizeNumberInput('1.2.3')).toBe('1.23')
        expect(sanitizeNumberInput('.')).toBe('.')
    })

    it('leaves decimals alone without maxDecimals', () => {
        expect(sanitizeNumberInput('1.123456789')).toBe('1.123456789')
    })

    // regression: forms let users type more decimals than the asset holds, which became
    // fractional micro-units in the message
    it('caps the fraction at maxDecimals', () => {
        expect(sanitizeNumberInput('1.1234567', 6)).toBe('1.123456')
        expect(sanitizeNumberInput('1.12', 6)).toBe('1.12')
        expect(sanitizeNumberInput('1.', 6)).toBe('1.')
        expect(sanitizeNumberInput('0,0000009', 6)).toBe('0.000000')
    })

    it('accepts no separator for a 0-decimal asset', () => {
        expect(sanitizeNumberInput('1.5', 0)).toBe('1')
        expect(sanitizeNumberInput('15', 0)).toBe('15')
    })
})
