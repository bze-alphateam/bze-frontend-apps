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
