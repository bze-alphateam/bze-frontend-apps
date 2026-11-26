// @vitest-environment jsdom
import {describe, expect, it, vi} from 'vitest'
import {act, renderHook} from '@testing-library/react'
import {daoTxOptions} from '../utils/dao/msgs'
import {prettyError} from '../utils/user_errors'
import type {TxLanding} from '../query/dao_sources'
import {useCreateDao, type CreateDaoTx} from './useCreateDao'

const MSG = {typeUrl: '/bze.dao.MsgCreateDao', value: {}}
const EVENTS = [{type: 'bze.dao.EventDaoCreated', attributes: [{key: 'id', value: '"4"'}, {key: 'address', value: '"bze1dao4"'}]}]

const setup = (tx: CreateDaoTx, extra: {fetchTxEvents?: () => Promise<unknown>; getTxLanding?: (h: string) => Promise<TxLanding>; readTimeoutMs?: number} = {}) =>
    renderHook(() => useCreateDao({
        tx,
        fetchTxEvents: extra.fetchTxEvents ?? vi.fn().mockResolvedValue(undefined),
        getTxLanding: extra.getTxLanding ?? vi.fn().mockResolvedValue('notfound'),
        readTimeoutMs: extra.readTimeoutMs,
    }))

describe('useCreateDao', () => {
    it('signs in direct mode and aborts on a simulation error', async () => {
        const tx = vi.fn<CreateDaoTx>(async () => true)
        const {result} = setup(tx)
        await act(async () => { await result.current.submit(MSG) })
        expect(tx).toHaveBeenCalledWith([MSG], expect.objectContaining({...daoTxOptions, toasts: false}))
    })

    it('a simulation failure (no broadcast) reports the mapped reason and allows another try', async () => {
        const tx: CreateDaoTx = async (_msgs, options) => {
            options?.onFailure?.(prettyError('rpc error: the dao electorate cannot vote') ?? '', {stage: 'prepare'})
            return false
        }
        const {result} = setup(tx)
        let outcome: unknown
        await act(async () => { outcome = await result.current.submit(MSG) })
        expect(outcome).toEqual({status: 'failed'})
        expect(result.current.status).toBe('failed')
        expect(result.current.error).toContain('nobody who can vote yet')
    })

    it('maps error 1106 to a plain message with no retry offer', async () => {
        const tx: CreateDaoTx = async (_m, o) => { o?.onFailure?.(prettyError('failed: an account already exists at the dao address (1106)') ?? '', {stage: 'chain', txHash: 'H'}); return false }
        const {result} = setup(tx)
        await act(async () => { await result.current.submit(MSG) })
        expect(result.current.error).toContain('cannot be created right now')
        expect(result.current.error).toContain('report')
        expect(result.current.status).toBe('failed') // the chain answered no: nothing was created
    })

    it('reads the new DAO from the response events', async () => {
        const tx: CreateDaoTx = async (_m, o) => { o?.onSuccess?.({txhash: 'ABC', height: 5, code: 0, events: EVENTS}); return true }
        const {result} = setup(tx)
        let outcome: unknown
        await act(async () => { outcome = await result.current.submit(MSG) })
        expect(outcome).toEqual({status: 'created', created: {id: '4', address: 'bze1dao4', txHash: 'ABC'}})
        expect(result.current.status).toBe('created')
    })

    it('a created DAO whose id cannot be read is reported as unread, with the hash', async () => {
        const tx: CreateDaoTx = async (_m, o) => { o?.onSuccess?.({txhash: 'ABC', height: 5, code: 0}); return true }
        const {result} = setup(tx, {fetchTxEvents: vi.fn().mockRejectedValue(new Error('x'))})
        await act(async () => { await result.current.submit(MSG) })
        expect(result.current.status).toBe('unread')
        expect(result.current.txHash).toBe('ABC')
    })

    it('an events lookup that hangs falls back to unread instead of signing forever', async () => {
        const tx: CreateDaoTx = async (_m, o) => { o?.onSuccess?.({txhash: 'ABC', height: 5, code: 0}); return true }
        const {result} = setup(tx, {fetchTxEvents: () => new Promise(() => undefined), readTimeoutMs: 20})
        await act(async () => { await result.current.submit(MSG) })
        expect(result.current.status).toBe('unread')
    })

    it('tx resolving false with no callback is a failure with a generic reason, not a hang', async () => {
        const {result} = setup(async () => false)
        await act(async () => { await result.current.submit(MSG) })
        expect(result.current.status).toBe('failed')
        expect(result.current.error).toContain('was not sent')
    })
})

describe('useCreateDao after a broadcast', () => {
    const timedOut = (): CreateDaoTx => vi.fn<CreateDaoTx>(async (_m, o) => {
        o?.onBroadcast?.('HASH1')
        o?.onFailure?.('Transaction took too long', {stage: 'timeout'})
        return false
    })

    it('a timeout keeps the hash, stays pending and refuses a second creation', async () => {
        const tx = timedOut()
        const {result} = setup(tx)
        await act(async () => { await result.current.submit(MSG) })
        expect(result.current.status).toBe('pending')
        expect(result.current.txHash).toBe('HASH1')

        await act(async () => { await result.current.submit(MSG) })
        expect(tx).toHaveBeenCalledTimes(1)
        expect(result.current.status).toBe('pending')
    })

    it('any non-chain failure after the broadcast is pending, a chain refusal is not', async () => {
        const signFailure: CreateDaoTx = async (_m, o) => { o?.onBroadcast?.('H2'); o?.onFailure?.('lost', {stage: 'sign'}); return false }
        const a = setup(signFailure)
        await act(async () => { await a.result.current.submit(MSG) })
        expect(a.result.current.status).toBe('pending')

        const chainFailure: CreateDaoTx = async (_m, o) => { o?.onBroadcast?.('H3'); o?.onFailure?.('refused', {stage: 'chain', txHash: 'H3'}); return false }
        const b = setup(chainFailure)
        await act(async () => { await b.result.current.submit(MSG) })
        expect(b.result.current.status).toBe('failed')
    })

    it('check: landed reads the DAO; failed allows a retry; not found stays pending', async () => {
        const landing = vi.fn<(h: string) => Promise<TxLanding>>()
        const tx = timedOut()
        const {result} = setup(tx, {getTxLanding: landing, fetchTxEvents: vi.fn().mockResolvedValue(EVENTS)})
        await act(async () => { await result.current.submit(MSG) })

        landing.mockResolvedValueOnce('notfound')
        await act(async () => { await result.current.check() })
        expect(result.current.status).toBe('pending')
        expect(result.current.error).toContain('may still be included')

        landing.mockRejectedValueOnce(new Error('down'))
        await act(async () => { await result.current.check() })
        expect(result.current.status).toBe('pending')

        landing.mockResolvedValueOnce('failed')
        await act(async () => { await result.current.check() })
        expect(result.current.status).toBe('failed')
        await act(async () => { await result.current.submit(MSG) })
        expect(tx).toHaveBeenCalledTimes(2) // only now may it be sent again
    })

    it('check: a landed transaction gives the new DAO', async () => {
        const {result} = setup(timedOut(), {getTxLanding: vi.fn().mockResolvedValue('landed'), fetchTxEvents: vi.fn().mockResolvedValue(EVENTS)})
        await act(async () => { await result.current.submit(MSG) })
        let outcome: unknown
        await act(async () => { outcome = await result.current.check() })
        expect(outcome).toEqual({status: 'created', created: {id: '4', address: 'bze1dao4', txHash: 'HASH1'}})
    })
})
