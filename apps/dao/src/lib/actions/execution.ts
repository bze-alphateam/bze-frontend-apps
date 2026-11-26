import type {EncodeObject} from '@bze/bzejs/types';
import {msgValueToJson} from '@bze/bze-ui-kit';

/**
 * What the chain refuses when a DAO's admin makes it run messages (`MsgAdminExecute`, error 1133): grants
 * would outlive the admin, and an authz exec dispatches a message signed by its own grantee without any grant.
 */
export const ADMIN_REFUSED_TYPES: readonly string[] = [
    '/cosmos.authz.v1beta1.MsgGrant',
    '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
    '/cosmos.authz.v1beta1.MsgExec',
];

/** MsgSettleProposal never runs inside a DAO execution (the chain refuses it, also inside an authz exec). */
export const SETTLE_TYPE = '/bze.dao.MsgSettleProposal';

export const ADMIN_EXECUTE_TYPE = '/bze.dao.MsgAdminExecute';

/** The most DAO executions that can run inside each other (the chain's `MaxDaoExecutionDepth`, error 1134). */
export const MAX_EXECUTION_DEPTH = 5;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The messages packed in a decoded message (an admin execute or an authz exec), each with its `@type`. */
const packedOf = (json: Record<string, unknown>): Record<string, unknown>[] =>
    (Array.isArray(json.msgs) ? json.msgs.filter(isObject) : []);

export type ExecutionCheck = {ok: true; depth: number} | {ok: false; error: string; index: number};

/**
 * Reads the messages an admin makes the DAO run, down to the last nested one, the way the chain will read
 * them (encoded and decoded again): a settle message anywhere, an authz grant, a fee allowance or an authz
 * exec at any level an admin runs them are refused, and the number of nested executions is counted. `depth`
 * is how many executions deep the list runs: a list without a nested admin execute is 1, the chain's limit
 * is `MAX_EXECUTION_DEPTH`. A message that cannot be read back is an error, never skipped.
 */
export function inspectExecution(msgs: readonly EncodeObject[]): ExecutionCheck {
    const walk = (json: Record<string, unknown>, typeUrl: string, path: string): string | null => {
        if (typeUrl === SETTLE_TYPE) return `${path} is a settle message, which never runs inside a DAO execution.`;
        if (ADMIN_REFUSED_TYPES.includes(typeUrl)) {
            return `${path} is ${typeUrl}: the chain refuses authz grants, fee allowances and authz exec when an admin runs them for a DAO (error 1133).`;
        }
        if (typeUrl !== ADMIN_EXECUTE_TYPE) return null;
        for (const [i, inner] of packedOf(json).entries()) {
            const problem = walk(inner, String(inner['@type'] ?? ''), `${path}, message ${i + 1} inside it`);
            if (problem) return problem;
        }
        return null;
    };
    const levels = (list: Record<string, unknown>[]): number =>
        1 + Math.max(0, ...list.filter((m) => m['@type'] === ADMIN_EXECUTE_TYPE).map((m) => levels(packedOf(m))));

    const decoded: Record<string, unknown>[] = [];
    for (const [index, msg] of msgs.entries()) {
        let json: Record<string, unknown>;
        try {
            json = {'@type': msg.typeUrl, ...msgValueToJson(msg.typeUrl, msg.value)};
        } catch (e) {
            return {ok: false, index, error: `Action ${index + 1} could not be read back: ${(e as Error).message}`};
        }
        const problem = walk(json, msg.typeUrl, `Action ${index + 1}`);
        if (problem) return {ok: false, index, error: problem};
        decoded.push(json);
    }
    return {ok: true, depth: levels(decoded)};
}
