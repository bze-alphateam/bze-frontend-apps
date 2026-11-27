// @vitest-environment jsdom
import BigNumber from 'bignumber.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'

const { state, configsMock } = vi.hoisted(() => ({
    state: { preferredFeeDenom: 'ubze' as string | undefined },
    configsMock: vi.fn(),
}))

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark', setTheme: vi.fn() }) }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }))
vi.mock('../../hooks/useConnectionType', () => ({ useConnectionType: () => ({ connectionType: 'polling' }) }))
vi.mock('../../hooks/useDenomConfigs', () => ({ useDenomConfigs: (d: string[]) => configsMock(d) }))
vi.mock('../../hooks/useFeeTokens', () => {
    const tok = (denom: string, ticker: string) => ({ denom, ticker, name: ticker })
    const feeTokens = [tok('ubze', 'BZE'), tok('factory/a/surch', 'SURCH'), tok('factory/a/xfer', 'XFER'), tok('factory/a/both', 'BOTH'), tok('factory/a/none', 'NONE'), tok('factory/a/old', 'OLD'), tok('factory/a/tiny', 'TINY')]
    return { useFeeTokens: () => ({ feeTokens, isLoading: false }) }
})
vi.mock('../../hooks/useSettings', () => ({
    useSettings: () => {
        const settings = { endpoints: { restEndpoint: 'https://rest.example', rpcEndpoint: 'https://rpc.example' }, preferredFeeDenom: state.preferredFeeDenom }
        return { settings, isLoaded: true, updateEndpoints: vi.fn(), updatePreferredFeeDenom: vi.fn(), defaultSettings: settings }
    },
}))

import { createHiveGlowSystem } from '../../theme'
import { SettingsSidebarContent } from './settings-sidebar'

const cfg = (gas: string, transfer: string, communityPool = '') =>
    ({ status: 'ok', communityPool, gasSurcharge: new BigNumber(gas), transferFee: new BigNumber(transfer) })

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
)

const renderDrawer = async (preferred: string | undefined, configs: Record<string, ReturnType<typeof cfg>>) => {
    state.preferredFeeDenom = preferred
    configsMock.mockReturnValue(new Map(Object.entries(configs)))
    render(<SettingsSidebarContent />, { wrapper })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
}

const unsupported = { status: 'unsupported', communityPool: '', gasSurcharge: new BigNumber(0), transferFee: new BigNumber(0) }

const ALL = {
    'factory/a/surch': cfg('0.5', '0', 'bze1pool'),
    'factory/a/xfer': cfg('0', '0.01'),
    'factory/a/both': cfg('0.5', '0.01'),
    'factory/a/none': cfg('0', '0'),
    'factory/a/old': unsupported,
    'factory/a/tiny': cfg('0.00001', '0.00001'),
}

// jsdom has no ResizeObserver; the open select's popper needs one.
beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

describe('SettingsSidebarContent fee token notes', () => {
    it('notes each option with a setting, in the same order, and none for BZE or a zero config', async () => {
        await renderDrawer('ubze', ALL)
        fireEvent.click(screen.getByRole('combobox'))

        const notes = await screen.findAllByText(/network fee|app fees/)
        expect(notes.map(n => n.textContent)).toEqual(['network fee +50%', 'app fees +1%', 'network fee +50% · app fees +1%', 'network fee +<0.01% · app fees +<0.01%'])
        expect(screen.getAllByRole('option').map(o => o.textContent?.split('network')[0].split('app')[0])).toEqual(['BZE', 'SURCH', 'XFER', 'BOTH', 'NONE', 'OLD', 'TINY'])
    })

    it('explains a surcharge token whose fees go to the community', async () => {
        await renderDrawer('factory/a/surch', ALL)
        expect(screen.getByText('Paying fees in SURCH costs 50% more network fee, which goes to the SURCH community.')).toBeTruthy()
    })

    it('explains a burned surcharge together with the app fee', async () => {
        await renderDrawer('factory/a/both', ALL)
        expect(screen.getByText('Paying fees in BOTH costs 50% more network fee, which is burned. App fees paid in BOTH cost 1% more.')).toBeTruthy()
    })

    it('explains a transfer-fee-only token', async () => {
        await renderDrawer('factory/a/xfer', ALL)
        expect(screen.getByText('App fees paid in XFER cost 1% more.')).toBeTruthy()
    })

    it('shows no explanation for BZE, a token without settings or a v8.2.0 node', async () => {
        await renderDrawer('factory/a/none', ALL)
        expect(screen.queryByText(/Paying fees in|App fees paid in/)).toBeNull()
        cleanup()
        await renderDrawer('ubze', ALL)
        expect(screen.queryByText(/Paying fees in|App fees paid in/)).toBeNull()
    })

    it('shows no note or explanation for a v8.2.0 node (unsupported, zeroed config)', async () => {
        await renderDrawer('factory/a/old', ALL)
        expect(screen.queryByText(/Paying fees in|App fees paid in/)).toBeNull()
    })

    it('shows "<0.01%" for a ratio below 0.01%, never "0%"', async () => {
        await renderDrawer('factory/a/tiny', ALL)
        expect(screen.getByText('Paying fees in TINY costs <0.01% more network fee, which is burned. App fees paid in TINY cost <0.01% more.')).toBeTruthy()
        expect(screen.queryByText(/\+0%|[^.<]0% more/)).toBeNull()
    })
})
