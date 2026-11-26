// @vitest-environment jsdom
import BigNumber from 'bignumber.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { getDenomConfigInfoMock } = vi.hoisted(() => ({ getDenomConfigInfoMock: vi.fn() }))
vi.mock('../query/denom_config', () => ({ getDenomConfigInfo: getDenomConfigInfoMock }))

import { useDenomConfig } from './useDenomConfig'

describe('useDenomConfig', () => {
    beforeEach(() => getDenomConfigInfoMock.mockReset())

    it('is undefined while loading, then the v8.3.0 values', async () => {
        getDenomConfigInfoMock.mockResolvedValue({ status: 'ok', communityPool: 'bze1pool', gasSurcharge: new BigNumber('0.5'), transferFee: new BigNumber('0.01') })
        const { result } = renderHook(() => useDenomConfig('factory/a/x'))
        expect(result.current).toBeUndefined()
        await waitFor(() => expect(result.current?.status).toBe('ok'))
        expect(result.current?.communityPool).toBe('bze1pool')
        expect(result.current?.gasSurcharge.toString()).toBe('0.5')
    })

    it('reads zeros as unsupported on a v8.2.0 node (501)', async () => {
        getDenomConfigInfoMock.mockResolvedValue({ status: 'unsupported', communityPool: '', gasSurcharge: new BigNumber(0), transferFee: new BigNumber(0) })
        const { result } = renderHook(() => useDenomConfig('factory/a/x'))
        await waitFor(() => expect(result.current?.status).toBe('unsupported'))
        expect(result.current?.gasSurcharge.isZero()).toBe(true)
    })

    it('has no config for a non-factory denom, without asking the node', () => {
        const { result } = renderHook(() => useDenomConfig('ubze'))
        expect(result.current).toBeUndefined()
        expect(getDenomConfigInfoMock).not.toHaveBeenCalled()
    })
})
