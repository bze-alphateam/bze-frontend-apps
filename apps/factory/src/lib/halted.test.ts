import { describe, it, expect } from 'vitest'
import type { Asset } from '@bze/bze-ui-kit'
import { haltedPairError } from './halted'

const asset = (ticker: string, halted?: boolean): Asset => ({
    type: 'Factory', denom: `factory/bze1x/u${ticker.toLowerCase()}`, decimals: 6, name: ticker, ticker, logo: '',
    stable: false, verified: false, supply: 1n, halted,
})

describe('haltedPairError', () => {
    it('is empty when no side is halted or the assets are unknown', () => {
        expect(haltedPairError(asset('AAA'), asset('BZE', false))).toBe('')
        expect(haltedPairError(undefined, undefined)).toBe('')
    })

    it('names the halted side, base or quote', () => {
        expect(haltedPairError(asset('HALT', true), asset('BZE'))).toMatch(/^HALT is no longer tradeable on BZE/)
        expect(haltedPairError(asset('BZE'), asset('HALT', true))).toMatch(/^HALT is no longer tradeable on BZE/)
    })

    it('names both sides when both are halted', () => {
        expect(haltedPairError(asset('ONE', true), asset('TWO', true))).toMatch(/^ONE and TWO are no longer tradeable/)
    })
})
