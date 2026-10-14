import { describe, expect, it } from 'vitest'

import type { Asset } from '../types/asset'
import { LEGACY_ASSET_NOTICES } from '../constants/assets'
import { getLegacyAssetNotice, isIbcInboundBlocked } from './ibc_inbound'

const USDC_N_DENOM = 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4'
const USDC_INJ_DENOM = 'ibc/81DA528F4C5546208D1D50F84C2D0B388B45D37AA36FCA622A3CB2D8EF014838'

const ibcAsset = (denom: string, channelId: string, chainName: string, baseDenom: string): Asset => ({
    type: 'IBC',
    denom,
    decimals: 6,
    name: denom,
    ticker: denom,
    logo: '',
    stable: true,
    verified: true,
    supply: BigInt(0),
    IBCData: {
        chain: { channelId },
        counterparty: { chainName, chainPrettyName: chainName, channelId: 'channel-x', baseDenom },
    },
})

const USDC_N = ibcAsset(USDC_N_DENOM, 'channel-3', 'noble', 'uusdc')
const USDC_INJ = ibcAsset(USDC_INJ_DENOM, 'channel-13', 'injective', 'erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a')
const NOBLE_BLOCK = [{ channelId: 'channel-3', baseDenom: 'uusdc' }]

describe('isIbcInboundBlocked', () => {
    it('blocks an asset whose BZE channel and base denom match an entry', () => {
        expect(isIbcInboundBlocked(USDC_N, NOBLE_BLOCK)).toBe(true)
    })

    it('does not block other assets', () => {
        expect(isIbcInboundBlocked(USDC_INJ, NOBLE_BLOCK)).toBe(false)
    })

    it('needs both the channel and the base denom to match', () => {
        expect(isIbcInboundBlocked(USDC_N, [{ channelId: 'channel-13', baseDenom: 'uusdc' }])).toBe(false)
        expect(isIbcInboundBlocked(USDC_N, [{ channelId: 'channel-3', baseDenom: 'uatom' }])).toBe(false)
    })

    it('compares exactly (no case folding, no prefix match)', () => {
        expect(isIbcInboundBlocked(USDC_N, [{ channelId: 'Channel-3', baseDenom: 'uusdc' }])).toBe(false)
        expect(isIbcInboundBlocked(USDC_N, [{ channelId: 'channel-3', baseDenom: 'UUSDC' }])).toBe(false)
        expect(isIbcInboundBlocked(USDC_N, [{ channelId: 'channel-30', baseDenom: 'uusdc' }])).toBe(false)
    })

    it('matches any entry of a longer list', () => {
        expect(isIbcInboundBlocked(USDC_INJ, [
            ...NOBLE_BLOCK,
            { channelId: 'channel-13', baseDenom: 'erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a' },
        ])).toBe(true)
    })

    it('fails open when the list is unknown or empty', () => {
        expect(isIbcInboundBlocked(USDC_N, undefined)).toBe(false)
        expect(isIbcInboundBlocked(USDC_N, [])).toBe(false)
    })

    it('never blocks an asset without an IBC trace', () => {
        const native: Asset = { ...USDC_N, denom: 'ubze', IBCData: undefined }
        expect(isIbcInboundBlocked(native, NOBLE_BLOCK)).toBe(false)
    })
})

describe('getLegacyAssetNotice', () => {
    it('returns the USDC.n notice while its deposits are blocked', () => {
        const notice = getLegacyAssetNotice(USDC_N, NOBLE_BLOCK)

        expect(notice).toBe(LEGACY_ASSET_NOTICES[USDC_N_DENOM])
        expect(notice?.text).toContain('Circle is retiring')
    })

    it('returns nothing before the block is live', () => {
        expect(getLegacyAssetNotice(USDC_N, [])).toBeUndefined()
        expect(getLegacyAssetNotice(USDC_N, undefined)).toBeUndefined()
    })

    it('returns nothing for a blocked asset without a notice', () => {
        const injBlock = [{ channelId: 'channel-13', baseDenom: 'erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a' }]
        expect(getLegacyAssetNotice(USDC_INJ, injBlock)).toBeUndefined()
    })

    it('returns nothing without an asset', () => {
        expect(getLegacyAssetNotice(undefined, NOBLE_BLOCK)).toBeUndefined()
    })
})
