import {describe, expect, it} from 'vitest';
import {presetRules, rulesToConfig, type CreateDaoDraft} from '@bze/bze-ui-kit';
import {CREATE_DRAFT_KEY, loadDraft, saveDraft, type DraftStorage} from './create-draft';

const memory = (): DraftStorage & {data: Map<string, string>} => {
    const data = new Map<string, string>();
    return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)};
};

const WALLET = 'bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw';
const DRAFT: CreateDaoDraft = {
    type: 'DAO_TYPE_STATIC_LIST', name: 'Hive', description: '', membersText: 'bze1a', electorate: {sr_ids: [], dr_denom: ''},
    adminChoice: 'voters', adminAddress: '', presetId: 'simple-majority', rules: presetRules('simple-majority'),
};
const put = (s: ReturnType<typeof memory>, draft: unknown, address = WALLET, v = 1) =>
    s.data.set(CREATE_DRAFT_KEY, JSON.stringify({v, address, draft}));

describe('the create draft', () => {
    it('is saved, restored and forgotten', () => {
        const s = memory();
        saveDraft(s, WALLET, DRAFT);
        expect(loadDraft(s, WALLET)).toEqual(DRAFT);
        saveDraft(s, WALLET, undefined);
        expect(s.data.has(CREATE_DRAFT_KEY)).toBe(false);
        expect(loadDraft(s, WALLET)).toBeUndefined();
    });

    it('is only restored for the wallet that wrote it', () => {
        const s = memory();
        saveDraft(s, WALLET, DRAFT);
        expect(loadDraft(s, 'bze1someoneelse')).toBeUndefined();
        expect(loadDraft(s, WALLET.toUpperCase())).toEqual(DRAFT);
        expect(loadDraft(s, undefined)).toBeUndefined();
    });

    it('a partial rules object is filled from the defaults, so the form cannot crash on it', () => {
        const s = memory();
        put(s, {...DRAFT, rules: {quorumPct: '55', votingDays: 3}}); // votingDays has the wrong type
        const restored = loadDraft(s, WALLET)!;
        expect(restored.rules.quorumPct).toBe('55');
        expect(restored.rules.votingDays).toBe(presetRules('custom').votingDays);
        expect(() => rulesToConfig(restored.rules, {
            params: {min_voting_period: '3600s', max_voting_period: '7776000s'} as never, decimalsOf: () => 6, nativeDenom: 'ubze',
        })).not.toThrow();
    });

    it('drops garbage, an old version, a wrong field type or a missing part', () => {
        const s = memory();
        s.data.set(CREATE_DRAFT_KEY, '{nope');
        expect(loadDraft(s, WALLET)).toBeUndefined();
        put(s, DRAFT, WALLET, 0);
        expect(loadDraft(s, WALLET)).toBeUndefined();
        for (const bad of [
            {...DRAFT, name: 5},
            {...DRAFT, type: 'DAO_TYPE_OTHER'},
            {...DRAFT, adminChoice: 'x'},
            {...DRAFT, electorate: {sr_ids: [1], dr_denom: ''}},
            {...DRAFT, electorate: undefined},
            {...DRAFT, rules: 'x'},
            null,
        ]) {
            put(s, bad);
            expect(loadDraft(s, WALLET)).toBeUndefined();
        }
    });

    it('reads a blocked storage as no draft and never throws on save', () => {
        const blocked: DraftStorage = {getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); }};
        expect(loadDraft(blocked, WALLET)).toBeUndefined();
        expect(() => saveDraft(blocked, WALLET, DRAFT)).not.toThrow();
        expect(loadDraft(undefined, WALLET)).toBeUndefined();
    });
});
