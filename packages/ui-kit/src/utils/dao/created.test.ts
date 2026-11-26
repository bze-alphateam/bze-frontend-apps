import {describe, expect, it, vi} from 'vitest'
import {daoCreatedFromEvents, readDaoCreated} from './created'

const EVENT = {type: 'bze.dao.EventDaoCreated', attributes: [{key: 'id', value: '"7"'}, {key: 'address', value: '"bze1dao"'}, {key: 'admin', value: '"bze1dao"'}]}

describe('daoCreatedFromEvents', () => {
    it('reads the JSON-quoted attributes of the typed event', () => {
        expect(daoCreatedFromEvents([{type: 'transfer', attributes: []}, EVENT], 'AB')).toEqual({id: '7', address: 'bze1dao', txHash: 'AB'})
    })

    it('reads unquoted values too and ignores a non-numeric id', () => {
        expect(daoCreatedFromEvents([{type: 'x.EventDaoCreated', attributes: [{key: 'id', value: '3'}, {key: 'address', value: 'bze1a'}]}], 'H')?.id).toBe('3')
        expect(daoCreatedFromEvents([{type: 'x.EventDaoCreated', attributes: [{key: 'id', value: '"abc"'}, {key: 'address', value: '"bze1a"'}]}], 'H')).toBeNull()
    })

    it('is null without events', () => {
        expect(daoCreatedFromEvents(undefined, 'H')).toBeNull()
        expect(daoCreatedFromEvents([], 'H')).toBeNull()
    })
})

describe('readDaoCreated', () => {
    it('prefers the response, then the stored transaction, then null', async () => {
        const fetch = vi.fn().mockResolvedValue([EVENT])
        expect(await readDaoCreated({txhash: 'T', events: [EVENT]}, fetch)).toMatchObject({id: '7'})
        expect(fetch).not.toHaveBeenCalled()
        expect(await readDaoCreated({txhash: 'T'}, fetch)).toMatchObject({id: '7'})
        expect(await readDaoCreated({txhash: 'T'}, vi.fn().mockRejectedValue(new Error('down')))).toBeNull()
    })
})
