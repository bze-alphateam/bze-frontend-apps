import type {CreateDaoDraft} from '@bze/bze-ui-kit';

// The unsent draft of the create page, kept in this browser only. Anything that fails
// (storage blocked, a value from an older version) reads as "no draft".

export const CREATE_DRAFT_KEY = 'dao.create-draft.v1';

export interface DraftStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const isDraft = (value: unknown): value is CreateDaoDraft => {
    const d = value as Partial<CreateDaoDraft> | null;
    return !!d && typeof d === 'object'
        && (d.type === 'DAO_TYPE_STATIC_LIST' || d.type === 'DAO_TYPE_STAKE')
        && typeof d.name === 'string' && typeof d.description === 'string' && typeof d.membersText === 'string'
        && Array.isArray(d.electorate?.sr_ids) && typeof d.electorate?.dr_denom === 'string'
        && typeof d.rules === 'object' && d.rules !== null && typeof d.presetId === 'string';
};

export function loadDraft(storage: DraftStorage | undefined): CreateDaoDraft | undefined {
    try {
        const raw = storage?.getItem(CREATE_DRAFT_KEY);
        if (!raw) return undefined;
        const parsed: unknown = JSON.parse(raw);
        return isDraft(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

export function saveDraft(storage: DraftStorage | undefined, draft: CreateDaoDraft | undefined): void {
    try {
        if (!storage) return;
        if (draft) storage.setItem(CREATE_DRAFT_KEY, JSON.stringify(draft));
        else storage.removeItem(CREATE_DRAFT_KEY);
    } catch {
        // a draft is a convenience: losing it is fine
    }
}
