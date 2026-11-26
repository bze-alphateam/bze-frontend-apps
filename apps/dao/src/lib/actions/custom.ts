import BigNumber from 'bignumber.js';
import {encodeMsgValue, hasMsgCodec, msgValueFromJson, msgValueToJson} from '@bze/bze-ui-kit';
import type {EncodeObject} from '@bze/bzejs/types';
import {signersOf} from './signers';
import type {ActionContext, ActionEntry} from './types';

export const CUSTOM_ID = 'custom';

/** Larger than any proposal can carry (the chain's default is 20,000 bytes of messages): refuse before parsing. */
export const MAX_CUSTOM_JSON_CHARS = 100_000;

const MSG_PLACEHOLDER = '/cosmos.bank.v1beta1.MsgSend';
const ADMIN_EXECUTE = '/bze.dao.MsgAdminExecute';
const SETTLE = '/bze.dao.MsgSettleProposal';
const AUTHZ_EXEC = '/cosmos.authz.v1beta1.MsgExec';

/** Whether a settle message type appears anywhere in the typed JSON (an authz exec nests its messages). */
const mentionsSettle = (value: unknown): boolean => {
    if (typeof value === 'string') return value === SETTLE || value === SETTLE.slice(1);
    if (Array.isArray(value)) return value.some(mentionsSettle);
    if (isObject(value)) return Object.values(value).some(mentionsSettle);
    return false;
};

/** The path of the first number JSON.parse could have rounded (or that is not a whole number), or null. */
const firstUnsafeNumber = (value: unknown, path = 'the message'): string | null => {
    if (typeof value === 'number') return Number.isSafeInteger(value) ? null : path;
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const found = firstUnsafeNumber(value[i], `${path}[${i}]`);
            if (found) return found;
        }
    } else if (isObject(value)) {
        for (const [key, item] of Object.entries(value)) {
            const found = firstUnsafeNumber(item, path === 'the message' ? key : `${path}.${key}`);
            if (found) return found;
        }
    }
    return null;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const isDefault = (v: unknown): boolean =>
    v === '' || v === 0 || v === '0' || v === false || v === null || (Array.isArray(v) && v.length === 0);

const PLAIN_DECIMAL = /^\d+(\.\d{1,18})?$/;

/** A ratio typed as a decimal ("0.4") that the codec writes back as the chain's 18-decimal integer ("400000000000000000"): the same number. */
const isDecimalOf = (typed: unknown, read: unknown): boolean =>
    typeof typed === 'string' && typeof read === 'string' && PLAIN_DECIMAL.test(typed) && /^\d+$/.test(read) && new BigNumber(typed).shiftedBy(18).isEqualTo(read);

const show = (v: unknown): string => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v));

/**
 * The first place where what was typed is not what the chain would read back from the encoded bytes
 * (a field the type does not have, a camelCase name, an enum written as a name instead of a number, a
 * number in a wrong place, a nested typo), or null when everything typed is there. A typed value that
 * is the type's default (empty, zero, false) may be absent from the read-back, as protobuf omits it.
 */
export function firstMismatch(typed: unknown, read: unknown, path = ''): string | null {
    const at = path || 'the message';
    if (Array.isArray(typed)) {
        if (!Array.isArray(read) || read.length !== typed.length) return `${at}: ${show(typed)} is not what the chain would read`;
        for (let i = 0; i < typed.length; i++) {
            const found = firstMismatch(typed[i], read[i], `${path}[${i}]`);
            if (found) return found;
        }
        return null;
    }
    if (typeof typed === 'object' && typed !== null) {
        const readObject = typeof read === 'object' && read !== null && !Array.isArray(read) ? (read as Record<string, unknown>) : {};
        for (const [key, value] of Object.entries(typed)) {
            const here = path ? `${path}.${key}` : key;
            if (!(key in readObject)) {
                if (isDefault(value) || (typeof value === 'object' && value !== null && Object.keys(value).length === 0)) continue;
                return `"${here}" is not a field of this type, or its value is not valid for it`;
            }
            const found = firstMismatch(value, readObject[key], here);
            if (found) return found;
        }
        return null;
    }
    if (String(typed) === String(read) || isDecimalOf(typed, read) || (isDefault(typed) && (read === undefined || isDefault(read)))) return null;
    return `"${at}" is ${show(typed)} but the chain would read ${show(read)}`;
}

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

    const unsafe = firstUnsafeNumber(parsed);
    if (unsafe) {
        return {ok: false, error: `"${unsafe}" is a number JSON cannot hold exactly (above 9007199254740991, or not a whole number): write it as a string, like "12345678901234567890".`};
    }

    if (typeUrl === SETTLE || (typeUrl === AUTHZ_EXEC && mentionsSettle(parsed))) {
        return {ok: false, error: 'A proposal cannot run a settle message (MsgSettleProposal), not even inside an authz exec: the chain refuses it when the proposal runs, and the proposal would end as failed.'};
    }

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
        return {ok: false, error: `The fields do not fit ${typeUrl}: ${(e as Error).message}. Write enums as numbers and durations as nanoseconds.`};
    }

    const mismatch = firstMismatch(body, read);
    if (mismatch) {
        return {ok: false, error: `${mismatch}. Use the protobuf field names in snake_case, enums as numbers and durations as nanoseconds.`};
    }

    return {ok: true, typeUrl, msg: {typeUrl, value}, json: {'@type': typeUrl, ...read}};
}

/** What the editor shows while it is empty: a bank send from the DAO, with a recipient to fill in. */
export const customPlaceholder = (daoAddress: string): string =>
    JSON.stringify({'@type': MSG_PLACEHOLDER, from_address: daoAddress, to_address: 'bze1…', amount: [{denom: 'ubze', amount: '1000000'}]}, null, 2);

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
