import { describe, expect, it } from 'vitest'

import { STABLE_COINS } from './assets'

describe('STABLE_COINS', () => {
    it('treats both mainnet USDC denoms as stablecoins during the Noble wind-down', () => {
        // USDC.n (Noble) stays a stablecoin: holders keep trading and withdrawing it.
        expect(STABLE_COINS['ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4']).toBe(true)
        // USDC.inj (Injective) is its replacement.
        expect(STABLE_COINS['ibc/81DA528F4C5546208D1D50F84C2D0B388B45D37AA36FCA622A3CB2D8EF014838']).toBe(true)
    })
})
