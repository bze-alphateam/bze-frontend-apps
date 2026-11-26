import type {EncodeObject} from '@bze/bzejs/types';
import {daoMsgsSize, packDaoMsgs, validateDaoProposalContent} from '@bze/bze-ui-kit';
import {findAction} from '../actions/registry';
import type {ActionContext, ActionDraft} from '../actions/types';

export interface ComposerInput {
    title: string;
    summary: string;
    expedited: boolean;
    actions: ActionDraft[];
}

export interface ComposedAction {
    key: string;
    /** Why this action cannot be sent; undefined when it is complete. */
    error?: string;
    warnings: string[];
    msg?: EncodeObject;
}

export interface Composition {
    actions: ComposedAction[];
    /** The messages of every action; empty unless `ready`. */
    msgs: EncodeObject[];
    /** The packed size of the actions that are complete, in bytes (what the chain compares with `max_proposal_bytes`). */
    size: number;
    maxBytes: number;
    /** The title, summary, count or size problem, as a sentence. */
    contentError?: string;
    /** The expedited switch is on for a DAO that does not allow it (chain error 1121). */
    expeditedError?: string;
    ready: boolean;
}

/**
 * Turns what the user typed into the messages of the proposal and every reason it cannot be sent yet.
 * Pure: the registry entries and the DAO's limits are the only inputs, so the limits are tested at
 * their boundaries without a page.
 */
export function composeProposal(input: ComposerInput, ctx: ActionContext): Composition {
    const actions = input.actions.map((draft): ComposedAction => {
        const entry = findAction(draft.type);
        if (!entry) return {key: draft.key, error: 'This kind of action is not known.', warnings: []};
        const problem = entry.validate(draft.fields, ctx);
        if (problem) return {key: draft.key, error: problem, warnings: []};
        try {
            return {key: draft.key, msg: entry.build(draft.fields, ctx), warnings: entry.warnings?.(draft.fields, ctx) ?? []};
        } catch (e) {
            return {key: draft.key, error: (e as Error).message, warnings: []};
        }
    });

    const built = actions.flatMap((a) => (a.msg ? [a.msg] : []));
    let size = 0;
    try {
        size = daoMsgsSize(packDaoMsgs(built));
    } catch (e) {
        // an action built a message the ui-kit cannot pack: its own check should have said so; report it, never send
        return {
            actions, msgs: [], size: 0, maxBytes: Number(ctx.params.max_proposal_bytes), ready: false,
            contentError: `An action could not be packed: ${(e as Error).message}`,
        };
    }

    const contentError = validateDaoProposalContent({title: input.title, summary: input.summary, msgCount: input.actions.length, msgsSize: size}, ctx.params);
    const expeditedError = input.expedited && !ctx.dao.config.allow_expedite ? 'This DAO does not allow expedited proposals.' : undefined;
    const ready = !contentError && !expeditedError && actions.every((a) => !a.error);

    return {actions, msgs: ready ? built : [], size, maxBytes: Number(ctx.params.max_proposal_bytes), contentError, expeditedError, ready};
}
