import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('../storage/settings', () => ({
    getSettings: () => ({endpoints: {restEndpoint: 'https://rest.test'}}),
}))

import {getMaxFillsPerOrder, getTxEventsByHash} from './tradebin_order_params'

const answer = (body: unknown, ok = true) => vi.fn(async () => ({ok, json: async () => body}))

afterEach(() => vi.unstubAllGlobals())

describe('getMaxFillsPerOrder', () => {
    it('reads the param from the tradebin params endpoint', async () => {
        const fetchMock = answer({params: {maxFillsPerOrder: '250'}})
        vi.stubGlobal('fetch', fetchMock)

        expect(await getMaxFillsPerOrder()).toBe(250)
        expect(fetchMock).toHaveBeenCalledWith('https://rest.test/bze/tradebin/params')
    })

    it('reads the default value', async () => {
        vi.stubGlobal('fetch', answer({params: {maxFillsPerOrder: '500'}}))

        expect(await getMaxFillsPerOrder()).toBe(500)
    })

    it('falls back to 500 on a non-OK answer, an absent key or a network error', async () => {
        vi.stubGlobal('fetch', answer({params: {maxFillsPerOrder: '250'}}, false))
        expect(await getMaxFillsPerOrder()).toBe(500)

        vi.stubGlobal('fetch', answer({params: {}}))
        expect(await getMaxFillsPerOrder()).toBe(500)

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
        expect(await getMaxFillsPerOrder()).toBe(500)
    })
})

describe('getTxEventsByHash', () => {
    const event = {type: 'bze.tradebin.OrderSavedEvent', attributes: []}

    it('returns the events of the tx_response', async () => {
        const fetchMock = answer({tx_response: {events: [event]}})
        vi.stubGlobal('fetch', fetchMock)

        expect(await getTxEventsByHash('AB12')).toEqual([event])
        expect(fetchMock).toHaveBeenCalledWith('https://rest.test/cosmos/tx/v1beta1/txs/AB12')
    })

    it('returns no events on a non-OK answer, a missing tx_response or a network error', async () => {
        vi.stubGlobal('fetch', answer({tx_response: {events: [event]}}, false))
        expect(await getTxEventsByHash('AB12')).toEqual([])

        vi.stubGlobal('fetch', answer({}))
        expect(await getTxEventsByHash('AB12')).toEqual([])

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
        expect(await getTxEventsByHash('AB12')).toEqual([])
    })
})
