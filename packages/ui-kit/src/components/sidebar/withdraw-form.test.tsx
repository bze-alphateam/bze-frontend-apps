// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'

const { withdrawable, status } = vi.hoisted(() => ({
    withdrawable: { assets: [] as unknown[] },
    status: { channels: [] as string[], denoms: [] as string[] },
}))

vi.mock('../../hooks/useWithdrawableBalances', () => ({
    useWithdrawableBalances: () => ({ assets: withdrawable.assets, isLoading: false }),
}))
vi.mock('../../hooks/useIbcRouteStatus', () => ({
    useIbcRouteStatus: () => ({
        isChannelClosed: (c?: string) => !!c && status.channels.includes(c),
        isDenomBlocked: (d?: string) => !!d && status.denoms.includes(d),
        loading: false,
    }),
}))
vi.mock('../../hooks/useBridgeTransfer', () => ({
    useBridgeTransfer: () => ({ executeTransfer: vi.fn(), isExecuting: false, progressMessage: '' }),
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
    status.channels = []
    status.denoms = []
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
})
