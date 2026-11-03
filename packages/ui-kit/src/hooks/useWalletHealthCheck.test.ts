// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { WalletState } from '@interchain-kit/core'

// The connected wallet is fed directly; the check only talks to it through refreshAccount/getAccount.
const { connected } = vi.hoisted(() => ({
    connected: {
        name: 'keplr-extension',
        refreshAccount: vi.fn(),
        getAccount: vi.fn(),
        disconnect: vi.fn(),
    },
}))

vi.mock('@interchain-kit/react', () => ({
    useChain: () => ({
        status: WalletState.Connected,
        address: 'bze1abc',
        disconnect: connected.disconnect,
        wallet: { info: { name: connected.name }, refreshAccount: connected.refreshAccount, getAccount: connected.getAccount },
    }),
}))
vi.mock('../components/toaster', () => ({ toaster: { create: vi.fn() } }))

import { useWalletHealthCheck } from './useWalletHealthCheck'

describe('useWalletHealthCheck', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        connected.name = 'keplr-extension'
        connected.refreshAccount.mockReset().mockResolvedValue(undefined)
        connected.getAccount.mockReset().mockResolvedValue({ address: 'bze1abc' })
        connected.disconnect.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('re-reads the account from Keplr after the start-up delay', async () => {
        renderHook(() => useWalletHealthCheck('beezee'))

        await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })

        expect(connected.refreshAccount).toHaveBeenCalled()
        expect(connected.disconnect).not.toHaveBeenCalled()
    })

    it('never runs for BeePocket', async () => {
        connected.name = 'beepocket-extension'
        renderHook(() => useWalletHealthCheck('beezee'))

        await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })

        expect(connected.refreshAccount).not.toHaveBeenCalled()
        expect(connected.getAccount).not.toHaveBeenCalled()
        expect(connected.disconnect).not.toHaveBeenCalled()
    })
})
