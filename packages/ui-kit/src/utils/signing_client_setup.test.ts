import { describe, expect, it } from 'vitest'
import '@bze/bzejs'
import { encodeMsgValue, hasMsgCodec, msgValueFromJson, msgValueToJson } from './signing_client_setup'
import { packDaoMsgs } from './dao/msgs'

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

    it('leaves defaults out altogether, not as undefined properties', () => {
        const typeUrl = '/bze.dao.MsgUpdateMembers'
        const json = msgValueToJson(typeUrl, msgValueFromJson(typeUrl, {authority: 'bze1a', dao_id: '4', add: ['bze1b']}))
        expect(Object.values(json).every((v) => v !== undefined)).toBe(true)
        expect(json).toMatchObject({authority: 'bze1a', dao_id: '4', add: ['bze1b']})
    })

    it('reads the messages packed inside an admin execute through their own codecs, each with its @type', () => {
        const typeUrl = '/bze.dao.MsgAdminExecute'
        const send = {typeUrl: SEND, value: msgValueFromJson(SEND, {from_address: 'bze1a', to_address: 'bze1b', amount: [{denom: 'ubze', amount: '5'}]})}
        const members = {typeUrl: '/bze.dao.MsgUpdateMembers', value: msgValueFromJson('/bze.dao.MsgUpdateMembers', {authority: 'bze1a', dao_id: '4', add: ['bze1b']})}
        const value = msgValueFromJson(typeUrl, {admin: 'bze1c', dao_id: '7', msgs: []})
        const packed = {...(value as object), msgs: packDaoMsgs([send, members])}
        expect(msgValueToJson(typeUrl, packed)).toEqual({
            admin: 'bze1c',
            dao_id: '7',
            msgs: [
                {'@type': SEND, from_address: 'bze1a', to_address: 'bze1b', amount: [{denom: 'ubze', amount: '5'}]},
                {'@type': '/bze.dao.MsgUpdateMembers', authority: 'bze1a', dao_id: '4', add: ['bze1b'], remove: []},
            ],
        })
    })

    it('throws for a packed message of a type without a codec: what is signed must be readable', () => {
        const typeUrl = '/bze.dao.MsgAdminExecute'
        const value = msgValueFromJson(typeUrl, {admin: 'bze1c', dao_id: '7', msgs: []})
        const unknown = {typeUrl: '/nope.MsgUnknown', value: new Uint8Array([1, 2])}
        expect(() => msgValueToJson(typeUrl, {...(value as object), msgs: [unknown]})).toThrow(/no encoder|no decoder/)
    })

    it('throws for a type without a codec', () => {
        expect(() => msgValueFromJson('/nope.Msg', {})).toThrow(/no decoder/)
        expect(() => msgValueToJson('/nope.Msg', {})).toThrow(/no decoder/)
    })
})
