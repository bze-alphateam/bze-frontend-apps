import type {ActionDraft} from '../actions/types';

/** Bumped when the stored shape changes; a draft of another version is ignored, never migrated by guesswork. */
export const DRAFT_VERSION = 1;

const MAX_ACTIONS = 64;
const MAX_TEXT = 200_000;

export interface Draft {
    title: string;
    summary: string;
    expedited: boolean;
    actions: ActionDraft[];
}

/** The part of `localStorage` the draft uses; injected so tests and a blocked storage need no browser. */
export interface DraftStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export const draftKey = (daoId: string): string => `bze-dao:proposal-draft:${daoId}`;

export const isEmptyDraft = (draft: Draft): boolean =>
    draft.title === '' && draft.summary === '' && !draft.expedited && draft.actions.length === 0;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Saves the draft of a DAO; an empty one removes the entry. Storage that throws (private window,
 * blocked site data, quota) loses the draft, never the page.
 */
export function saveDraft(storage: DraftStorage | null, daoId: string, draft: Draft): void {
    if (!storage) return;
    try {
        if (isEmptyDraft(draft)) {
            storage.removeItem(draftKey(daoId));
            return;
        }
        storage.setItem(draftKey(daoId), JSON.stringify({
            v: DRAFT_VERSION,
            title: draft.title,
            summary: draft.summary,
            expedited: draft.expedited,
            actions: draft.actions.map(({type, fields}) => ({type, fields})),
        }));
    } catch {
        // the draft is a convenience
    }
}

export function clearDraft(storage: DraftStorage | null, daoId: string): void {
    try {
        storage?.removeItem(draftKey(daoId));
    } catch {
        // nothing to clear
    }
}

/**
 * The saved draft of a DAO, checked field by field: wrong version, wrong types, an action of a kind
 * the DAO does not offer, a field that is not text are each dropped; whatever is left is returned.
 * Null when nothing usable is stored. Never throws: a corrupt entry is a missing draft.
 * `newKey` makes the row ids (they are not stored).
 */
export function loadDraft(
    storage: DraftStorage | null,
    daoId: string,
    isKnownAction: (type: string) => boolean,
    newKey: () => string,
): Draft | null {
    try {
        const raw = storage?.getItem(draftKey(daoId));
        if (!raw) return null;
        const data: unknown = JSON.parse(raw);
        if (!isObject(data) || data.v !== DRAFT_VERSION) return null;

        const text = (v: unknown): string => (typeof v === 'string' && v.length <= MAX_TEXT ? v : '');
        const actions: ActionDraft[] = [];
        if (Array.isArray(data.actions)) {
            for (const item of data.actions.slice(0, MAX_ACTIONS)) {
                if (!isObject(item) || typeof item.type !== 'string' || !isKnownAction(item.type) || !isObject(item.fields)) continue;
                const fields: Record<string, string> = {};
                for (const [name, value] of Object.entries(item.fields)) {
                    if (typeof value === 'string' && value.length <= MAX_TEXT) fields[name] = value;
                }
                actions.push({key: newKey(), type: item.type, fields});
            }
        }

        const draft: Draft = {title: text(data.title), summary: text(data.summary), expedited: data.expedited === true, actions};
        return isEmptyDraft(draft) ? null : draft;
    } catch {
        return null;
    }
}

/** The browser's `localStorage`, or null where it is missing or throws on access (private window, blocked site data). */
export function browserStorage(): DraftStorage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}
