import { describe, expect, it } from 'vitest'
import '@bze/bzejs'
import { encodeMsgValue, hasMsgCodec, msgValueFromJson, msgValueToJson } from './signing_client_setup'

const SEND = '/cosmos.bank.v1beta1.MsgSend'

describe('message value from and to JSON', () => {
    it('knows the registered types only', () => {
        expect(hasMsgCodec(SEND)).toBe(true)
        expect(hasMsgCodec('/cosmos.bank.v1beta1.MsgUnknown')).toBe(false)
    })

    it('reads snake_case JSON through the codec and writes back what the bytes carry', () => {
        const value = msgValueFromJson(SEND, {from_address: 'bze1a', to_address: 'bze1b', amount: [{denom: 'ubze', amount: '5'}]})
        expect(msgValueToJson(SEND, value)).toEqual({from_address: 'bze1a', to_address: 'bze1b', amount: [{denom: 'ubze', amount: '5'}]})
        expect(encodeMsgValue(SEND, value).length).toBeGreaterThan(0)
    })

    it('leaves out fields the codec does not know', () => {
        const value = msgValueFromJson(SEND, {from_address: 'bze1a', to_address: 'bze1b', amount: [], bogus: 'x'})
        expect(msgValueToJson(SEND, value)).not.toHaveProperty('bogus')
    })

    it('throws for a type without a codec', () => {
        expect(() => msgValueFromJson('/nope.Msg', {})).toThrow(/no decoder/)
        expect(() => msgValueToJson('/nope.Msg', {})).toThrow(/no decoder/)
    })
})
