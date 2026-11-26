import {encodeMsgValue, hasMsgCodec, msgValueFromJson, msgValueToJson} from '@bze/bze-ui-kit';
import type {EncodeObject} from '@bze/bzejs/types';
import {signersOf} from './signers';
import type {ActionContext, ActionEntry} from './types';

export const CUSTOM_ID = 'custom';

/** Larger than any proposal can carry (the chain's default is 20,000 bytes of messages): refuse before parsing. */
export const MAX_CUSTOM_JSON_CHARS = 100_000;

const MSG_PLACEHOLDER = '/cosmos.bank.v1beta1.MsgSend';
const ADMIN_EXECUTE = '/bze.dao.MsgAdminExecute';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A field of the JSON the codec does not read: a typo or a camelCase name would be dropped silently. */
const isDefault = (v: unknown): boolean =>
    v === '' || v === 0 || v === '0' || v === false || v === null || (Array.isArray(v) && v.length === 0);

export type CustomMessage =
    | {ok: true; typeUrl: string; msg: EncodeObject; /** The message as the chain will read it, with its `@type`. */ json: Record<string, unknown>}
    | {ok: false; error: string};

/**
 * One message typed as JSON, checked before it can be added. The text is untrusted: it is parsed with
 * `JSON.parse` only, must name a type the ui-kit can encode, is read through that type's codec (never
 * spread into a message), has to be signed by the DAO and by nobody else, and is encoded once to prove
 * it fits the wire format. The returned `json` is read back from the encoded bytes, i.e. what is signed.
 */
export function parseCustomMessage(text: string, ctx: Pick<ActionContext, 'dao'>): CustomMessage {
    const source = text.trim();
    if (source === '') return {ok: false, error: 'Paste the message as JSON.'};
    if (source.length > MAX_CUSTOM_JSON_CHARS) return {ok: false, error: 'This message is far larger than a proposal can carry.'};

    let parsed: unknown;
    try {
        parsed = JSON.parse(source);
    } catch (e) {
        return {ok: false, error: `This is not valid JSON: ${(e as Error).message}`};
    }
    if (!isObject(parsed)) return {ok: false, error: 'The message must be one JSON object, not a list or a value.'};

    const typeUrl = parsed['@type'];
    if (typeof typeUrl !== 'string' || !typeUrl.startsWith('/')) return {ok: false, error: 'Add the message type as "@type", like "/cosmos.bank.v1beta1.MsgSend".'};
    if (!hasMsgCodec(typeUrl)) return {ok: false, error: `This app cannot encode ${typeUrl}. Only the message types of the BZE apps are supported.`};

    const {'@type': _type, ...body} = parsed;
    void _type;

    const signers = signersOf(typeUrl, body);
    if (!signers) return {ok: false, error: `The app cannot tell who signs ${typeUrl}.`};
    if (signers.addresses.length === 0) return {ok: false, error: `Set "${signers.field}" to the DAO's address, ${ctx.dao.address}: the DAO has to be the one who signs.`};
    const wrong = signers.addresses.find((a) => a.toLowerCase() !== ctx.dao.address.toLowerCase());
    if (wrong !== undefined) {
        return {ok: false, error: `"${signers.field}" is ${wrong}, but a proposal's messages run as the DAO and must be signed by the DAO only (${ctx.dao.address}). The chain refuses any other signer.`};
    }

    if (typeUrl === ADMIN_EXECUTE && String(body.dao_id ?? '') === ctx.dao.id) {
        return {ok: false, error: 'A DAO cannot run messages as itself through admin execute: put the message in the proposal directly.'};
    }

    let value: unknown;
    let read: Record<string, unknown>;
    try {
        value = msgValueFromJson(typeUrl, body);
        encodeMsgValue(typeUrl, value);
        read = msgValueToJson(typeUrl, value);
    } catch (e) {
        return {ok: false, error: `The fields do not fit ${typeUrl}: ${(e as Error).message}`};
    }

    const ignored = Object.keys(body).filter((key) => !(key in read) && !isDefault(body[key]));
    if (ignored.length > 0) {
        return {ok: false, error: `${typeUrl} has no field ${ignored.map((k) => `"${k}"`).join(', ')} (or its value is not valid for it). Use the protobuf field names in snake_case, enums as numbers.`};
    }

    return {ok: true, typeUrl, msg: {typeUrl, value}, json: {'@type': typeUrl, ...read}};
}

/** The example the form offers: a bank send from the DAO, with a recipient the user has to fill in. */
export const customExample = (daoAddress: string): string =>
    JSON.stringify({'@type': MSG_PLACEHOLDER, from_address: daoAddress, to_address: 'REPLACE_WITH_AN_ADDRESS', amount: [{denom: 'ubze', amount: '1000000'}]}, null, 2);

/** Advanced: one message of any type the ui-kit can encode, typed as JSON. */
export const customEntry: ActionEntry = {
    id: CUSTOM_ID,
    label: 'Custom message (advanced)',
    description: 'Run any other message as the DAO, written as JSON.',
    available: () => true,
    initialFields: () => ({json: ''}),
    validate(fields, ctx) {
        const result = parseCustomMessage(fields.json ?? '', ctx);
        return result.ok ? undefined : result.error;
    },
    build(fields, ctx) {
        const result = parseCustomMessage(fields.json ?? '', ctx);
        if (!result.ok) throw new Error(result.error);
        return result.msg;
    },
};
