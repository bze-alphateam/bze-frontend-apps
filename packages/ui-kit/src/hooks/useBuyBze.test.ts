// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { WalletState } from '@interchain-kit/core'

// The wallet kit is a small per-chain store that re-renders the hook when it changes, like the
// real one; Keplr (window.keplr), the EVM wallet and the Skip route are fed directly. The pickers'
// data hooks answer empty. Only how the hook reaches the source chain is under test.
const { kit, keplr, route, evm, executeSkip } = vi.hoisted(() => {
    const listeners = new Set<() => void>()
    const kit = {
        walletName: 'keplr-extension',
        chains: {} as Record<string, { status: string; address?: string }>,
        version: 0,
        connect: vi.fn(),
        hasSourceWallet: true,
        set(name: string, state: { status: string; address?: string }) {
            kit.chains[name] = state
            kit.version += 1
            listeners.forEach(listener => listener())
        },
        subscribe(listener: () => void) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
    }
    return {
        kit,
        keplr: {
            getKey: vi.fn(),
            enable: vi.fn(),
        },
        route: { current: { required_chain_addresses: ['osmosis-1', 'beezee-1'] } },
        evm: {
            state: { isConnected: false, address: undefined as string | undefined },
            wallet: { isConnected: false, chainId: 1, connectInjected: vi.fn(), switchChain: vi.fn() },
        },
        executeSkip: vi.fn(),
    }
})

vi.mock('@interchain-kit/react', async () => {
    const { useSyncExternalStore } = await import('react')
    return {
        useChain: (name: string) => {
            useSyncExternalStore(kit.subscribe, () => kit.version)
            const state = kit.chains[name] ?? { status: WalletState.Disconnected }
            const wallet = {
                info: { name: kit.walletName },
                connect: () => kit.connect(name),
                get walletState() { return kit.chains[name]?.status ?? WalletState.Disconnected },
                get errorMessage() { return '' },
            }
            return { ...state, wallet: name === 'beezee' || kit.hasSourceWallet ? wallet : undefined }
        },
        useWalletManager: () => ({ addChains: vi.fn() }),
    }
})
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getChainName: () => 'beezee',
    getWalletChainsNames: () => [{ chainName: 'beezee' }, { chainName: 'osmosis' }],
    // Nothing to add at runtime: a chain outside the list above stays unregistered.
    getChains: () => [],
    getAssetLists: () => [],
    getChainByChainId: (chainId: string) => (
        { 'osmosis-1': { chainName: 'osmosis' }, 'beezee-1': { chainName: 'beezee' } } as Record<string, { chainName: string }>
    )[chainId],
}))
vi.mock('../constants/endpoints', () => ({ getChainRestURL: async () => undefined }))
vi.mock('./useSkipChains', () => ({ useSkipChains: () => ({ chains: [], isLoading: false, error: undefined }) }))
vi.mock('./useSkipAssets', () => ({ useSkipAssets: () => ({ assets: [], isLoading: false, error: undefined }) }))
vi.mock('./useBuyRoute', () => ({
    useBuyRoute: () => ({ routePreview: undefined, rawRoute: route.current, isLoading: false, error: undefined }),
}))
vi.mock('./useSkipBridgeTransfer', () => ({
    useSkipBridgeTransfer: () => ({ executeSkipTransfer: executeSkip, isExecuting: false, progressMessage: '' }),
}))
vi.mock('../evm/context', () => ({ useEvmWalletState: () => evm.state }))
vi.mock('./useEvmWallet', () => ({ useEvmWallet: () => evm.wallet }))
vi.mock('./useToast', () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }))

import { useBuyBze, type UseBuyBzeResult } from './useBuyBze'
import type { SkipChainWithStatus } from './useSkipChains'
import type { SkipAsset } from '../types/cross_chain'

const cosmosChain = (chainId: string, chainName: string) =>
    ({ chain_id: chainId, chain_name: chainName, pretty_name: chainName, chain_type: 'cosmos', canSign: true }) as unknown as SkipChainWithStatus
const OSMOSIS = cosmosChain('osmosis-1', 'osmosis')
const ETHEREUM = { chain_id: '1', chain_name: 'ethereum', pretty_name: 'Ethereum', chain_type: 'evm', canSign: true } as unknown as SkipChainWithStatus
const ASSET = { denom: 'uosmo', symbol: 'OSMO', decimals: 6 } as unknown as SkipAsset

const connected = (address: string) => ({ status: WalletState.Connected as string, address })
/** Lets the hook's async detection finish, for the assertions that something did not happen. */
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

/** Renders the hook with `chain` picked as the source, its detection finished. */
async function renderWithSource(chain: SkipChainWithStatus) {
    const { result } = renderHook(() => useBuyBze())
    await act(async () => { await result.current.onChainSelect(chain) })
    await settle()
    return result
}

async function fillForm(result: { current: UseBuyBzeResult }) {
    act(() => {
        result.current.onAssetSelect(ASSET)
        result.current.onAmountChange('1')
    })
    await settle()
}

const connectAll = (result: { current: UseBuyBzeResult }) =>
    act(async () => { await result.current.handleConnectAll() })

/** The address the transfer would be given for `chainId`. */
async function transferAddressFor(result: { current: UseBuyBzeResult }, chainId: string) {
    await act(async () => { await result.current.handleExecute() })
    const getAddress = executeSkip.mock.calls[0][1] as (id: string) => Promise<string | undefined>
    return getAddress(chainId)
}

describe('useBuyBze source chain connection', () => {
    beforeEach(() => {
        kit.walletName = 'keplr-extension'
        kit.hasSourceWallet = true
        kit.chains = { beezee: connected('bze1buyer') }
        kit.connect.mockReset().mockImplementation(async (name: string) => {
            kit.set(name, connected('osmo1buyer'))
        })
        route.current = { required_chain_addresses: ['osmosis-1', 'beezee-1'] }
        keplr.getKey.mockReset().mockResolvedValue({ bech32Address: 'osmo1fromkeplr' })
        keplr.enable.mockReset().mockResolvedValue(undefined)
        ;(window as unknown as { keplr?: typeof keplr }).keplr = keplr
        evm.state = { isConnected: false, address: undefined }
        evm.wallet.isConnected = false
        evm.wallet.connectInjected.mockReset().mockResolvedValue(undefined)
        evm.wallet.switchChain.mockReset().mockResolvedValue(undefined)
        executeSkip.mockReset().mockResolvedValue({ success: false })
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        delete (window as unknown as { keplr?: typeof keplr }).keplr
        vi.restoreAllMocks()
    })

    it('a Keplr key alone does not mark the source connected on page load', async () => {
        const result = await renderWithSource(OSMOSIS)

        expect(keplr.getKey).not.toHaveBeenCalled()
        expect(result.current.allChainsConnected).toBe(false)
        expect(result.current.needsConnect).toBe(true)
    })

    it('goes straight on when the kit already has the account', async () => {
        kit.chains.osmosis = connected('osmo1buyer')
        const result = await renderWithSource(OSMOSIS)

        expect(result.current.allChainsConnected).toBe(true)
        expect(result.current.needsConnect).toBe(false)
        expect(kit.connect).not.toHaveBeenCalled()
    })

    it('picks up an account the kit gets while the form is open', async () => {
        const result = await renderWithSource(OSMOSIS)

        act(() => kit.set('osmosis', connected('osmo1buyer')))

        await waitFor(() => expect(result.current.allChainsConnected).toBe(true))
    })

    it('connects the source through the kit, and has its address only afterwards', async () => {
        const result = await renderWithSource(OSMOSIS)
        await fillForm(result)
        expect(await transferAddressFor(result, 'osmosis-1')).toBeUndefined()

        await connectAll(result)

        expect(kit.connect).toHaveBeenCalledWith('osmosis')
        expect(keplr.enable).not.toHaveBeenCalled()
        expect(result.current.allChainsConnected).toBe(true)
        expect(result.current.connectError).toBe('')
        executeSkip.mockClear()
        expect(await transferAddressFor(result, 'osmosis-1')).toBe('osmo1buyer')
    })

    it('a refused connect marks nothing connected and explains why', async () => {
        kit.connect.mockImplementation(async (name: string) => {
            kit.set(name, { status: WalletState.Disconnected })
        })
        const result = await renderWithSource(OSMOSIS)

        await connectAll(result)

        expect(result.current.allChainsConnected).toBe(false)
        expect(result.current.needsConnect).toBe(true)
        expect(result.current.connectError).toContain('osmosis')
    })

    it('does not trust an old account the kit keeps after a refused connect', async () => {
        kit.chains.osmosis = { status: WalletState.Disconnected, address: 'osmo1old' }
        kit.connect.mockImplementation(async () => {})
        const result = await renderWithSource(OSMOSIS)

        await connectAll(result)

        expect(result.current.allChainsConnected).toBe(false)
        expect(result.current.connectError).not.toBe('')
    })

    it('a wallet that is not there marks nothing connected and explains why', async () => {
        kit.hasSourceWallet = false
        delete (window as unknown as { keplr?: typeof keplr }).keplr
        const result = await renderWithSource(OSMOSIS)

        await connectAll(result)

        expect(result.current.allChainsConnected).toBe(false)
        expect(result.current.connectError).toContain('No wallet')
    })

    it('forgets a failed connect when the user picks something else', async () => {
        kit.hasSourceWallet = false
        const result = await renderWithSource(OSMOSIS)
        await connectAll(result)
        expect(result.current.connectError).not.toBe('')

        act(() => result.current.clearChain())

        expect(result.current.connectError).toBe('')
    })

    it('ignores a connect that finishes after the user changed the network', async () => {
        let finish = () => {}
        kit.connect.mockImplementation((name: string) => new Promise<void>(resolve => {
            finish = () => { kit.set(name, { status: WalletState.Disconnected }); resolve() }
        }))
        const result = await renderWithSource(OSMOSIS)

        let pending: Promise<void> = Promise.resolve()
        act(() => { pending = result.current.handleConnectAll() })
        act(() => result.current.clearChain())
        await act(async () => { finish(); await pending })

        expect(result.current.connectError).toBe('')
        expect(result.current.allChainsConnected).toBe(false)
    })

    it('keeps the buy button disabled until the source address exists', async () => {
        const result = await renderWithSource(OSMOSIS)
        await fillForm(result)
        expect(result.current.canExecute).toBe(false)

        await connectAll(result)

        expect(result.current.canExecute).toBe(true)

        // The kit loses the account: back to asking for the connection.
        act(() => kit.set('osmosis', { status: WalletState.Disconnected }))

        expect(result.current.canExecute).toBe(false)
        expect(result.current.needsConnect).toBe(true)
    })

    it('never uses the BeeZee address for a source the kit does not know yet', async () => {
        route.current = { required_chain_addresses: ['fresh-1', 'beezee-1'] }
        const result = await renderWithSource(cosmosChain('fresh-1', 'freshchain'))
        await fillForm(result)

        await connectAll(result)

        expect(kit.connect).not.toHaveBeenCalled()
        expect(result.current.allChainsConnected).toBe(false)
        expect(result.current.connectError).toContain('No wallet')
        expect(result.current.canExecute).toBe(false)
        expect(await transferAddressFor(result, 'fresh-1')).toBeUndefined()
    })

    describe('with an intermediate chain on the route', () => {
        beforeEach(() => {
            route.current = { required_chain_addresses: ['osmosis-1', 'noble-1', 'beezee-1'] }
            kit.chains.osmosis = connected('osmo1buyer')
        })

        it('finds an existing key through Keplr, for that chain only', async () => {
            const result = await renderWithSource(OSMOSIS)

            expect(keplr.getKey.mock.calls).toEqual([['noble-1']])
            expect(result.current.allChainsConnected).toBe(true)
        })

        it('enables it through Keplr on connect', async () => {
            keplr.getKey.mockResolvedValue(undefined)
            const result = await renderWithSource(OSMOSIS)
            expect(result.current.allChainsConnected).toBe(false)

            await connectAll(result)

            expect(keplr.enable.mock.calls).toEqual([['noble-1']])
            expect(result.current.allChainsConnected).toBe(true)
        })

        it('without Keplr marks nothing connected and explains why', async () => {
            delete (window as unknown as { keplr?: typeof keplr }).keplr
            const result = await renderWithSource(OSMOSIS)

            await connectAll(result)

            expect(result.current.allChainsConnected).toBe(false)
            expect(result.current.connectError).toContain('Keplr')
        })

        it('after a refusal shows the error and does not ask the wallet again by itself', async () => {
            keplr.getKey.mockRejectedValue(new Error('no key'))
            keplr.enable.mockRejectedValue(new Error('Request rejected'))
            const result = await renderWithSource(OSMOSIS)
            const lookups = keplr.getKey.mock.calls.length

            await connectAll(result)
            await settle()

            expect(result.current.allChainsConnected).toBe(false)
            expect(result.current.connectError).not.toBe('')
            expect(keplr.getKey).toHaveBeenCalledTimes(lookups)
        })
    })

    describe('EVM source', () => {
        beforeEach(() => {
            route.current = { required_chain_addresses: ['1', 'beezee-1'] }
        })

        it('counts as connected from the EVM wallet, with no Cosmos source address', async () => {
            evm.state = { isConnected: true, address: '0xbuyer' }
            const result = await renderWithSource(ETHEREUM)
            await fillForm(result)

            expect(result.current.allChainsConnected).toBe(true)
            expect(result.current.canExecute).toBe(true)
            expect(kit.connect).not.toHaveBeenCalled()
            expect(keplr.getKey).not.toHaveBeenCalled()
            expect(await transferAddressFor(result, '1')).toBe('0xbuyer')
        })

        it('connects the EVM wallet on connect, not the kit', async () => {
            const result = await renderWithSource(ETHEREUM)

            await connectAll(result)

            expect(evm.wallet.connectInjected).toHaveBeenCalled()
            expect(kit.connect).not.toHaveBeenCalled()
            expect(result.current.allChainsConnected).toBe(true)
        })
    })

    describe('with BeePocket', () => {
        beforeEach(() => {
            kit.walletName = 'beepocket-extension'
        })

        it('never asks the wallet or Keplr for another chain and never reports it connected', async () => {
            const result = await renderWithSource(OSMOSIS)
            await connectAll(result)

            expect(kit.connect).not.toHaveBeenCalled()
            expect(keplr.getKey).not.toHaveBeenCalled()
            expect(keplr.enable).not.toHaveBeenCalled()
            expect(result.current.allChainsConnected).toBe(false)
            expect(result.current.needsConnect).toBe(true)
            expect(result.current.connectError).toContain('BeePocket')
        })

        it('does not treat an account in the kit as a connected source', async () => {
            kit.chains.osmosis = connected('osmo1buyer')
            const result = await renderWithSource(OSMOSIS)

            expect(result.current.allChainsConnected).toBe(false)
        })

        it('still pays from an EVM source', async () => {
            route.current = { required_chain_addresses: ['1', 'beezee-1'] }
            evm.state = { isConnected: true, address: '0xbuyer' }
            const result = await renderWithSource(ETHEREUM)

            expect(result.current.allChainsConnected).toBe(true)
        })
    })
})
