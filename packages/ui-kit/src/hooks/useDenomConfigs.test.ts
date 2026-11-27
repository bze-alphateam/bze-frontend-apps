// @vitest-environment jsdom
import BigNumber from 'bignumber.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { getDenomConfigInfoMock } = vi.hoisted(() => ({ getDenomConfigInfoMock: vi.fn() }))
vi.mock('../query/denom_config', () => ({ getDenomConfigInfo: getDenomConfigInfoMock }))

import { useDenomConfigs } from './useDenomConfigs'

const okInfo = (gas: string) => ({ status: 'ok', communityPool: '', gasSurcharge: new BigNumber(gas), transferFee: new BigNumber(0) })

describe('useDenomConfigs', () => {
    beforeEach(() => {
        getDenomConfigInfoMock.mockReset()
    })

    it('loads the config of each factory denom once and skips other denoms', async () => {
        getDenomConfigInfoMock.mockImplementation(async (d: string) => okInfo(d === 'factory/a/x' ? '0.5' : '0'))
        const denoms = ['ubze', 'ibc/ABC', 'factory/a/x', 'factory/a/y', 'factory/a/x']
        const { result, rerender } = renderHook(({ d }) => useDenomConfigs(d), { initialProps: { d: denoms } })

        await waitFor(() => expect(result.current.size).toBe(2))
        expect(result.current.get('factory/a/x')?.gasSurcharge.toString()).toBe('0.5')
        expect(result.current.has('ubze')).toBe(false)
        expect(getDenomConfigInfoMock).toHaveBeenCalledTimes(2)

        rerender({ d: [...denoms] })
        expect(getDenomConfigInfoMock).toHaveBeenCalledTimes(2)
    })

    it('reads a v8.2.0 node (unsupported) as a config without surcharge or fee', async () => {
        getDenomConfigInfoMock.mockResolvedValue({ status: 'unsupported', communityPool: '', gasSurcharge: new BigNumber(0), transferFee: new BigNumber(0) })
        const { result } = renderHook(() => useDenomConfigs(['factory/a/x']))

        await waitFor(() => expect(result.current.get('factory/a/x')?.status).toBe('unsupported'))
        expect(result.current.get('factory/a/x')?.gasSurcharge.isZero()).toBe(true)
    })

    it('sets each denom as it resolves, without waiting for a slow one', async () => {
        getDenomConfigInfoMock.mockImplementation((d: string) =>
            d === 'factory/a/slow' ? new Promise(() => {}) : Promise.resolve(okInfo('0.5')))
        const { result } = renderHook(() => useDenomConfigs(['factory/a/fast', 'factory/a/slow']))

        await waitFor(() => expect(result.current.get('factory/a/fast')?.gasSurcharge.toString()).toBe('0.5'))
        expect(result.current.has('factory/a/slow')).toBe(false)
    })

    it('loads a denom added by a rerender and keeps the ones already loaded', async () => {
        getDenomConfigInfoMock.mockImplementation(async (d: string) => okInfo(d.endsWith('b') ? '0.25' : '0.5'))
        const { result, rerender } = renderHook(({ d }) => useDenomConfigs(d), { initialProps: { d: ['factory/a/a'] } })
        await waitFor(() => expect(result.current.has('factory/a/a')).toBe(true))

        rerender({ d: ['factory/a/a', 'factory/a/b'] })

        await waitFor(() => expect(result.current.get('factory/a/b')?.gasSurcharge.toString()).toBe('0.25'))
        expect(result.current.has('factory/a/a')).toBe(true)
        expect(getDenomConfigInfoMock).toHaveBeenCalledWith('factory/a/b')
    })
})
