import { describe, it, expect } from 'vitest'
import BigNumber from 'bignumber.js'
import { assetUsdPrice } from './usd_price'

const bn = (v: number) => new BigNumber(v)

describe('assetUsdPrice', () => {
    it('takes the USDC price when there is one, not an average with the BZE route', () => {
        // testnet LMN: 0.5 USDC on its USDC market, 74 BZE in a thin BZE pool at 0.76 USD per BZE
        expect(assetUsdPrice(bn(0.5), bn(74), bn(0.76)).toNumber()).toBe(0.5)
    })

    it('prices through BZE when there is no USDC price', () => {
        expect(assetUsdPrice(bn(0), bn(10), bn(0.5)).toNumber()).toBe(5)
    })

    it('is 0 when neither route has a price', () => {
        expect(assetUsdPrice(bn(0), bn(0), bn(0.5)).toNumber()).toBe(0)
    })
})
