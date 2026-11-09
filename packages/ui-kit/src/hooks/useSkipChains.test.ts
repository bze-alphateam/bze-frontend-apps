// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { evm, skipGetChains } = vi.hoisted(() => ({
    evm: { isAvailable: true },
    skipGetChains: vi.fn(),
}))

vi.mock('../query/skip', () => ({ skipGetChains }))
vi.mock('../evm/context', () => ({ useEvmWalletState: () => evm }))
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getWalletChainsNames: () => [{ chainName: 'beezee' }, { chainName: 'osmosis' }],
    getChainByChainId: (chainId: string) => (
        { 'osmosis-1': { chainName: 'osmosis' }, 'stride-1': { chainName: 'stride' } } as Record<string, { chainName: string }>
    )[chainId],
}))

import { useSkipChains } from './useSkipChains'

const chain = (chain_id: string, chain_name: string, chain_type: string) =>
    ({ chain_id, chain_name, chain_type, is_testnet: false })

async function loadChains() {
    const { result } = renderHook(() => useSkipChains())
    await waitFor(() => expect(result.current.chains.length).toBeGreaterThan(0))
    return Object.fromEntries(result.current.chains.map(c => [c.chain_id, c.canSign]))
}

describe('useSkipChains', () => {
    beforeEach(() => {
        evm.isAvailable = true
        skipGetChains.mockReset().mockResolvedValue([
            chain('stride-1', 'stride', 'cosmos'),
            chain('osmosis-1', 'osmosis', 'cosmos'),
            chain('1', 'ethereum', 'evm'),
            chain('solana', 'solana', 'svm'),
        ])
    })

    it('offers only the Cosmos chains the wallet kit was built with', async () => {
        const canSign = await loadChains()

        expect(canSign['osmosis-1']).toBe(true)
        expect(canSign['stride-1']).toBe(false)
    })

    it('offers EVM chains when the EVM wallet is available', async () => {
        expect((await loadChains())['1']).toBe(true)
    })

    it('does not offer EVM chains without the EVM wallet', async () => {
        evm.isAvailable = false

        expect((await loadChains())['1']).toBe(false)
    })

    it('does not offer Solana', async () => {
        expect((await loadChains())['solana']).toBe(false)
    })
})
