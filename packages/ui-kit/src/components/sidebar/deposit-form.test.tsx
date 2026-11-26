// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'

const { executeTransfer, bridgeable, status, limitState } = vi.hoisted(() => ({
    limitState: { value: { stopped: false } as Record<string, unknown> },
    executeTransfer: vi.fn(),
    bridgeable: { assets: [] as unknown[] },
    status: { channels: [] as string[], denoms: [] as string[], afterRefresh: undefined as undefined | { channels?: string[]; denoms?: string[] } },
}))

vi.mock('../../hooks/useIbcRouteStatus', () => ({
    useIbcRouteStatus: () => ({
        isChannelClosed: (c?: string) => !!c && status.channels.includes(c),
        isDenomBlocked: (d?: string) => !!d && status.denoms.includes(d),
        loading: false,
        // The last look before signing re-reads the lists: tests set `afterRefresh` to change them mid-flight.
        refresh: async () => {
            Object.assign(status, status.afterRefresh ?? {})
            return {
                isChannelClosed: (c?: string) => !!c && status.channels.includes(c),
                isDenomBlocked: (d?: string) => !!d && status.denoms.includes(d),
            }
        },
    }),
}))

vi.mock('../../hooks/useRouteLimit', () => ({
    useRouteLimit: () => ({ ...limitState.value, loading: false }),
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

const route = (denom: string, ticker: string, chainName: string, channelId = 'channel-0') => ({
    bzeAsset: { denom, ticker, name: ticker, decimals: 6, logo: '', type: 'ibc', stable: false, verified: true, supply: BigInt(0) },
    kind: 'ibc',
    ibcData: { chain: { channelId }, counterparty: { chainName, chainPrettyName: chainName, channelId: 'channel-9', baseDenom: denom } },
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
    status.channels = []
    status.denoms = []
    limitState.value = { stopped: false }
    status.afterRefresh = undefined
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

describe('DepositForm guardian stops', () => {
    const STOPPED = 'Transfers on this route are stopped for now.'
    const BLOCKED = 'Transfers of this token to and from other chains are stopped for now.'
    const submit = () => screen.getByRole('button', { name: 'Transfer' }) as HTMLButtonElement

    it('allows the transfer when nothing is stopped', async () => {
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        fireEvent.change(await screen.findByPlaceholderText('0.00'), { target: { value: '1' } })

        expect(screen.queryByTestId('notice')).toBeNull()
        expect(submit().disabled).toBe(false)
    })

    it('shows the notice, disables submit and tags the asset when its route channel is closed', async () => {
        status.channels = ['channel-0']
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        fireEvent.change(await screen.findByPlaceholderText('0.00'), { target: { value: '1' } })

        expect(screen.getByText(STOPPED)).toBeTruthy()
        expect(submit().disabled).toBe(true)
        expect(screen.getAllByText('stopped').length).toBeGreaterThan(0)
    })

    it('stops a blocked BZE denom, including native ubze coming back', async () => {
        bridgeable.assets = [route('ubze', 'BZE', 'osmosis')]
        status.denoms = ['ubze']
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'ubze')
        fireEvent.change(await screen.findByPlaceholderText('0.00'), { target: { value: '1' } })

        expect(screen.getByText(BLOCKED)).toBeTruthy()
        expect(submit().disabled).toBe(true)
    })

    it('matches the denom case-sensitively', async () => {
        status.denoms = ['UOSMO']
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        fireEvent.change(await screen.findByPlaceholderText('0.00'), { target: { value: '1' } })

        expect(screen.queryByTestId('notice')).toBeNull()
        expect(submit().disabled).toBe(false)
    })

    const item = (name: string) => screen.getAllByText(name).map(e => e.closest('[data-part="item"]')).find(Boolean)!

    it('tags only the route whose channel is closed when a denom has two routes', async () => {
        bridgeable.assets = [route('ubze', 'BZE', 'osmosis', 'channel-0'), route('ubze', 'BZE', 'cosmoshub', 'channel-1')]
        status.channels = ['channel-1']
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'ubze')
        await screen.findByPlaceholderText('0.00')

        expect(item('cosmoshub').textContent).toContain('stopped')
        expect(item('osmosis').textContent).not.toContain('stopped')
        // One route is still open, so the asset itself is not tagged.
        expect(item('BZE').textContent).not.toContain('stopped')
    })

    it('tags the asset when every one of its routes is closed', () => {
        bridgeable.assets = [route('ubze', 'BZE', 'osmosis', 'channel-0'), route('ubze', 'BZE', 'cosmoshub', 'channel-1'), route('uatom', 'ATOM', 'cosmoshub', 'channel-5')]
        status.channels = ['channel-0', 'channel-1']
        render(<DepositForm />, { wrapper })

        expect(item('BZE').textContent).toContain('stopped')
        expect(item('ATOM').textContent).not.toContain('stopped')
    })

    it('tags an asset whose denom is blocked even though its route is open', () => {
        status.denoms = ['uatom']
        render(<DepositForm />, { wrapper })

        expect(item('ATOM').textContent).toContain('stopped')
        expect(item('OSMO').textContent).not.toContain('stopped')
    })

    it('does not sign when the route was stopped while the form was open', async () => {
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        fireEvent.change(await screen.findByPlaceholderText('0.00'), { target: { value: '1' } })
        status.afterRefresh = { channels: ['channel-0'] }

        fireEvent.click(submit())
        await new Promise(r => setTimeout(r, 20))

        expect(executeTransfer).not.toHaveBeenCalled()
    })

    it('signs when the last look finds the route open', async () => {
        executeTransfer.mockResolvedValue(true)
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        fireEvent.change(await screen.findByPlaceholderText('0.00'), { target: { value: '1' } })

        fireEvent.click(submit())

        await waitFor(() => expect(executeTransfer).toHaveBeenCalledTimes(1))
    })
})

describe('DepositForm daily limit', () => {
    const submit = () => screen.getByRole('button', { name: 'Transfer' }) as HTMLButtonElement
    const nextReset = new Date(Date.UTC(2026, 10, 27, 0))

    it('keeps the generic note and allows any amount when the route has no limit', async () => {
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        await screen.findByPlaceholderText('0.00')
        typeAmount('1000000')

        expect(screen.getByTestId('deposit-limit-note')).toBeTruthy()
        expect(screen.queryByTestId('route-limit')).toBeNull()
        expect(submit().disabled).toBe(false)
    })

    it('replaces the generic note with the route line and passes an amount at the room', async () => {
        limitState.value = { room: BigInt(12345670000), stopped: false, nextReset, durationHours: 24 }
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        await screen.findByPlaceholderText('0.00')
        typeAmount('12345.67')

        expect(screen.getByTestId('route-limit').textContent).toBe('Daily limit for deposits on this route: up to 12,345.67 OSMO more until 00:00 UTC')
        expect(screen.queryByTestId('deposit-limit-note')).toBeNull()
        expect(submit().disabled).toBe(false)
    })

    it('refuses an amount over the room before signing', async () => {
        limitState.value = { room: BigInt(12345670000), stopped: false, nextReset, durationHours: 24 }
        const { container } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        await screen.findByPlaceholderText('0.00')
        typeAmount('12345.670001')

        expect(screen.getByText("Over today's limit for this route: at most 12,345.67 OSMO until 00:00 UTC.")).toBeTruthy()
        expect(submit().disabled).toBe(true)
    })

    it('says a used-up limit resets, and a 0% receive route is stopped', async () => {
        limitState.value = { room: BigInt(0), stopped: false, nextReset, durationHours: 24 }
        const { container, rerender } = render(<DepositForm />, { wrapper })
        pickAsset(container, 'uosmo')
        await screen.findByPlaceholderText('0.00')
        typeAmount('1')
        expect(screen.getAllByText("Today's limit for this route is used up. It resets at 00:00 UTC.").length).toBeGreaterThan(0)
        expect(submit().disabled).toBe(true)

        limitState.value = { room: BigInt(0), stopped: true, nextReset, durationHours: 24 }
        rerender(<DepositForm />)
        expect(screen.getAllByText('Deposits on this route are stopped for now.').length).toBeGreaterThan(0)
    })
})
