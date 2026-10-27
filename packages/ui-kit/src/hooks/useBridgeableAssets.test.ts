// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import type { Asset } from '../types/asset'
import type { TxFeeCollectorParamsCache } from '../query/txfeecollector_params'

// The hook reads the user's BZE assets from the app's assets context and the chain's
// inbound block list from the txfeecollector params query; both are fed directly.
// chain-registry stays real: noble and injective are BZE counterparties there.
const { useAssetsContextMock, getTxFeeCollectorParamsMock } = vi.hoisted(() => ({
    useAssetsContextMock: vi.fn(),
    getTxFeeCollectorParamsMock: vi.fn(),
}))

vi.mock('./useAssets', () => ({ useAssetsContext: () => useAssetsContextMock() }))
vi.mock('../query/txfeecollector_params', () => ({
    getTxFeeCollectorParams: () => getTxFeeCollectorParamsMock(),
}))

import { useBridgeableAssets } from './useBridgeableAssets'

const USDC_N_DENOM = 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4'
const USDC_INJ_DENOM = 'ibc/81DA528F4C5546208D1D50F84C2D0B388B45D37AA36FCA622A3CB2D8EF014838'

const ibcAsset = (denom: string, ticker: string, bzeChannel: string, chainName: string, cpChannel: string, baseDenom: string): Asset => ({
    type: 'IBC',
    denom,
    decimals: 6,
    name: ticker,
    ticker,
    logo: '',
    stable: true,
    verified: true,
    supply: BigInt(1000),
    IBCData: {
        chain: { channelId: bzeChannel },
        counterparty: { chainName, chainPrettyName: chainName, channelId: cpChannel, baseDenom },
    },
})

const USDC_N = ibcAsset(USDC_N_DENOM, 'USDC.n', 'channel-3', 'noble', 'channel-95', 'uusdc')
const USDC_INJ = ibcAsset(USDC_INJ_DENOM, 'USDC.inj', 'channel-13', 'injective', 'channel-496', 'erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a')

const bzeCoin = (denom: string, ticker: string, type: string, verified = true): Asset => ({
    type,
    denom,
    decimals: 6,
    name: ticker,
    ticker,
    logo: '',
    stable: false,
    verified,
    supply: BigInt(1000),
})

const BZE = bzeCoin('ubze', 'BZE', 'Native')
const GGE_DENOM = 'factory/bze12gyp30f29zg26nuqrwdhl26ej4q066pt572fhm/GGE'
const GGE = bzeCoin(GGE_DENOM, 'GGE', 'Factory')
const AAA = bzeCoin('factory/bze1aaa/uaaa', 'AAA', 'Factory', false)
const LP = bzeCoin('ulp_1', 'LP', 'LP')

// BZE ↔ Osmosis is channel-0 ↔ channel-340; the vouchers are the ones chain-registry lists on Osmosis.
const OSMO_ROUTE = { chain: { channelId: 'channel-0' }, counterparty: { chainName: 'osmosis', chainPrettyName: 'Osmosis', channelId: 'channel-340', baseDenom: 'uosmo' } }
const BZE_ON_OSMOSIS = 'ibc/C822645522FC3EECF817609AA38C24B64D04F5C267A23BCCF8F2E3BC5755FA88'
const GGE_ON_OSMOSIS = 'ibc/AAC5DA36E48226B906DE694EA8B0464DE5EE45D7449984E4D799F33B8089CD6B'

const params = (blockedIbcInbound: TxFeeCollectorParamsCache['blockedIbcInbound']): TxFeeCollectorParamsCache => ({
    validatorMinGasFee: { denom: 'ubze', amount: '0.01' },
    blockedIbcInbound,
})

const depositDenoms = (assets: { bzeAsset: Asset }[]) => assets.map(a => a.bzeAsset.denom).sort()

describe('useBridgeableAssets', () => {
    beforeEach(() => {
        useAssetsContextMock.mockReturnValue({
            assetsMap: new Map([[USDC_N_DENOM, USDC_N], [USDC_INJ_DENOM, USDC_INJ]]),
            isLoading: false,
        })
        getTxFeeCollectorParamsMock.mockReset()
    })

    it('drops assets the chain refuses and reports them as blocked', async () => {
        getTxFeeCollectorParamsMock.mockResolvedValue(params([{ channelId: 'channel-3', baseDenom: 'uusdc' }]))

        const { result } = renderHook(() => useBridgeableAssets())

        await waitFor(() => expect(result.current.blockedAssets.map(a => a.denom)).toEqual([USDC_N_DENOM]))
        expect(depositDenoms(result.current.assets)).toEqual([USDC_INJ_DENOM])
        expect(result.current.chains.flatMap(c => c.assets.map(a => a.bzeAsset.denom))).toEqual([USDC_INJ_DENOM])
    })

    it('offers every asset when no entry matches', async () => {
        getTxFeeCollectorParamsMock.mockResolvedValue(params([{ channelId: 'channel-99', baseDenom: 'uusdc' }]))

        const { result } = renderHook(() => useBridgeableAssets())

        await waitFor(() => expect(getTxFeeCollectorParamsMock).toHaveBeenCalled())
        expect(depositDenoms(result.current.assets)).toEqual([USDC_N_DENOM, USDC_INJ_DENOM].sort())
        expect(result.current.blockedAssets).toEqual([])
    })

    it('fails open when the params are unavailable', async () => {
        getTxFeeCollectorParamsMock.mockResolvedValue(undefined)

        const { result } = renderHook(() => useBridgeableAssets())

        await waitFor(() => expect(getTxFeeCollectorParamsMock).toHaveBeenCalled())
        expect(depositDenoms(result.current.assets)).toEqual([USDC_N_DENOM, USDC_INJ_DENOM].sort())
        expect(result.current.blockedAssets).toEqual([])
    })

    it('offers every asset while the params are still loading', () => {
        getTxFeeCollectorParamsMock.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useBridgeableAssets())

        expect(depositDenoms(result.current.assets)).toEqual([USDC_N_DENOM, USDC_INJ_DENOM].sort())
    })
})

describe('useBridgeableAssets — BZE coins coming back', () => {
    beforeEach(() => {
        getTxFeeCollectorParamsMock.mockReset()
        getTxFeeCollectorParamsMock.mockResolvedValue(params([]))
        useAssetsContextMock.mockReturnValue({
            assetsMap: new Map<string, Asset>([
                [AAA.denom, AAA], [GGE_DENOM, GGE], [USDC_INJ_DENOM, USDC_INJ], [LP.denom, LP], ['ubze', BZE],
            ]),
            ibcChains: [USDC_INJ.IBCData, USDC_N.IBCData, OSMO_ROUTE],
            isLoading: false,
        })
    })

    it('offers BZE and factory tokens from every channel, sending their voucher there', async () => {
        const { result } = renderHook(() => useBridgeableAssets())
        await waitFor(() => expect(getTxFeeCollectorParamsMock).toHaveBeenCalled())

        const fromOsmosis = result.current.assets.filter(a => a.counterparty.chainName === 'osmosis')
        expect(fromOsmosis.map(a => [a.bzeAsset.ticker, a.kind, a.sourceDenom])).toEqual([
            ['BZE', 'native', BZE_ON_OSMOSIS],
            ['GGE', 'factory', GGE_ON_OSMOSIS],
            ['AAA', 'factory', expect.stringMatching(/^ibc\/[0-9A-F]{64}$/)],
        ])
        // Signed on Osmosis through its end of the channel; arrives on BZE's channel-0.
        expect(fromOsmosis[0].ibcData).toEqual({
            chain: { channelId: 'channel-0' },
            counterparty: { chainName: 'osmosis', chainPrettyName: 'Osmosis', channelId: 'channel-340', baseDenom: 'ubze' },
        })
    })

    it('orders BZE first, then vouchers, then factory tokens verified first, Osmosis first per coin', async () => {
        const { result } = renderHook(() => useBridgeableAssets())
        await waitFor(() => expect(getTxFeeCollectorParamsMock).toHaveBeenCalled())

        expect(result.current.assets.map(a => `${a.bzeAsset.ticker}@${a.counterparty.chainName}`)).toEqual([
            'BZE@osmosis', 'BZE@injective', 'BZE@noble',
            'USDC.inj@injective',
            'GGE@osmosis', 'GGE@injective', 'GGE@noble',
            'AAA@osmosis', 'AAA@injective', 'AAA@noble',
        ])
    })

    it('never offers LP shares', async () => {
        const { result } = renderHook(() => useBridgeableAssets())
        await waitFor(() => expect(getTxFeeCollectorParamsMock).toHaveBeenCalled())

        expect(result.current.assets.some(a => a.bzeAsset.denom === LP.denom)).toBe(false)
    })

    it('offers no BZE coin route when no channel is known', async () => {
        useAssetsContextMock.mockReturnValue({
            assetsMap: new Map<string, Asset>([['ubze', BZE], [USDC_INJ_DENOM, USDC_INJ]]),
            ibcChains: [],
            isLoading: false,
        })
        const { result } = renderHook(() => useBridgeableAssets())
        await waitFor(() => expect(getTxFeeCollectorParamsMock).toHaveBeenCalled())

        expect(depositDenoms(result.current.assets)).toEqual([USDC_INJ_DENOM])
    })

    it('keeps the voucher base denom as the source denom of an IBC asset', async () => {
        const { result } = renderHook(() => useBridgeableAssets())
        await waitFor(() => expect(getTxFeeCollectorParamsMock).toHaveBeenCalled())

        const usdc = result.current.assets.find(a => a.bzeAsset.denom === USDC_INJ_DENOM)
        expect(usdc?.kind).toBe('ibc')
        expect(usdc?.sourceDenom).toBe(USDC_INJ.IBCData!.counterparty.baseDenom)
    })
})
