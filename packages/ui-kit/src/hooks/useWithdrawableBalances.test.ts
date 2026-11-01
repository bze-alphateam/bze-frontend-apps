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

// BFE-329: a balance from BZE Scan's list follows withdraw_allowed and Scan's routes / counterparty.
describe('useWithdrawableBalances with assets from BZE Scan', () => {
    const scanChain = (chainName: string, chainId: string, prefix: string) => ({
        chainName, chainId, prettyName: `${chainName} (Scan)`, logo: `${chainName}.svg`, bech32Prefix: prefix, rest: [],
    })
    const scanRoute = (chainName: string, chainId: string, prefix: string, channelId: string) => ({
        chain: scanChain(chainName, chainId, prefix), channelId, counterpartyChannelId: 'channel-1', counterpartyDenom: 'ibc/X',
    })

    beforeEach(() => {
        // The channel pool would offer osmosis to everything: Scan coins must ignore it.
        state.ibcChains = [channel('osmosis', 'channel-2')]
    })

    it('offers a BZE coin the chains of its Scan routes only, Osmosis preselected', () => {
        state.balances = [{
            ...balance('ubze', 'BZE'),
            scan: { depositAllowed: true, withdrawAllowed: true, routes: [scanRoute('noble', 'noble-1', 'noble', 'channel-3'), scanRoute('osmosis', 'osmosis-1', 'osmo', 'channel-0')] },
        }]
        const { result } = renderHook(() => useWithdrawableBalances())

        const [bze] = result.current.assets
        expect(bze.destinations.map(d => [d.chainName, d.bzeSideChannelId, d.displayName])).toEqual([
            ['noble', 'channel-3', 'noble (Scan)'],
            ['osmosis', 'channel-0', 'osmosis (Scan)'],
        ])
        expect(bze.defaultDestination?.chainName).toBe('osmosis')
    })

    it('hides balances Scan does not allow to withdraw', () => {
        state.balances = [{ ...balance('ubze', 'BZE'), scan: { depositAllowed: true, withdrawAllowed: false, routes: [scanRoute('osmosis', 'osmosis-1', 'osmo', 'channel-0')] } }]
        const { result } = renderHook(() => useWithdrawableBalances())
        expect(result.current.assets).toEqual([])
    })

    it('locks an IBC voucher to Scan\'s counterparty', () => {
        state.balances = [{
            ...balance('ibc/ATOM', 'ATOM'), type: 'IBC',
            IBCData: { chain: { channelId: 'channel-5' }, counterparty: { chainName: 'cosmoshub', chainPrettyName: 'Cosmos Hub', channelId: 'channel-500', baseDenom: 'uatom' } },
            scan: { depositAllowed: true, withdrawAllowed: true, routes: [], counterparty: scanChain('cosmoshub', 'cosmoshub-4', 'cosmos') },
        }]
        const { result } = renderHook(() => useWithdrawableBalances())

        expect(result.current.assets[0].destinations).toEqual([{
            chainName: 'cosmoshub', chainId: 'cosmoshub-4', displayName: 'cosmoshub (Scan)', logo: 'cosmoshub.svg',
            addressPrefix: 'cosmos', bzeSideChannelId: 'channel-5', restUrls: undefined,
        }])
        expect(result.current.assets[0].isDestinationLocked).toBe(true)
    })
})
