// @vitest-environment jsdom
import {describe, expect, it, vi} from 'vitest'
import {act, renderHook} from '@testing-library/react'
import {daoTxOptions} from '../utils/dao/msgs'
import {prettyError} from '../utils/user_errors'
import {useCreateDao, type CreateDaoTx} from './useCreateDao'

const MSG = {typeUrl: '/bze.dao.MsgCreateDao', value: {}}
const EVENTS = [{type: 'bze.dao.EventDaoCreated', attributes: [{key: 'id', value: '"4"'}, {key: 'address', value: '"bze1dao4"'}]}]

describe('useCreateDao', () => {
    it('signs in direct mode and aborts on a simulation error', async () => {
        const tx = vi.fn<CreateDaoTx>(async () => true)
        const {result} = renderHook(() => useCreateDao({tx, fetchTxEvents: vi.fn()}))
        await act(async () => { await result.current.submit(MSG) })
        expect(tx).toHaveBeenCalledWith([MSG], expect.objectContaining({...daoTxOptions, toasts: false}))
    })

    it('a simulation failure (no onSuccess, no broadcast) reports the mapped reason', async () => {
        const tx: CreateDaoTx = async (_msgs, options) => {
            // useTx stops before the wallet opens: stage "prepare", no onSuccess
            options?.onFailure?.(prettyError('rpc error: the dao electorate cannot vote') ?? '', {stage: 'prepare'})
            return false
        }
        const {result} = renderHook(() => useCreateDao({tx, fetchTxEvents: vi.fn()}))
        let created: unknown
        await act(async () => { created = await result.current.submit(MSG) })
        expect(created).toBeUndefined()
        expect(result.current.status).toBe('failed')
        expect(result.current.error).toContain('nobody who can vote yet')
    })

    it('maps error 1106 to a plain message with no retry', async () => {
        const tx: CreateDaoTx = async (_m, o) => { o?.onFailure?.(prettyError('failed: an account already exists at the dao address (1106)') ?? '', {stage: 'chain'}); return false }
        const {result} = renderHook(() => useCreateDao({tx, fetchTxEvents: vi.fn()}))
        await act(async () => { await result.current.submit(MSG) })
        expect(result.current.error).toContain('cannot be created right now')
        expect(result.current.error).toContain('report')
    })

    it('reads the new DAO from the response events', async () => {
        const tx: CreateDaoTx = async (_m, o) => { o?.onSuccess?.({txhash: 'ABC', height: 5, code: 0, events: EVENTS}); return true }
        const {result} = renderHook(() => useCreateDao({tx, fetchTxEvents: vi.fn()}))
        let created: unknown
        await act(async () => { created = await result.current.submit(MSG) })
        expect(created).toEqual({id: '4', address: 'bze1dao4', txHash: 'ABC'})
        expect(result.current.status).toBe('created')
    })

    it('a created DAO whose id cannot be read is reported, not lost', async () => {
        const tx: CreateDaoTx = async (_m, o) => { o?.onSuccess?.({txhash: 'ABC', height: 5, code: 0}); return true }
        const {result} = renderHook(() => useCreateDao({tx, fetchTxEvents: vi.fn().mockRejectedValue(new Error('x'))}))
        await act(async () => { await result.current.submit(MSG) })
        expect(result.current.status).toBe('unread')
        expect(result.current.txHash).toBe('ABC')
    })
})
