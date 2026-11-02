import {describe, expect, it} from 'vitest'
import {blockHasAddressTransfer, getNewBlockEvents} from './events'
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

describe('blockHasAddressTransfer', () => {
    const transfer = (recipient: string, sender: string): TendermintEvent => ({
        type: 'transfer',
        attributes: [{key: 'recipient', value: recipient, index: true}, {key: 'sender', value: sender, index: true}],
    })
    const block = (blockEvents: TendermintEvent[], txEvents: TendermintEvent[]) => ({
        data: {value: {result_finalize_block: {events: blockEvents, tx_results: [{events: txEvents}]}}},
    })

    it('finds a transfer in the block\'s own events', () => {
        expect(blockHasAddressTransfer('bze1me', block([transfer('bze1me', 'bze1module')], []))).toBe(true)
    })

    it('finds a transfer in a tx\'s events', () => {
        expect(blockHasAddressTransfer('bze1me', block([], [transfer('bze1other', 'bze1me')]))).toBe(true)
    })

    it('ignores transfers between other addresses and non-transfer events', () => {
        expect(blockHasAddressTransfer('bze1me', block([transfer('bze1a', 'bze1b')], [event('message')]))).toBe(false)
    })

    it('is false for an empty address or an empty notification', () => {
        expect(blockHasAddressTransfer('', block([transfer('', 'bze1b')], []))).toBe(false)
        expect(blockHasAddressTransfer('bze1me', {})).toBe(false)
    })
})
