import BigNumber from 'bignumber.js';
import type {EncodeObject} from '@bze/bzejs/types';
import type {DaoCoin, DaoProposalMessage} from '@bze/bze-ui-kit';
import {msgValueToJson} from '@bze/bze-ui-kit';
import {describeMessage, type MsgAction} from '../proposal-describe';
import type {PinnedConfig} from '../proposal-model';
import type {ActionContext} from '../actions/types';

const RATIOS = ['min_quorum', 'threshold', 'expedite_quorum', 'expedite_threshold'];
const DURATIONS = ['voting_period', 'expedited_period'];
const POLICIES = ['ALWAYS', 'ONLY_PASSED', 'NEVER'];
const DESTINATIONS = ['BURN', 'TREASURY'];

/**
 * The JSON of a codec (amino style: ratios as 18-decimal integers, durations in nanoseconds, enums as
 * numbers) in the shape the chain's REST gateway answers with, which is what the describers read:
 * `"400000000000000000"` becomes `"0.400000000000000000"`, `"86400000000000"` `"86400s"`, `2` `"NEVER"`.
 * Only a message's `config` is converted; everything else is left as it is.
 */
function asRest(json: Record<string, unknown>): Record<string, unknown> {
    const config = json.config;
    if (typeof config !== 'object' || config === null || Array.isArray(config)) return json;
    const c: Record<string, unknown> = {...config};
    for (const key of RATIOS) {
        if (typeof c[key] === 'string' && /^\d+$/.test(c[key] as string)) c[key] = new BigNumber(c[key] as string).shiftedBy(-18).toFixed(18);
    }
    for (const key of DURATIONS) {
        if (typeof c[key] === 'string' && /^\d+$/.test(c[key] as string)) c[key] = `${new BigNumber(c[key] as string).dividedToIntegerBy(1e9).toFixed(0)}s`;
    }
    if (typeof c.deposit_refund_policy === 'number') c.deposit_refund_policy = POLICIES[c.deposit_refund_policy] ?? c.deposit_refund_policy;
    for (const key of ['cost_destination', 'kept_deposit_destination']) {
        if (typeof c[key] === 'number') c[key] = DESTINATIONS[c[key] as number] ?? c[key];
    }
    return {...json, config: c};
}

/**
 * A message the composer built, read the way the proposal page will read it once it is on chain: the
 * value is written back as the JSON the chain stores and handed to the proposal page's describers
 * (BFE-373), so what is reviewed before signing is what is shown afterwards. A message that cannot be
 * read back stays raw JSON of its own bytes, never silently dropped.
 */
export function describeBuilt(msg: EncodeObject, dao: ActionContext['dao'], formatCoin: (coin: DaoCoin) => string): MsgAction {
    const json: DaoProposalMessage = {'@type': msg.typeUrl, ...asRest(msgValueToJson(msg.typeUrl, msg.value))};
    return describeMessage(json, {daoAddress: dao.address, before: dao.config as PinnedConfig, formatCoin});
}

export type Described = {ok: true; action: MsgAction} | {ok: false; error: string};

/** `describeBuilt` that reports a message it cannot read back instead of throwing. */
export function tryDescribe(msg: EncodeObject, dao: ActionContext['dao'], formatCoin: (coin: DaoCoin) => string): Described {
    try {
        return {ok: true, action: describeBuilt(msg, dao, formatCoin)};
    } catch (e) {
        return {ok: false, error: (e as Error).message};
    }
}

const replaceBigInt = (_key: string, v: unknown): unknown => (typeof v === 'bigint' ? v.toString() : v);

/** A message that could not be read back, as raw JSON of what would be signed (never dropped). */
function rawAction(msg: EncodeObject): MsgAction {
    let json: string;
    try {
        json = JSON.stringify({typeUrl: msg.typeUrl, value: msg.value}, replaceBigInt, 2);
    } catch {
        json = `${msg.typeUrl} (its fields could not be shown)`;
    }
    return {type: 'other', typeUrl: msg.typeUrl, title: 'Could not be read back', json};
}

export interface DescribedAll {
    /** One action per message, in order: a message that could not be read back is a raw JSON row. */
    actions: MsgAction[];
    /** How many could not be read back. The proposal is not sent while any is left: what is signed must be shown. */
    unreadable: number;
}

/** Describes every message that would be signed; none is left out. */
export function describeAll(msgs: EncodeObject[], dao: ActionContext['dao'], formatCoin: (coin: DaoCoin) => string): DescribedAll {
    let unreadable = 0;
    const actions = msgs.map((msg) => {
        const read = tryDescribe(msg, dao, formatCoin);
        if (read.ok) return read.action;
        unreadable += 1;
        return rawAction(msg);
    });
    return {actions, unreadable};
}
