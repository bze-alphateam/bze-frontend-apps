import { describe, it, expect } from 'vitest'
import {
    isFactoryDenom,
    isIbcDenom,
    isLpDenom,
    isNativeDenom,
    getDenomType,
    truncateDenom,
} from './denom'
import {
    ASSET_TYPE_FACTORY,
    ASSET_TYPE_IBC,
    ASSET_TYPE_LP,
    ASSET_TYPE_NATIVE,
} from '../constants/assets'

const FACTORY_DENOM = 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl'
const IBC_DENOM = 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4'
const LP_DENOM_LEGACY = 'ulp_ubze_uusdt'
const LP_DENOM_HASHED = 'ulp/AB12CD34EF56'

describe('denom classification', () => {
    it('detects factory denoms', () => {
        expect(isFactoryDenom(FACTORY_DENOM)).toBe(true)
        expect(isFactoryDenom('ubze')).toBe(false)
    })

    it('detects ibc denoms', () => {
        expect(isIbcDenom(IBC_DENOM)).toBe(true)
        expect(isIbcDenom(FACTORY_DENOM)).toBe(false)
    })

    it('detects both legacy and hashed LP denoms', () => {
        expect(isLpDenom(LP_DENOM_LEGACY)).toBe(true)
        expect(isLpDenom(LP_DENOM_HASHED)).toBe(true)
        expect(isLpDenom('ulpx')).toBe(false)
        expect(isLpDenom('ubze')).toBe(false)
    })

    it('detects the chain native denom (ubze by default)', () => {
        expect(isNativeDenom('ubze')).toBe(true)
        expect(isNativeDenom('uatom')).toBe(false)
    })
})

describe('getDenomType', () => {
    it('maps each denom family to its asset type', () => {
        expect(getDenomType(FACTORY_DENOM)).toBe(ASSET_TYPE_FACTORY)
        expect(getDenomType(IBC_DENOM)).toBe(ASSET_TYPE_IBC)
        expect(getDenomType(LP_DENOM_LEGACY)).toBe(ASSET_TYPE_LP)
        expect(getDenomType(LP_DENOM_HASHED)).toBe(ASSET_TYPE_LP)
        expect(getDenomType('ubze')).toBe(ASSET_TYPE_NATIVE)
    })

    it('falls back to native for unknown denoms (current behavior)', () => {
        expect(getDenomType('uatom')).toBe(ASSET_TYPE_NATIVE)
    })
})

describe('truncateDenom', () => {
    it('keeps short denoms unchanged', () => {
        expect(truncateDenom('ubze')).toBe('ubze')
    })

    it('truncates long denoms from the center with an ellipsis', () => {
        const truncated = truncateDenom(IBC_DENOM)
        expect(truncated.length).toBeLessThanOrEqual(9) // 8 chars + ellipsis
        expect(truncated).toContain('…')
        expect(truncated.startsWith('ibc/')).toBe(true)
    })
})
