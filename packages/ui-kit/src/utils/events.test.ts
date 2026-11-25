import {describe, expect, it} from 'vitest'
import {blockHasAddressTransfer, getEventMarketId, getNewBlockEvents, getTxResponseEvents, hasMaxFillsReachedRefund, isBurnEvent, isBurnerCoinsBurnedEvent, isOrderBookEvent, parseMaxFillsPerOrder} from './events'
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

describe('isBurnerCoinsBurnedEvent', () => {
    it("matches only the burner's periodic burn, not every burn-named event", () => {
        expect(isBurnerCoinsBurnedEvent(event('bze.burner.CoinsBurnedEvent'))).toBe(true)
        expect(isBurnerCoinsBurnedEvent(event('bze.burner.FundBurnerEvent'))).toBe(false)
        expect(isBurnerCoinsBurnedEvent(event('burn'))).toBe(false)
        // isBurnEvent is the broad one: a fund is "burn" to it too.
        expect(isBurnEvent(event('bze.burner.FundBurnerEvent'))).toBe(true)
    })
})

describe('order book events in tx results (chain v8.3.0)', () => {
    const quoted = (type: string, attrs: Record<string, string>): TendermintEvent => ({
        type,
        attributes: Object.entries(attrs).map(([key, value]) => ({key, value: JSON.stringify(value), index: true})),
    })
    const types = ['OrderAmendedEvent', 'OrderSavedEvent', 'OrderExecutedEvent', 'OrderMessageRefundedEvent']

    it('picks every order event up from tx_results with its quoted market_id', () => {
        const events = types.map(t => quoted(`bze.tradebin.${t}`, {market_id: 'ubze/uusdc'}))
        const result = {data: {value: {result_finalize_block: {events: [], tx_results: [{events}]}}}}

        const found = getNewBlockEvents(result).filter(isOrderBookEvent)

        expect(found.map(getEventMarketId)).toEqual(types.map(() => 'ubze/uusdc'))
    })

    it('still picks them up from block-level events (v8.2.0 queue)', () => {
        const result = {data: {value: {result_finalize_block: {events: [quoted('bze.tradebin.OrderExecutedEvent', {market_id: 'a/b'})], tx_results: []}}}}

        expect(getNewBlockEvents(result).filter(isOrderBookEvent).map(getEventMarketId)).toEqual(['a/b'])
    })
})

describe('hasMaxFillsReachedRefund', () => {
    const refund = (reason: string): TendermintEvent => ({
        type: 'bze.tradebin.OrderMessageRefundedEvent',
        attributes: [{key: 'reason', value: JSON.stringify(reason), index: true}],
    })

    it('detects the reason, quoted or plain', () => {
        expect(hasMaxFillsReachedRefund([refund('max_fills_reached')])).toBe(true)
        expect(hasMaxFillsReachedRefund([{type: 'bze.tradebin.OrderMessageRefundedEvent', attributes: [{key: 'reason', value: 'max_fills_reached', index: true}]}])).toBe(true)
    })

    it('ignores other reasons, other events and no events', () => {
        expect(hasMaxFillsReachedRefund([refund('something_else')])).toBe(false)
        expect(hasMaxFillsReachedRefund([{type: 'bze.tradebin.OrderSavedEvent', attributes: [{key: 'reason', value: '"max_fills_reached"', index: true}]}])).toBe(false)
        expect(hasMaxFillsReachedRefund(undefined)).toBe(false)
    })
})

describe('getTxResponseEvents / parseMaxFillsPerOrder', () => {
    it('returns the events of a tx response, empty when absent', () => {
        const e = {type: 'x', attributes: []}
        expect(getTxResponseEvents({events: [e, null, {foo: 1}]})).toEqual([e])
        expect(getTxResponseEvents({})).toEqual([])
    })

    it('reads the gateway key, falling back to 500', () => {
        expect(parseMaxFillsPerOrder({params: {maxFillsPerOrder: '250'}})).toBe(250)
        expect(parseMaxFillsPerOrder({params: {max_fills_per_order: '120'}})).toBe(120)
        expect(parseMaxFillsPerOrder({params: {}})).toBe(500)
        expect(parseMaxFillsPerOrder(undefined)).toBe(500)
    })
})
