// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import BigNumber from 'bignumber.js'

import type { IBCData } from '../types/asset'

// Balances and the IBC channel list are fed directly; chain-registry stays real
// (osmosis is a known chain there, the made-up counterparty is not).
const { state } = vi.hoisted(() => ({
    state: { balances: [] as unknown[], ibcChains: [] as unknown[] },
}))

vi.mock('./useBalances', () => ({ useBalances: () => ({ assetsBalances: state.balances, isLoading: false }) }))
vi.mock('./useAssets', () => ({ useAssetsContext: () => ({ ibcChains: state.ibcChains }) }))

import { useWithdrawableBalances } from './useWithdrawableBalances'

const channel = (chainName: string, channelId: string): IBCData => ({
    chain: { channelId },
    counterparty: { chainName, chainPrettyName: chainName, channelId: 'channel-0', baseDenom: 'uatom' },
}) as IBCData

const balance = (denom: string, ticker: string) => ({
    denom, ticker, name: ticker, logo: '', decimals: 6, verified: true, type: 'Native',
    amount: new BigNumber(1_000_000), USDValue: new BigNumber(0),
})

describe('useWithdrawableBalances', () => {
    beforeEach(() => {
        state.balances = [balance('ubze', 'BZE'), balance('factory/bze1owner/utok', 'TOK')]
        state.ibcChains = []
    })

    it('lists no BZE or factory token when no chain can receive it', () => {
        state.ibcChains = [channel('notaregisteredchain', 'channel-7')]
        const { result } = renderHook(() => useWithdrawableBalances())
        expect(result.current.assets).toEqual([])
    })

    it('lists no BZE or factory token without any IBC channel', () => {
        const { result } = renderHook(() => useWithdrawableBalances())
        expect(result.current.assets).toEqual([])
    })

    it('lists BZE and factory tokens with every reachable chain, Osmosis preselected', () => {
        state.ibcChains = [channel('osmosis', 'channel-2'), channel('notaregisteredchain', 'channel-7')]
        const { result } = renderHook(() => useWithdrawableBalances())

        expect(result.current.assets.map(a => a.balance.ticker).sort()).toEqual(['BZE', 'TOK'])
        for (const asset of result.current.assets) {
            expect(asset.destinations.map(d => d.chainName)).toEqual(['osmosis'])
            expect(asset.defaultDestination?.chainName).toBe('osmosis')
            expect(asset.isDestinationLocked).toBe(false)
        }
    })
})
