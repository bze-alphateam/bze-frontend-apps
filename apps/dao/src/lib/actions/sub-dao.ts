import type {EncodeObject} from '@bze/bzejs/types';
import {
    buildAdminExecuteMsg, buildNominateAdminMsg, buildWithdrawAdminNominationMsg, canonicalAddress,
    daoMsgsSize, packDaoMsgs, validateDaoAdminExecute,
} from '@bze/bze-ui-kit';
import {electorateVoterStake} from './electorate';
import {composeAction, type FindAction} from './compose-action';
import type {ActionContext, ActionDraft, ActionEntry, ActionFields, SubDao} from './types';

export const SUB_ADMIN_ID = 'sub-dao-admin';
export const SUB_EXECUTE_ID = 'sub-dao-execute';

export type SubAdminMode = 'nominate' | 'withdraw' | 'voters';
export const SUB_ADMIN_MODES: readonly SubAdminMode[] = ['nominate', 'withdraw', 'voters'];

/**
 * What an admin cannot make its DAO sign through `MsgAdminExecute` (chain error 1133): grants would outlive
 * the admin, and an authz exec dispatches a message signed by its own grantee without any grant.
 */
export const ADMIN_REFUSED_TYPES: readonly string[] = [
    '/cosmos.authz.v1beta1.MsgGrant',
    '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
    '/cosmos.authz.v1beta1.MsgExec',
];

/** MsgSettleProposal never runs inside a DAO execution (the chain refuses it, also inside an authz exec). */
export const SETTLE_TYPE = '/bze.dao.MsgSettleProposal';

/**
 * The context of the actions a DAO runs as one of its sub-DAOs: the sub-DAO signs, its treasury is the
 * one that pays, and it has no sub-DAOs or nominations that this page knows. The
 * sub-DAO is administered by the DAO, so it is never self-owned and its electorate may be empty.
 */
export const subContext = (ctx: ActionContext, sub: SubDao): ActionContext => ({
    ...ctx,
    dao: sub.dao,
    treasury: sub.treasury,
    subDaos: [],
    incoming: [],
    // the sub-DAO's own sources, with the sub-DAO's own stake in them (it never votes)
    sources: sub.sources,
});

const subOf = (fields: ActionFields, ctx: ActionContext): SubDao | undefined => ctx.subDaos?.find((s) => s.dao.id === (fields.daoId ?? ''));

/** `null`: the sub-DAOs could not be read; a sentence: this DAO cannot manage that one; else the sub-DAO. */
const resolveSub = (fields: ActionFields, ctx: ActionContext): SubDao | string => {
    if (ctx.subDaos === null) return 'The DAOs this DAO administers could not be read right now. Try again in a moment.';
    const sub = subOf(fields, ctx);
    if (!sub) return 'Choose one of the DAOs this DAO administers.';
    if (sub.dao.admin !== ctx.dao.address) return `${sub.dao.name} is no longer administered by this DAO.`;
    return sub;
};

/** Offered when this DAO administers a DAO, or when that could not be read (the form then says so). */
const hasSubDaos = (_dao: ActionContext['dao'], ctx?: ActionContext): boolean => !!ctx && (ctx.subDaos === null || ctx.subDaos.length > 0);

const modeOf = (fields: ActionFields): SubAdminMode | undefined => SUB_ADMIN_MODES.find((m) => m === fields.mode);

const subAdminCheck = (fields: ActionFields, ctx: ActionContext): string | undefined => {
    const sub = resolveSub(fields, ctx);
    if (typeof sub === 'string') return sub;
    const mode = modeOf(fields);
    if (!mode) return 'Choose what to do with the admin of this DAO.';

    if (mode === 'withdraw') return sub.dao.pending_admin === '' ? `${sub.dao.name} has no pending nomination to withdraw.` : undefined;

    if (mode === 'voters') {
        const none = `${sub.dao.name} has no voters to hand it to: set up its voters first (the chain refuses it, error 1113).`;
        if (sub.dao.type === 'DAO_TYPE_STATIC_LIST') return sub.dao.members.length > 0 ? undefined : none;
        // a stake DAO needs voting stake in its sources, without its own (the chain's live-electorate check)
        if (!sub.dao.electorate || sub.sources === null) return sub.dao.electorate ? `The stake of ${sub.dao.name} could not be read, so it cannot be checked that it has voters. Try again in a moment.` : none;
        const stake = electorateVoterStake(sub.dao.electorate, sub.sources);
        if (stake === null) return `The stake of ${sub.dao.name} could not be read, so it cannot be checked that it has voters. Try again in a moment.`;
        return stake.isGreaterThan(0) ? undefined : none;
    }

    const nominee = (fields.nominee ?? '').trim();
    if (nominee === '') return 'Enter the address of the new admin.';
    const canonical = canonicalAddress(nominee);
    if (!canonical) return 'The new admin is not a valid BeeZee address (it starts with bze1).';
    if (canonical === sub.dao.address.toLowerCase()) return `${sub.dao.name} cannot nominate itself: choose "Hand it to its own voters" to make it self-owned.`;
    if (canonical === ctx.dao.address.toLowerCase()) return 'This DAO is already the admin.';
    return undefined;
};

/** The admin of a DAO this DAO administers: nominate another, withdraw a nomination, or hand it to its voters. */
export const subAdminEntry: ActionEntry = {
    id: SUB_ADMIN_ID,
    label: 'Change the admin of a DAO this DAO administers',
    description: 'Nominate a new admin for a sub-DAO, withdraw its nomination, or hand it to its own voters.',
    available: hasSubDaos,
    initialFields: (ctx) => ({daoId: ctx.subDaos?.[0]?.dao.id ?? '', mode: 'nominate', nominee: ''}),
    validate: subAdminCheck,
    warnings(fields, ctx) {
        const sub = resolveSub(fields, ctx);
        const mode = modeOf(fields);
        if (typeof sub === 'string' || !mode || subAdminCheck(fields, ctx)) return [];
        const warnings: string[] = [];
        if (mode !== 'withdraw' && sub.dao.pending_admin !== '') {
            warnings.push(`${sub.dao.name} already has a pending nomination: the chain accepts one at a time (error 1112). Withdraw it first, in an action before this one.`);
        }
        if (mode === 'voters') warnings.push(`${sub.dao.name} becomes self-owned: this DAO stops being its admin and can no longer run messages as it.`);
        if (mode === 'nominate') warnings.push(`This DAO stays the admin until the nominee accepts. An external admin can run any message as ${sub.dao.name}, including spending its treasury.`);
        return warnings;
    },
    build(fields, ctx) {
        const problem = subAdminCheck(fields, ctx);
        if (problem) throw new Error(problem);
        const sub = resolveSub(fields, ctx) as SubDao;
        const mode = modeOf(fields) as SubAdminMode;
        if (mode === 'withdraw') return buildWithdrawAdminNominationMsg({authority: ctx.dao.address, daoId: sub.dao.id});
        return buildNominateAdminMsg({
            authority: ctx.dao.address,
            daoId: sub.dao.id,
            nominee: mode === 'voters' ? '' : (fields.nominee ?? '').trim().toLowerCase(),
        });
    },
};

// ---- run actions as a sub-DAO ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The most inner actions a draft stores; far above any chain limit, so a corrupt draft stays small. */
const MAX_INNER = 64;

/** The inner actions as the text a field holds. */
export const innerToField = (inner: readonly Pick<ActionDraft, 'type' | 'fields'>[]): string =>
    JSON.stringify(inner.map(({type, fields}) => ({type, fields})));

/** The row id of the inner action at `index`: positional, so a row keeps its identity while it is edited. */
export const innerKey = (index: number): string => `inner${index}`;

/**
 * The inner actions of a stored field, every one checked: a list of `{type, fields}` whose fields are all
 * text. The row ids are positional (`innerKey`), as they are not stored.
 */
export function innerFromField(text: string): ActionDraft[] | string {
    if (text === '') return [];
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return 'The saved actions could not be read. Remove this action and add it again.';
    }
    if (!Array.isArray(data) || data.length > MAX_INNER) return 'The saved actions could not be read. Remove this action and add it again.';
    const drafts: ActionDraft[] = [];
    for (const [index, item] of data.entries()) {
        if (!isObject(item) || typeof item.type !== 'string' || !isObject(item.fields)) return 'The saved actions could not be read. Remove this action and add it again.';
        const fields: ActionFields = {};
        for (const [name, value] of Object.entries(item.fields)) {
            if (typeof value !== 'string') return 'The saved actions could not be read. Remove this action and add it again.';
            fields[name] = value;
        }
        drafts.push({key: innerKey(index), type: item.type, fields});
    }
    return drafts;
}

interface Inner {
    sub: SubDao;
    subCtx: ActionContext;
    msgs: EncodeObject[];
    warnings: string[];
}

/** The messages of the inner actions, or the first reason they are not one. */
function composeInner(fields: ActionFields, ctx: ActionContext, find: FindAction): Inner | string {
    const sub = resolveSub(fields, ctx);
    if (typeof sub === 'string') return sub;
    if (sub.dao.admin === sub.dao.address) return `${sub.dao.name} owns itself: only its own proposals run actions as it.`;

    const drafts = innerFromField(fields.inner ?? '');
    if (typeof drafts === 'string') return drafts;

    const subCtx = subContext(ctx, sub);
    const msgs: EncodeObject[] = [];
    const warnings: string[] = [];
    for (const [i, draft] of drafts.entries()) {
        const entry = find(draft.type);
        if (!entry || !entry.available(subCtx.dao, subCtx)) return `Action ${i + 1} is not available for ${sub.dao.name}.`;
        const composed = composeAction(draft, subCtx, find);
        if (composed.error || !composed.msg) return `Action ${i + 1}: ${composed.error ?? 'it is not complete.'}`;
        if (composed.msg.typeUrl === SETTLE_TYPE) return `Action ${i + 1}: a settle message never runs inside a DAO execution.`;
        if (ADMIN_REFUSED_TYPES.includes(composed.msg.typeUrl)) {
            return `Action ${i + 1}: the chain refuses ${composed.msg.typeUrl} when an admin runs it for a DAO (authz grants, fee allowances and authz exec, error 1133).`;
        }
        msgs.push(composed.msg);
        warnings.push(...composed.warnings.map((w) => `Action ${i + 1}: ${w}`));
    }

    let size: number;
    try {
        size = daoMsgsSize(packDaoMsgs(msgs));
    } catch (e) {
        return `An action could not be packed: ${(e as Error).message}`;
    }
    const content = validateDaoAdminExecute({msgCount: msgs.length, msgsSize: size}, ctx.params);
    return content ?? {sub, subCtx, msgs, warnings};
}

/**
 * Run actions as a sub-DAO: a `MsgAdminExecute` this DAO signs as the sub-DAO's admin, whose inner actions
 * come from the same registry with the sub-DAO as their signer. The registry is injected (it lists this
 * entry too), so the entry has no import cycle with it.
 */
export function createSubExecuteEntry(find: FindAction): ActionEntry {
    return {
        id: SUB_EXECUTE_ID,
        label: 'Run actions as a DAO this DAO administers',
        description: "Pay from a sub-DAO's treasury, change its rules or members: it signs, this DAO is its admin.",
        available: hasSubDaos,
        initialFields: (ctx) => ({daoId: ctx.subDaos?.[0]?.dao.id ?? '', inner: ''}),
        validate(fields, ctx) {
            const inner = composeInner(fields, ctx, find);
            return typeof inner === 'string' ? inner : undefined;
        },
        warnings(fields, ctx) {
            const inner = composeInner(fields, ctx, find);
            return typeof inner === 'string' ? [] : [
                ...inner.warnings,
                `${inner.sub.dao.name} signs these actions and this DAO runs them as its admin. Executions nest at most 5 levels deep (error 1134).`,
            ];
        },
        build(fields, ctx) {
            const inner = composeInner(fields, ctx, find);
            if (typeof inner === 'string') throw new Error(inner);
            return buildAdminExecuteMsg({admin: ctx.dao.address, daoId: inner.sub.dao.id, msgs: inner.msgs});
        },
    };
}
