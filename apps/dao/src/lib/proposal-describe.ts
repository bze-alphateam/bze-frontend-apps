import {ratioAtomics, type DaoCoin, type DaoProposalMessage} from '@bze/bze-ui-kit';
import {formatDuration, formatRatio} from './format';
import {fieldName} from './dao-history';
import {secondsOf} from './dao-rules';
import {snakeKeys, type PinnedConfig} from './proposal-model';

// What a proposal does if it passes: each message read into an action the page draws in plain words.
// The messages run as the DAO. The readers know the bank send and the x/dao self-management messages; a
// message none of them knows stays a raw JSON block. Everything read here is untrusted chain text: it is
// only ever turned into strings, never into markup.

export interface ConfigChange {
    field: string;
    label: string;
    /** The value before, in words; null when the DAO's rules at submission are not known. */
    before: string | null;
    after: string;
}

export type MsgAction =
    /** `subDao` is the id of the sub-DAO an admin execute runs the send as; null for a send of this DAO's own proposal. */
    | {type: 'send'; from: string; to: string; amount: DaoCoin[]; fromDao: boolean; subDao: string | null}
    | {type: 'update_config'; changes: ConfigChange[]; unchanged: boolean}
    | {type: 'update_metadata'; name: string; description: string}
    | {type: 'update_members'; add: string[]; remove: string[]}
    | {type: 'update_electorate'; srIds: string[]; drDenom: string}
    /** `daoId` is the DAO whose admin changes: the DAO itself for its own proposal, else the sub-DAO or the nominating DAO. */
    | {type: 'nominate_admin'; daoId: string; nominee: string; toVoters: boolean}
    | {type: 'withdraw_nomination'; daoId: string}
    | {type: 'accept_admin'; daoId: string; nominee: string}
    | {type: 'admin_execute'; daoId: string; actions: MsgAction[]}
    | {type: 'other'; typeUrl: string; title: string; json: string};

export interface DescribeContext {
    /** The DAO's own account, to tell "from the DAO" from a send of someone else's funds. */
    daoAddress: string | null;
    /** The rules pinned at submission: what a config update changes. Null when unknown. */
    before: PinnedConfig | null;
    formatCoin: (coin: DaoCoin) => string;
    /** The rules a DAO has now, by id, for a rules change a sub-DAO runs inside an admin execute; null for one that is not known. */
    beforeOf?: (daoId: string) => PinnedConfig | null;
}

/** Nested `MsgAdminExecute` stop being read here (the chain caps the depth too); deeper ones are raw JSON. */
export const MAX_NESTING = 3;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

const field = (body: Record<string, unknown>, name: string): unknown => snakeKeys(body)[name];

const coinsOf = (v: unknown): DaoCoin[] =>
    Array.isArray(v)
        ? v.flatMap((c) => (isObject(c) && typeof c.denom === 'string' && (typeof c.amount === 'string' || typeof c.amount === 'number')
            ? [{denom: c.denom, amount: String(c.amount)}]
            : []))
        : [];

/** "Msg" type URL to words: `/cosmos.bank.v1beta1.MsgMultiSend` → "Multi send". */
export function titleOfType(typeUrl: string): string {
    const name = (typeUrl.split(/[./]/).pop() ?? typeUrl).replace(/^Msg/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim();
    return name ? name[0].toUpperCase() + name.slice(1) : typeUrl || 'Unknown action';
}

const DESTINATION_TEXT: Record<string, string> = {BURN: 'burned', TREASURY: "sent to the DAO's treasury"};
const POLICY_TEXT: Record<string, string> = {
    ALWAYS: 'refunded whatever the result',
    ONLY_PASSED: 'refunded only when the proposal passes',
    NEVER: 'never refunded',
};

const durationSecondsOf = (v: unknown): number | null => {
    if (typeof v === 'string') return secondsOf(v);
    if (isObject(v)) {
        const s = Number(v.seconds ?? 0);
        return Number.isFinite(s) ? s : null;
    }
    return null;
};

/** One config value in words, the way the rules panel says it. */
export function configValueText(fieldKey: string, value: unknown, formatCoin: (c: DaoCoin) => string): string {
    switch (fieldKey) {
        case 'min_quorum': case 'threshold': case 'expedite_quorum': case 'expedite_threshold':
            return typeof value === 'string' && /^\d+(\.\d{1,18})?$/.test(value) ? formatRatio(value) : str(value);
        case 'voting_period': case 'expedited_period': {
            const s = durationSecondsOf(value);
            return s === null ? str(value) : formatDuration(s);
        }
        case 'allow_expedite':
            return value === true ? 'On' : 'Off';
        case 'open_submission':
            return value === true ? 'Anyone' : 'Members or voters only';
        case 'proposal_cost': case 'proposal_deposit': {
            const [coin] = coinsOf([value]);
            return coin && /[1-9]/.test(coin.amount) ? formatCoin(coin) : 'None';
        }
        case 'deposit_refund_policy':
            return POLICY_TEXT[str(value)] ?? str(value);
        case 'cost_destination': case 'kept_deposit_destination':
            return DESTINATION_TEXT[str(value)] ?? str(value);
        default:
            return str(value) || JSON.stringify(value);
    }
}

/** What the chain reads for a field the JSON leaves out (proto3 defaults). */
const DEFAULTS: Record<string, unknown> = {
    min_quorum: '0', threshold: '0', voting_period: '0s', allow_expedite: false, expedited_period: '0s',
    expedite_quorum: '0', expedite_threshold: '0', open_submission: false, proposal_cost: null, proposal_deposit: null,
    deposit_refund_policy: 'ALWAYS', cost_destination: 'BURN', kept_deposit_destination: 'BURN',
};

const UNKNOWN_WHEN_NULL = ['deposit_refund_policy', 'cost_destination', 'kept_deposit_destination'];

const CONFIG_KEYS: string[] = [
    'min_quorum', 'threshold', 'voting_period', 'allow_expedite', 'expedited_period', 'expedite_quorum', 'expedite_threshold',
    'open_submission', 'proposal_cost', 'proposal_deposit', 'deposit_refund_policy', 'cost_destination', 'kept_deposit_destination',
];

/** A config value reduced to one comparable string, so "0.5" and "0.500000000000000000" are the same. */
const canonical = (key: string, value: unknown): string => {
    switch (key) {
        case 'min_quorum': case 'threshold': case 'expedite_quorum': case 'expedite_threshold':
            try {
                return ratioAtomics(str(value)).toString();
            } catch {
                return str(value);
            }
        case 'voting_period': case 'expedited_period':
            return String(durationSecondsOf(value) ?? str(value));
        case 'proposal_cost': case 'proposal_deposit': {
            const [coin] = coinsOf([value]);
            return coin && /[1-9]/.test(coin.amount) ? `${coin.denom}:${BigInt(coin.amount)}` : 'none';
        }
        default:
            return String(value);
    }
};

function describeConfig(body: Record<string, unknown>, ctx: DescribeContext): MsgAction {
    const rawAfter = field(body, 'config');
    const after = isObject(rawAfter) ? snakeKeys(rawAfter) : {};
    const before = ctx.before ? (ctx.before as unknown as Record<string, unknown>) : null;
    const changes: ConfigChange[] = [];

    for (const key of CONFIG_KEYS) {
        if (!(key in after) && !before) continue;
        // an omitted field is its default, as on the chain
        const next = key in after ? after[key] : DEFAULTS[key];
        // without the rules at submission every given field is listed; with them only the ones that differ
        // a money rule the pinned copy does not know is unknown, never its default
        const unknownBefore = !!before && UNKNOWN_WHEN_NULL.includes(key) && before[key] === null;
        if (before && !unknownBefore && canonical(key, before[key] ?? DEFAULTS[key]) === canonical(key, next)) continue;
        changes.push({
            field: key,
            label: fieldName(key),
            before: before ? (unknownBefore ? 'unknown' : configValueText(key, before[key] ?? DEFAULTS[key], ctx.formatCoin)) : null,
            after: configValueText(key, next, ctx.formatCoin),
        });
    }
    return {type: 'update_config', changes, unchanged: !!before && changes.length === 0};
}

/** One message as an action. `depth` counts the `MsgAdminExecute` levels already entered. */
export function describeMessage(msg: DaoProposalMessage, ctx: DescribeContext, depth = 0, subDao: string | null = null): MsgAction {
    const typeUrl = str(msg['@type']);
    const body = msg as Record<string, unknown>;
    const raw = (): MsgAction => ({type: 'other', typeUrl, title: titleOfType(typeUrl), json: JSON.stringify(msg, null, 2)});

    switch (typeUrl) {
        case '/cosmos.bank.v1beta1.MsgSend': {
            const from = str(field(body, 'from_address'));
            return {type: 'send', from, to: str(field(body, 'to_address')), amount: coinsOf(field(body, 'amount')), fromDao: !!ctx.daoAddress && from === ctx.daoAddress, subDao};
        }
        case '/bze.dao.MsgUpdateDaoConfig':
            return describeConfig(body, ctx);
        case '/bze.dao.MsgUpdateMetadata':
            return {type: 'update_metadata', name: str(field(body, 'name')), description: str(field(body, 'description'))};
        case '/bze.dao.MsgUpdateMembers':
            return {type: 'update_members', add: strings(field(body, 'add')), remove: strings(field(body, 'remove'))};
        case '/bze.dao.MsgUpdateElectorate': {
            const e = field(body, 'electorate');
            const electorate = isObject(e) ? snakeKeys(e) : {};
            return {type: 'update_electorate', srIds: strings(electorate.sr_ids), drDenom: str(electorate.dr_denom)};
        }
        case '/bze.dao.MsgNominateAdmin': {
            const nominee = str(field(body, 'nominee'));
            return {type: 'nominate_admin', daoId: str(field(body, 'dao_id')), nominee, toVoters: nominee === ''};
        }
        case '/bze.dao.MsgWithdrawAdminNomination':
            return {type: 'withdraw_nomination', daoId: str(field(body, 'dao_id'))};
        case '/bze.dao.MsgAcceptAdminNomination':
            return {type: 'accept_admin', daoId: str(field(body, 'dao_id')), nominee: str(field(body, 'nominee'))};
        case '/bze.dao.MsgAdminExecute': {
            if (depth + 1 >= MAX_NESTING) return raw();
            const inner = field(body, 'msgs');
            const msgs = Array.isArray(inner) ? inner.filter((m): m is DaoProposalMessage => isObject(m) && typeof m['@type'] === 'string') : [];
            // a sub-DAO runs the inner messages as itself: its account is not this DAO's
            const daoId = str(field(body, 'dao_id'));
            return {type: 'admin_execute', daoId, actions: msgs.map((m) => describeMessage(m, {...ctx, daoAddress: null, before: ctx.beforeOf?.(daoId) ?? null}, depth + 1, daoId))};
        }
        default:
            return raw();
    }
}

/** What a proposal does, one action per message; an empty list is a text-only proposal. */
export const describeMessages = (msgs: readonly DaoProposalMessage[], ctx: DescribeContext): MsgAction[] =>
    msgs.map((m) => describeMessage(m, ctx));
