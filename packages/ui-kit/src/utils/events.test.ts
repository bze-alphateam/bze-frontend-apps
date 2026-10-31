import {describe, expect, it} from 'vitest'
import {getNewBlockEvents} from './events'
import type {TendermintEvent} from '../types/events'

const event = (type: string): TendermintEvent => ({type, attributes: [{key: 'amount', value: '1ubze', index: true}]})

describe('getNewBlockEvents', () => {
    it('reads the tx events CometBFT 0.38 nests in result_finalize_block.tx_results', () => {
        const mint = event('coinbase')
        const result = {
            data: {
                value: {
                    block: {},
                    result_finalize_block: {
                        events: [event('bze.epochs.EpochStartEvent')],
                        tx_results: [{events: [event('message'), mint]}],
                    },
                },
            },
        }

        const events = getNewBlockEvents(result)

        expect(events).toContain(mint)
    })

    it('returns block events first, then each tx in block order', () => {
        const result = {
            data: {
                value: {
                    result_finalize_block: {
                        events: [event('block')],
                        tx_results: [{events: [event('tx1-a'), event('tx1-b')]}, {events: [event('tx2')]}],
                    },
                },
            },
        }

        expect(getNewBlockEvents(result).map(e => e.type)).toEqual(['block', 'tx1-a', 'tx1-b', 'tx2'])
    })

    it('falls back to the pre-0.38 txs_results field', () => {
        const result = {
            data: {
                value: {
                    result_finalize_block: {events: [event('block')]},
                    txs_results: [{events: [event('burn')]}],
                },
            },
        }

        expect(getNewBlockEvents(result).map(e => e.type)).toEqual(['block', 'burn'])
    })

    it('skips tx results without events', () => {
        const result = {
            data: {value: {result_finalize_block: {tx_results: [null, {}, {events: [event('transfer')]}]}}},
        }

        expect(getNewBlockEvents(result).map(e => e.type)).toEqual(['transfer'])
    })

    it.each([undefined, null, {}, {data: {}}, {data: {value: {}}}])('returns nothing for %j', (result) => {
        expect(getNewBlockEvents(result)).toEqual([])
    })
})
