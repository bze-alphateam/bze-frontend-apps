// @vitest-environment jsdom
import BigNumber from 'bignumber.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'

const { estimateMock, configsMock } = vi.hoisted(() => ({ estimateMock: vi.fn(), configsMock: vi.fn() }))

vi.mock('@interchain-kit/react', () => ({ useChain: () => ({ address: undefined }) }))
vi.mock('../constants/chain', () => ({ getChainName: () => 'beezee' }))
vi.mock('../hooks/useFeeEstimate', () => ({ useFeeEstimate: () => estimateMock() }))
vi.mock('../hooks/useGasFeeEstimate', () => ({ useGasFeeEstimate: () => ({ estimate: undefined }) }))
vi.mock('../hooks/useDenomConfigs', () => ({ useDenomConfigs: (d: string[]) => configsMock(d) }))

import { FeeEstimateRow } from './fee-estimate'

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>

const estimated = {
    estimate: { reason: 'estimated' },
    isPreferredSelected: true,
    isLoading: false,
    nativeAsset: { denom: 'ubze', ticker: 'BZE', decimals: 6 },
    preferredAsset: { denom: 'factory/a/honey', ticker: 'HONEY', decimals: 6 },
    nativeDisplayAmount: new BigNumber(1),
    preferredDisplayAmount: new BigNumber(10),
}
const cfg = (gas: string, transfer = '0') => new Map([['factory/a/honey',
    { status: 'ok', communityPool: '', gasSurcharge: new BigNumber(gas), transferFee: new BigNumber(transfer) }]])

const renderRow = () => render(
    <FeeEstimateRow fee={{ denom: 'ubze', amount: '1000000' }} label="Fee" description="d" />, { wrapper })

afterEach(cleanup)

describe('FeeEstimateRow surcharge note', () => {
    it('says the estimate includes the fee token surcharge', () => {
        estimateMock.mockReturnValue(estimated)
        configsMock.mockReturnValue(cfg('0.5'))
        renderRow()
        expect(screen.getByText('includes +50% HONEY surcharge')).toBeTruthy()
    })

    it('adds no note without a gas surcharge (transfer fee only, or a v8.2.0 node)', () => {
        estimateMock.mockReturnValue(estimated)
        configsMock.mockReturnValue(cfg('0', '0.01'))
        renderRow()
        expect(screen.queryByText(/surcharge/)).toBeNull()
        cleanup()
        configsMock.mockReturnValue(new Map())
        renderRow()
        expect(screen.queryByText(/surcharge/)).toBeNull()
    })
})
