// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'

const { withdrawable, status, executeTransfer, paused } = vi.hoisted(() => ({
    paused: { urls: [] as string[] },
    executeTransfer: vi.fn(),
    withdrawable: { assets: [] as unknown[] },
    status: { channels: [] as string[], denoms: [] as string[], afterRefresh: undefined as undefined | {channels?: string[]; denoms?: string[]} },
}))

vi.mock('../../hooks/useWithdrawableBalances', () => ({
    useWithdrawableBalances: () => ({ assets: withdrawable.assets, isLoading: false }),
}))
vi.mock('../../hooks/useIbcRouteStatus', () => ({
    useIbcRouteStatus: () => ({
        isChannelClosed: (c?: string) => !!c && status.channels.includes(c),
        isDenomBlocked: (d?: string) => !!d && status.denoms.includes(d),
        loading: false,
        // The last look before signing re-reads the lists: tests change `status` (or `afterRefresh`) mid-flight.
        refresh: async () => {
            Object.assign(status, status.afterRefresh ?? {})
            return {
                isChannelClosed: (c?: string) => !!c && status.channels.includes(c),
                isDenomBlocked: (d?: string) => !!d && status.denoms.includes(d),
            }
        },
    }),
}))
vi.mock('../../hooks/usePausedMessages', () => ({
    usePausedMessages: (urls: string[]) => {
        const p = urls.filter(u => paused.urls.includes(u))
        return { paused: p, isPaused: p.length > 0 }
    },
}))
vi.mock('../../hooks/useBridgeTransfer', () => ({
    useBridgeTransfer: () => ({ executeTransfer, isExecuting: false, progressMessage: '' }),
}))
vi.mock('../../hooks/useMaxSpendable', () => ({
    useMaxSpendable: () => ({ inputValue: '1', isReserving: false, gasFee: { displayAmount: '0', ticker: '' } }),
}))
vi.mock('../../hooks/useCanAffordTx', () => ({ useCanAffordTx: () => ({ canAfford: true, message: '' }) }))
vi.mock('@interchain-kit/react', () => ({
    useChain: () => ({ status: 'Connected', connect: vi.fn(), wallet: undefined }),
}))
vi.mock('@interchain-kit/core', () => ({ WalletState: { Connected: 'Connected' } }))
vi.mock('../../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../constants/chain')>()),
    getChainName: () => 'beezee',
}))

import { createHiveGlowSystem } from '../../theme'
import { WithdrawForm } from './withdraw-form'

const BLOCKED = 'Transfers of this token to and from other chains are stopped for now.'
const ROUTE = 'Transfers on this route are stopped for now.'

const dest = (chainName: string, channel: string) => ({
    chainName, chainId: `${chainName}-1`, displayName: chainName, logo: '', addressPrefix: 'x', bzeSideChannelId: channel,
})
const asset = (denom: string, ticker: string, destinations: ReturnType<typeof dest>[], locked = false) => ({
    balance: { denom, ticker, name: ticker, logo: '', decimals: 6, amount: '5000000' },
    kind: locked ? 'ibc' : 'native',
    destinations,
    defaultDestination: destinations[0],
    isDestinationLocked: locked,
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
)

const selects = (c: HTMLElement) => Array.from(c.querySelectorAll('select')) as HTMLSelectElement[]
const pick = (c: HTMLElement, index: number, value: string) => fireEvent.change(selects(c)[index], { target: { value } })
const fill = async () => fireEvent.change(await screen.findByPlaceholderText('0.00'), { target: { value: '1' } })
const submit = () => screen.getByRole('button', { name: 'Transfer' }) as HTMLButtonElement

beforeEach(() => {
    paused.urls = []
    status.channels = []
    status.denoms = []
    status.afterRefresh = undefined
    executeTransfer.mockReset().mockResolvedValue(true)
    withdrawable.assets = [
        asset('ubze', 'BZE', [dest('osmosis', 'channel-0'), dest('cosmoshub', 'channel-3')]),
        asset('ibc/AAA', 'ATOM', [dest('cosmoshub', 'channel-3')], true),
    ]
})

afterEach(cleanup)

describe('WithdrawForm guardian stops', () => {
    it('shows no notice and allows the transfer when nothing is stopped', async () => {
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await fill()

        expect(screen.queryByTestId('notice')).toBeNull()
        expect(submit().disabled).toBe(false)
    })

    it('stops a blocked native denom (ubze) and keeps the balance listed', async () => {
        status.denoms = ['ubze']
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await fill()

        expect(screen.getByText(BLOCKED)).toBeTruthy()
        expect(submit().disabled).toBe(true)
        expect(screen.getAllByText('BZE').length).toBeGreaterThan(0)
    })

    it('stops only the destination whose BZE-side channel is closed', async () => {
        status.channels = ['channel-3']
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await fill()
        expect(screen.queryByText(ROUTE)).toBeNull()
        expect(submit().disabled).toBe(false)

        pick(container, 1, 'cosmoshub')

        expect(await screen.findByText(ROUTE)).toBeTruthy()
        expect(submit().disabled).toBe(true)

        pick(container, 1, 'osmosis')

        await waitFor(() => expect(screen.queryByText(ROUTE)).toBeNull())
        expect(submit().disabled).toBe(false)
    })

    it('does not mistake channel-3 for channel-30', async () => {
        status.channels = ['channel-30']
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ibc/AAA')
        await fill()

        expect(screen.queryByTestId('notice')).toBeNull()
        expect(submit().disabled).toBe(false)
    })

    it('tags a destination whose channel is closed in the destination picker', async () => {
        status.channels = ['channel-3']
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await screen.findByPlaceholderText('0.00')

        const item = (name: string) => screen.getAllByText(name).map(e => e.closest('[data-part="item"]')).find(Boolean)!
        expect(item('cosmoshub').textContent).toContain('stopped')
        expect(item('osmosis').textContent).not.toContain('stopped')
    })

    it('signs when the last look finds the route open', async () => {
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await fill()

        fireEvent.click(submit())

        await waitFor(() => expect(executeTransfer).toHaveBeenCalledTimes(1))
    })

    it('does not sign when the route was stopped while the form was open', async () => {
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await fill()
        expect(submit().disabled).toBe(false)
        status.afterRefresh = { channels: ['channel-0'] }

        fireEvent.click(submit())

        await waitFor(() => expect(executeTransfer).not.toHaveBeenCalled())
        await new Promise(r => setTimeout(r, 20))
        expect(executeTransfer).not.toHaveBeenCalled()
    })
})

describe('WithdrawForm paused MsgTransfer', () => {
    it('shows the paused notice and disables Transfer when MsgTransfer is on the disable list', async () => {
        paused.urls = ['/ibc.applications.transfer.v1.MsgTransfer']
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await fill()

        expect(screen.getByText('This action is paused on BeeZee for now.')).toBeTruthy()
        expect(submit().disabled).toBe(true)
    })

    it('ignores other paused message types', async () => {
        paused.urls = ['/bze.tradebin.MsgMultiSwap']
        const { container } = render(<WithdrawForm />, { wrapper })
        pick(container, 0, 'ubze')
        await fill()

        expect(screen.queryByText('This action is paused on BeeZee for now.')).toBeNull()
        expect(submit().disabled).toBe(false)
    })
})
