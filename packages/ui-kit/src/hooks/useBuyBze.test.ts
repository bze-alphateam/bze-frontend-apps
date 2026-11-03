// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// The connected BeeZee wallet, the Skip route and Keplr (window.keplr) are fed directly; the
// pickers' data hooks answer empty. Only how the hook reaches the other chains is under test.
const { connected, keplr } = vi.hoisted(() => ({
    connected: { name: 'keplr-extension' },
    keplr: {
        getKey: vi.fn(),
        enable: vi.fn(),
    },
}))

vi.mock('@interchain-kit/react', () => ({
    useChain: () => ({ address: 'bze1buyer', wallet: { info: { name: connected.name } } }),
    useWalletManager: () => ({ addChains: vi.fn() }),
}))
vi.mock('./useSkipChains', () => ({ useSkipChains: () => ({ chains: [], isLoading: false, error: undefined }) }))
vi.mock('./useSkipAssets', () => ({ useSkipAssets: () => ({ assets: [], isLoading: false, error: undefined }) }))
vi.mock('./useBuyRoute', () => ({
    // A Cosmos route that needs an address on Osmosis.
    useBuyRoute: () => ({ routePreview: undefined, rawRoute: { required_chain_addresses: ['osmosis-1'] }, isLoading: false, error: undefined }),
}))
vi.mock('./useSkipBridgeTransfer', () => ({
    useSkipBridgeTransfer: () => ({ executeSkipTransfer: vi.fn(), isExecuting: false, progressMessage: '' }),
}))
vi.mock('../evm/context', () => ({ useEvmWalletState: () => ({ isConnected: false, address: undefined }) }))
vi.mock('./useEvmWallet', () => ({ useEvmWallet: () => ({ isConnected: false }) }))
vi.mock('./useToast', () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }))

import { useBuyBze } from './useBuyBze'

describe('useBuyBze and Keplr', () => {
    beforeEach(() => {
        connected.name = 'keplr-extension'
        keplr.getKey.mockReset().mockResolvedValue({ bech32Address: 'osmo1buyer' })
        keplr.enable.mockReset().mockResolvedValue(undefined)
        ;(window as unknown as { keplr?: typeof keplr }).keplr = keplr
    })

    afterEach(() => {
        delete (window as unknown as { keplr?: typeof keplr }).keplr
    })

    it('with Keplr: finds the existing Osmosis key, and enables the chain on connect', async () => {
        const { result } = renderHook(() => useBuyBze())

        await waitFor(() => expect(keplr.getKey).toHaveBeenCalledWith('osmosis-1'))
        await act(async () => { await result.current.handleConnectAll() })

        expect(keplr.enable).toHaveBeenCalledWith('osmosis-1')
        expect(result.current.allChainsConnected).toBe(true)
    })

    it('with BeePocket: never calls Keplr and never reports the other chains connected', async () => {
        connected.name = 'beepocket-extension'
        const { result } = renderHook(() => useBuyBze())

        await act(async () => { await result.current.handleConnectAll() })

        expect(keplr.getKey).not.toHaveBeenCalled()
        expect(keplr.enable).not.toHaveBeenCalled()
        expect(result.current.allChainsConnected).toBe(false)
        expect(result.current.needsConnect).toBe(true)
    })
})
