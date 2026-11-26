import type {EncodeObject} from '@bze/bzejs/types';
import type {DaoCoin, DaoProposalMessage} from '@bze/bze-ui-kit';
import {msgValueToJson} from '@bze/bze-ui-kit';
import {describeMessage, type MsgAction} from '../proposal-describe';
import type {PinnedConfig} from '../proposal-model';
import type {ActionContext} from '../actions/types';

/**
 * A message the composer built, read the way the proposal page will read it once it is on chain: the
 * value is written back as the JSON the chain stores and handed to the proposal page's describers
 * (BFE-373), so what is reviewed before signing is what is shown afterwards. A message that cannot be
 * read back stays raw JSON of its own bytes, never silently dropped.
 */
export function describeBuilt(msg: EncodeObject, dao: ActionContext['dao'], formatCoin: (coin: DaoCoin) => string): MsgAction {
    const json: DaoProposalMessage = {'@type': msg.typeUrl, ...msgValueToJson(msg.typeUrl, msg.value)};
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
