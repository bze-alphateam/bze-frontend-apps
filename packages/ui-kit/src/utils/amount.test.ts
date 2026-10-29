import { describe, it, expect } from 'vitest'
import BigNumber from 'bignumber.js'
import {
    toBigNumber,
    uAmountToAmount,
    uAmountToBigNumberAmount,
    amountToUAmount,
    amountToBigNumberUAmount,
    prettyAmount,
    priceToUPrice,
    priceToBigNumberUPrice,
    uPriceToPrice,
    uPriceToBigNumberPrice,
    uPriceToMsgPrice,
} from './amount'

describe('toBigNumber', () => {
    it('accepts numbers', () => {
        expect(toBigNumber(42).toString()).toBe('42')
    })

    it('accepts strings', () => {
        expect(toBigNumber('123.456').toString()).toBe('123.456')
    })

    it('accepts bigints', () => {
        expect(toBigNumber(BigInt(1000000)).toString()).toBe('1000000')
    })

    it('returns the same instance for BigNumber input', () => {
        const bn = new BigNumber(7)
        expect(toBigNumber(bn)).toBe(bn)
    })

    it('produces NaN for garbage input', () => {
        expect(toBigNumber('not a number').isNaN()).toBe(true)
    })
})

describe('uAmountToAmount', () => {
    it('converts micro units to display units', () => {
        expect(uAmountToAmount('1000000', 6)).toBe('1')
        expect(uAmountToAmount('1234567', 6)).toBe('1.234567')
        expect(uAmountToAmount(1, 6)).toBe('0.000001')
    })

    it('treats undefined as zero', () => {
        expect(uAmountToAmount(undefined, 6)).toBe('0')
    })

    it('handles amounts larger than Number.MAX_SAFE_INTEGER without precision loss', () => {
        expect(uAmountToAmount('123456789012345678901', 6)).toBe('123456789012345.678901')
    })

    it('rounds to the given number of decimals', () => {
        // extra precision beyond noOfDecimals is rounded away
        expect(uAmountToAmount('15', 1)).toBe('1.5')
        expect(uAmountToAmount('155', 2)).toBe('1.55')
    })
})

describe('amountToUAmount', () => {
    it('converts display units to micro units', () => {
        expect(amountToUAmount('1', 6)).toBe('1000000')
        expect(amountToUAmount('1.234567', 6)).toBe('1234567')
        expect(amountToUAmount(0.5, 6)).toBe('500000')
    })

    it('round-trips with uAmountToAmount', () => {
        const original = '123456.789012'
        expect(uAmountToAmount(amountToUAmount(original, 6), 6)).toBe(original)
    })

    // regression: digits past the asset's decimals used to survive as fractional micro-units
    // ("1000000.1"), which the chain's Int parser rejects
    it('drops digits past the asset decimals, never rounding up', () => {
        expect(amountToUAmount('1.0000001', 6)).toBe('1000000')
        expect(amountToUAmount('1.9999999', 6)).toBe('1999999')
        expect(amountToUAmount('0.0000001', 6)).toBe('0')
    })

    // regression: a 0-decimal asset kept 6 fractional places ("1.5")
    it('gives whole units for a 0-decimal asset', () => {
        expect(amountToUAmount('1.5', 0)).toBe('1')
        expect(amountToUAmount('7', 0)).toBe('7')
    })

    // regression: toString() switches to "1e+21" from 1e21 micro-units on
    it('never uses exponent notation for large amounts', () => {
        expect(amountToUAmount('1000', 18)).toBe('1000000000000000000000')
        expect(amountToUAmount('1000000000000000', 6)).toBe('1000000000000000000000')
    })
})

describe('amountToBigNumberUAmount / uAmountToBigNumberAmount', () => {
    it('amountToBigNumberUAmount returns whole micro-units', () => {
        expect(amountToBigNumberUAmount('2.0000005', 6).toString()).toBe('2000000')
        expect(amountToBigNumberUAmount('2.5', 0).isInteger()).toBe(true)
    })

    it('are BigNumber-returning counterparts of the string versions', () => {
        expect(amountToBigNumberUAmount('2.5', 6)).toBeInstanceOf(BigNumber)
        expect(amountToBigNumberUAmount('2.5', 6).toString()).toBe('2500000')
        expect(uAmountToBigNumberAmount('2500000', 6).toString()).toBe('2.5')
    })
})

describe('prettyAmount', () => {
    it('returns "0" for NaN input', () => {
        expect(prettyAmount('garbage')).toBe('0')
    })

    it('shows 6 decimals for values between 0 and 1', () => {
        expect(prettyAmount(0.5)).toBe('0.500000')
        expect(prettyAmount('0.000001')).toBe('0.000001')
    })

    it('formats values >= 1 with thousand separators', () => {
        expect(prettyAmount(1234567)).toBe('1,234,567')
        expect(prettyAmount('1000')).toBe('1,000')
    })

    it('formats zero and negatives through Intl', () => {
        expect(prettyAmount(0)).toBe('0')
        expect(prettyAmount(-1234.5)).toBe('-1,234.5')
    })
})

describe('price conversions', () => {
    it('priceToUPrice applies quote-base exponent shift with 14 decimals', () => {
        // same exponents: price unchanged
        expect(priceToUPrice(new BigNumber('2'), 6, 6)).toBe('2.00000000000000')
        // quote has 6 decimals, base has 8: shift by 10^-2
        expect(priceToUPrice(new BigNumber('100'), 6, 8)).toBe('1.00000000000000')
    })

    it('uPriceToPrice is the inverse of priceToUPrice', () => {
        const uPrice = priceToUPrice(new BigNumber('0.025'), 6, 8)
        expect(uPriceToPrice(uPrice, 6, 8)).toBe('0.025')
    })

    // regression: the order form sent uPrice.toString(), which gives "5e-8" below 1e-7
    it('uPriceToMsgPrice gives plain notation with at most 18 decimals, truncated', () => {
        expect(uPriceToMsgPrice(new BigNumber('0.00000005'))).toBe('0.00000005')
        expect(uPriceToMsgPrice('0.0000000000000000019')).toBe('0.000000000000000001')
        expect(uPriceToMsgPrice('1234.5')).toBe('1234.5')
        expect(uPriceToMsgPrice(new BigNumber('1e21'))).toBe('1000000000000000000000')
    })

    it('BigNumber variants agree with string variants', () => {
        expect(priceToBigNumberUPrice('3', 8, 6).toString()).toBe('300')
        expect(uPriceToBigNumberPrice('300', 8, 6).toString()).toBe('3')
    })
})
