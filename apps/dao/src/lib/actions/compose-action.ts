import type {EncodeObject} from '@bze/bzejs/types';
import type {ActionContext, ActionDraft, ActionEntry} from './types';

export interface ComposedAction {
    key: string;
    /** Why this action cannot be sent; undefined when it is complete. */
    error?: string;
    warnings: string[];
    msg?: EncodeObject;
}

/** Looks an entry up by id (the registry's `findAction`, injected so entries can compose other entries). */
export type FindAction = (id: string) => ActionEntry | undefined;

/** One action draft turned into its message, or the reason it cannot be one. Never throws. */
export function composeAction(draft: ActionDraft, ctx: ActionContext, find: FindAction): ComposedAction {
    const entry = find(draft.type);
    if (!entry) return {key: draft.key, error: 'This kind of action is not known.', warnings: []};
    const problem = entry.validate(draft.fields, ctx);
    if (problem) return {key: draft.key, error: problem, warnings: []};
    try {
        return {key: draft.key, msg: entry.build(draft.fields, ctx), warnings: entry.warnings?.(draft.fields, ctx) ?? []};
    } catch (e) {
        return {key: draft.key, error: (e as Error).message, warnings: []};
    }
}
