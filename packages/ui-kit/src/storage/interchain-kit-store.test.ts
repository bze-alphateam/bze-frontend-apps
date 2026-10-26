import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletState } from '@interchain-kit/core'
import { WalletManagerStore } from '@interchain-kit/store'

// Regression tests for BFE-284, fixed upstream in @interchain-kit/store 0.10.1
// (hyperweb-io/interchain-kit#51). Before that, one page load where the Keplr extension was injected late saved "NotExist"
// to localStorage; every later load restored it, so the wallet showed "not installed"
// forever and connect() silently did nothing.

const STORAGE_KEY = 'interchain-kit-store'
const CHAIN = { chainName: 'beezee', chainId: 'beezee-1', chainType: 'cosmos' }
const ADDRESS = 'bze1prm55vzlp5u6excqdunwlm4tw254cq94fl9jwy'

const memoryStorage = () => {
    const data = new Map<string, string>()
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value) },
        removeItem: (key: string) => { data.delete(key) },
        clear: () => data.clear(),
    }
}

// Stands in for the Keplr extension wallet: init() fails while window.keplr is missing.
const fakeKeplr = (injected: boolean) => ({
    info: { name: 'keplr-extension', prettyName: 'Keplr' },
    events: { on: () => {} },
    setChainMap: () => {},
    setAssetLists: () => {},
    init: vi.fn(async () => {
        if (!injected) throw new Error('Client not exist')
    }),
    connect: vi.fn(async () => {}),
    getAccount: vi.fn(async () => ({ address: ADDRESS, algo: 'secp256k1', pubkey: new Uint8Array() })),
})

// One page load: a fresh manager restoring from the shared localStorage.
const pageLoad = async (injected: boolean) => {
    const keplr = fakeKeplr(injected)
    const manager = new WalletManagerStore([CHAIN] as any, [], [keplr] as any, undefined, undefined)
    await manager.init()
    return { manager, keplr }
}

const savedStates = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').chainWalletStates

describe('interchain-kit store NotExist restore (BFE-284)', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', memoryStorage())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('saves NotExist when the extension is missing on load', async () => {
        const { manager } = await pageLoad(false)

        expect(manager.getWalletByName('keplr-extension')?.walletState).toBe(WalletState.NotExist)
        expect(savedStates()[0].walletState).toBe(WalletState.NotExist)
    })

    it('does not restore a saved NotExist once the extension is there', async () => {
        await pageLoad(false)

        const { manager } = await pageLoad(true)

        expect(manager.getWalletByName('keplr-extension')?.walletState).toBe(WalletState.Disconnected)
        expect(manager.getChainWalletState('keplr-extension', 'beezee')?.errorMessage).toBe('')
    })

    it('connects after a load that saved NotExist', async () => {
        await pageLoad(false)
        const { manager, keplr } = await pageLoad(true)

        await manager.connect('keplr-extension', 'beezee')

        expect(keplr.connect).toHaveBeenCalledWith('beezee-1')
        expect(manager.getChainWalletState('keplr-extension', 'beezee')?.walletState).toBe(WalletState.Connected)
        expect(manager.getChainWalletState('keplr-extension', 'beezee')?.account?.address).toBe(ADDRESS)
    })

    it('reports the chain wallet state from its own entry', async () => {
        await pageLoad(false)
        const { manager } = await pageLoad(true)

        const chainWallet = manager.getChainWalletByName('keplr-extension', 'beezee')

        expect(chainWallet?.walletState).toBe(WalletState.Disconnected)
    })

    it('keeps a saved Connected state', async () => {
        const first = await pageLoad(true)
        await first.manager.connect('keplr-extension', 'beezee')

        const { manager } = await pageLoad(true)

        expect(manager.getChainWalletState('keplr-extension', 'beezee')?.walletState).toBe(WalletState.Connected)
    })
})
