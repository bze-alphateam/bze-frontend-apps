// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'

const { executeTransfer, bridgeable } = vi.hoisted(() => ({
    executeTransfer: vi.fn(),
    bridgeable: { assets: [] as unknown[] },
}))

vi.mock('../../hooks/useBridgeableAssets', () => ({
    useBridgeableAssets: () => ({ assets: bridgeable.assets, chains: [], blockedAssets: [], isLoading: false }),
}))
vi.mock('../../hooks/useBridgeTransfer', () => ({
    useBridgeTransfer: () => ({ executeTransfer, isExecuting: false, progressMessage: '' }),
}))
vi.mock('../../hooks/useCounterpartyBalance', () => ({
    useCounterpartyBalance: () => ({ amount: '5000000', status: 'ready', refetch: vi.fn() }),
}))
vi.mock('@interchain-kit/react', () => ({
    useChain: () => ({ status: 'Connected', connect: vi.fn(), wallet: undefined, address: 'osmo1sender' }),
}))
vi.mock('@interchain-kit/core', () => ({ WalletState: { Connected: 'Connected' } }))
vi.mock('../../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../constants/chain')>()),
    getChainName: () => 'beezee',
}))

import { createHiveGlowSystem } from '../../theme'
import { DepositForm } from './deposit-form'

const route = (denom: string, ticker: string, chainName: string) => ({
    bzeAsset: { denom, ticker, name: ticker, decimals: 6, logo: '', type: 'ibc', stable: false, verified: true, supply: BigInt(0) },
    kind: 'ibc',
    ibcData: { chain: { channelId: 'channel-0' }, counterparty: { chainName, chainPrettyName: chainName, channelId: 'channel-9', baseDenom: denom } },
    sourceDenom: denom,
    counterparty: { chainName, chainId: `${chainName}-1`, displayName: chainName, logo: '', addressPrefix: 'osmo' },
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
)

const SENT = 'If your balance does not change, check the source chain: refused deposits are refunded there.'

const pickAsset = (container: HTMLElement, denom: string) => {
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: denom } })
}

const typeAmount = (value: string) => fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } })

const send = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    await waitFor(() => expect(executeTransfer).toHaveBeenCalled())
}

beforeEach(() => {
    executeTransfer.mockReset()
    bridgeable.assets = [route('uosmo', 'OSMO', 'osmosis'), route('uatom', 'ATOM', 'cosmoshub')]
})

afterEach(cleanup)

describe('DepositForm daily limit note', () => {
    it('explains the daily limit once an asset is picked, without the sent line', async () => {
        const { container } = render(<DepositForm />, { wrapper })
        expect(screen.queryByTestId('deposit-limit-note')).toBeNull()

        pickAsset(container, 'uosmo')

        const note = await screen.findByTestId('deposit-limit-note')
        expect(note.textContent).toContain('daily limit per route')
        expect(note.textContent).not.toContain(SENT)
    })

    it('adds the check-the-source-chain line after a deposit was sent', async () => {
        executeTransfer.mockResolvedValue(true)
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        await screen.findByTestId('deposit-limit-note')
        typeAmount('1')

        await send()

        await waitFor(() => expect(screen.getByTestId('deposit-limit-note').textContent).toContain(SENT))
    })

    it('does not add it when the deposit failed', async () => {
        executeTransfer.mockResolvedValue(false)
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        await screen.findByTestId('deposit-limit-note')
        typeAmount('1')

        await send()

        expect(screen.getByTestId('deposit-limit-note').textContent).not.toContain(SENT)
    })

    it('hides the sent line again when another asset is picked', async () => {
        executeTransfer.mockResolvedValue(true)
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        await screen.findByTestId('deposit-limit-note')
        typeAmount('1')
        await send()
        await waitFor(() => expect(screen.getByTestId('deposit-limit-note').textContent).toContain(SENT))

        pickAsset(container, 'uatom')

        await waitFor(() => expect(screen.getByTestId('deposit-limit-note').textContent).not.toContain(SENT))
    })
})
