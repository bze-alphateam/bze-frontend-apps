import type {EncodeObject} from '@bze/bzejs/types';
import {
    buildAdminExecuteMsg, buildNominateAdminMsg, buildWithdrawAdminNominationMsg,
    daoMsgsSize, packDaoMsgs, validateDaoAdminExecute,
} from '@bze/bze-ui-kit';
import {nomineeProblem} from './admin';
import {handOverProblem} from './electorate';
import {composeAction, type ComposedAction, type FindAction} from './compose-action';
import {ADMIN_REFUSED_TYPES, inspectExecution, MAX_EXECUTION_DEPTH, SETTLE_TYPE} from './execution';
import type {ActionContext, ActionDraft, ActionEntry, ActionFields, SubDao} from './types';

export {ADMIN_REFUSED_TYPES, SETTLE_TYPE};

export const SUB_ADMIN_ID = 'sub-dao-admin';
export const SUB_EXECUTE_ID = 'sub-dao-execute';

export type SubAdminMode = 'nominate' | 'withdraw' | 'voters';
export const SUB_ADMIN_MODES: readonly SubAdminMode[] = ['nominate', 'withdraw', 'voters'];

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

    if (mode === 'voters') return handOverProblem(sub.dao, sub.sources);

    return nomineeProblem((fields.nominee ?? '').trim(), {
        daoAddress: sub.dao.address,
        adminAddress: ctx.dao.address,
        isDao: `${sub.dao.name} cannot nominate itself: choose "Hand it to its own voters" to make it self-owned.`,
        isAdmin: 'This DAO is already the admin.',
    });
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

/** What an admin's list of actions composes to: each action, and every reason the list cannot be sent. */
export interface AdminComposition {
    actions: ComposedAction[];
    /** The messages of every action; empty unless `ready`. */
    msgs: EncodeObject[];
    /** The packed size of the complete actions, in bytes (what the chain compares with `max_proposal_bytes`). */
    size: number;
    maxBytes: number;
    /** The first problem as a sentence: an action's (numbered), or the count, size or nesting of the list. */
    error?: string;
    warnings: string[];
    ready: boolean;
}

/**
 * The actions an admin makes a DAO run (`ctx.dao` is that DAO: it signs every message), each composed with the
 * registry's entries. The chain's rules for this path are applied to every action: its entry must be offered for
 * the DAO, a settle message and authz grants, fee allowances and authz exec are refused (1133), the whole list
 * has 1 to `max_msgs_per_proposal` messages within `max_proposal_bytes`, and the executions nested inside each
 * other stay within the chain's limit (1134). `levelsAbove` counts the executions the list already runs
 * inside: 0 for the admin's own transaction, 1 for the actions a DAO runs as its sub-DAO's admin.
 */
export function composeAdminActions(drafts: readonly ActionDraft[], ctx: ActionContext, find: FindAction, levelsAbove: number): AdminComposition {
    const maxBytes = Number(ctx.params.max_proposal_bytes);
    const actions: ComposedAction[] = drafts.map((draft) => {
        const entry = find(draft.type);
        if (!entry || !entry.available(ctx.dao, ctx)) return {key: draft.key, error: `This action is not available for ${ctx.dao.name}.`, warnings: []};
        const composed = composeAction(draft, ctx, find);
        if (!composed.msg) return composed;
        if (composed.msg.typeUrl === SETTLE_TYPE) return {key: draft.key, error: 'A settle message never runs inside a DAO execution.', warnings: []};
        if (ADMIN_REFUSED_TYPES.includes(composed.msg.typeUrl)) {
            return {key: draft.key, error: `The chain refuses ${composed.msg.typeUrl} when an admin runs it for a DAO (authz grants, fee allowances and authz exec, error 1133).`, warnings: []};
        }
        return composed;
    });
    const warnings = actions.flatMap((a, i) => a.warnings.map((w) => `Action ${i + 1}: ${w}`));
    const firstBad = actions.findIndex((a) => a.error || !a.msg);
    const base = {actions, maxBytes, warnings};
    if (firstBad >= 0) {
        const bad = actions[firstBad];
        return {...base, msgs: [], size: 0, ready: false, error: `Action ${firstBad + 1}: ${bad.error ?? 'it is not complete.'}`};
    }

    const msgs = actions.flatMap((a) => (a.msg ? [a.msg] : []));
    let size: number;
    try {
        size = daoMsgsSize(packDaoMsgs(msgs));
    } catch (e) {
        return {...base, msgs: [], size: 0, ready: false, error: `An action could not be packed: ${(e as Error).message}`};
    }
    const content = validateDaoAdminExecute({msgCount: msgs.length, msgsSize: size}, ctx.params);
    if (content) return {...base, msgs: [], size, ready: false, error: content};

    // the messages as the chain reads them, nested ones included: refused types at any level, and how deep it runs
    const inspected = inspectExecution(msgs);
    if (!inspected.ok) return {...base, msgs: [], size, ready: false, error: inspected.error};
    if (inspected.depth + levelsAbove > MAX_EXECUTION_DEPTH) {
        return {...base, msgs: [], size, ready: false, error: `The actions nest ${inspected.depth + levelsAbove} executions deep, and the chain allows at most ${MAX_EXECUTION_DEPTH} (error 1134).`};
    }
    return {...base, msgs, size, ready: true};
}

/** The messages of the inner actions, or the first reason they are not one. */
function composeInner(fields: ActionFields, ctx: ActionContext, find: FindAction): Inner | string {
    const sub = resolveSub(fields, ctx);
    if (typeof sub === 'string') return sub;
    if (sub.dao.admin === sub.dao.address) return `${sub.dao.name} owns itself: only its own proposals run actions as it.`;

    const drafts = innerFromField(fields.inner ?? '');
    if (typeof drafts === 'string') return drafts;

    const subCtx = subContext(ctx, sub);
    // this DAO runs the sub-DAO's actions through its own admin execute, which is one execution deep already
    const composed = composeAdminActions(drafts, subCtx, find, 1);
    return composed.ready ? {sub, subCtx, msgs: composed.msgs, warnings: composed.warnings} : composed.error ?? 'The actions are not complete.';
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
