import {presetRules, type CreateDaoDraft, type DaoRulesDraft} from '@bze/bze-ui-kit';

// The unsent draft of the create page, kept in this browser only and only for the wallet that wrote
// it. Anything that fails (storage blocked, a value from an older version, a draft of another wallet,
// a field of the wrong type) reads as "no draft", except the rules: those are merged over the
// defaults so a partial object can never crash the form.

export const CREATE_DRAFT_KEY = 'dao.create-draft.v1';
const VERSION = 1;

export interface DraftStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const TYPES = ['DAO_TYPE_STATIC_LIST', 'DAO_TYPE_STAKE'];
const ADMINS = ['voters', 'me', 'other'];
const PRESETS = ['small-council', 'simple-majority', 'token-community', 'custom'];
const REFUNDS = ['ALWAYS', 'ONLY_PASSED', 'NEVER'];
const DESTINATIONS = ['BURN', 'TREASURY'];

/** The rules form of a stored value: defaults, with every stored field of the right type laid over them. */
const readRules = (value: unknown): DaoRulesDraft | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const stored = value as Record<string, unknown>;
    const rules: Record<string, unknown> = {...presetRules('custom')};
    for (const [key, fallback] of Object.entries(rules)) {
        if (typeof stored[key] === typeof fallback) rules[key] = stored[key];
    }
    if (!REFUNDS.includes(rules.refundPolicy as string)) rules.refundPolicy = 'ALWAYS';
    for (const key of ['costDestination', 'keptDepositDestination']) {
        if (!DESTINATIONS.includes(rules[key] as string)) rules[key] = key === 'costDestination' ? 'BURN' : 'TREASURY';
    }
    return rules as unknown as DaoRulesDraft;
};

const readDraft = (value: unknown): CreateDaoDraft | undefined => {
    const d = value as Record<string, unknown> | null;
    if (!d || typeof d !== 'object') return undefined;
    const electorate = d.electorate as {sr_ids?: unknown; dr_denom?: unknown} | undefined;
    const rules = readRules(d.rules);
    if (!TYPES.includes(d.type as string) || !ADMINS.includes(d.adminChoice as string) || !PRESETS.includes(d.presetId as string)) return undefined;
    if (![d.name, d.description, d.membersText, d.adminAddress].every(isString)) return undefined;
    if (!electorate || !Array.isArray(electorate.sr_ids) || !electorate.sr_ids.every(isString) || !isString(electorate.dr_denom)) return undefined;
    if (!rules) return undefined;
    return {
        type: d.type as CreateDaoDraft['type'],
        name: d.name as string,
        description: d.description as string,
        membersText: d.membersText as string,
        electorate: {sr_ids: electorate.sr_ids as string[], dr_denom: electorate.dr_denom},
        adminChoice: d.adminChoice as CreateDaoDraft['adminChoice'],
        adminAddress: d.adminAddress as string,
        presetId: d.presetId as CreateDaoDraft['presetId'],
        rules,
    };
};

/** The draft this wallet left, or undefined. */
export function loadDraft(storage: DraftStorage | undefined, address: string | undefined): CreateDaoDraft | undefined {
    try {
        const raw = storage?.getItem(CREATE_DRAFT_KEY);
        if (!raw || !address) return undefined;
        const stored = JSON.parse(raw) as {v?: unknown; address?: unknown; draft?: unknown} | null;
        if (!stored || stored.v !== VERSION || !isString(stored.address) || stored.address.toLowerCase() !== address.toLowerCase()) return undefined;
        return readDraft(stored.draft);
    } catch {
        return undefined;
    }
}

export function saveDraft(storage: DraftStorage | undefined, address: string | undefined, draft: CreateDaoDraft | undefined): void {
    try {
        if (!storage) return;
        if (draft && address) storage.setItem(CREATE_DRAFT_KEY, JSON.stringify({v: VERSION, address, draft}));
        else storage.removeItem(CREATE_DRAFT_KEY);
    } catch {
        // a draft is a convenience: losing it is fine
    }
}
