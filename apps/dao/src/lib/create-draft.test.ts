import {describe, expect, it} from 'vitest';
import type {CreateDaoDraft} from '@bze/bze-ui-kit';
import {CREATE_DRAFT_KEY, loadDraft, saveDraft, type DraftStorage} from './create-draft';

const memory = (): DraftStorage & {data: Map<string, string>} => {
    const data = new Map<string, string>();
    return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)};
};

const DRAFT = {
    type: 'DAO_TYPE_STATIC_LIST', name: 'Hive', description: '', membersText: 'bze1a', electorate: {sr_ids: [], dr_denom: ''},
    adminChoice: 'voters', adminAddress: '', presetId: 'simple-majority', rules: {quorumPct: '40'},
} as unknown as CreateDaoDraft;

describe('the create draft', () => {
    it('is saved, restored and forgotten', () => {
        const s = memory();
        saveDraft(s, DRAFT);
        expect(loadDraft(s)).toEqual(DRAFT);
        saveDraft(s, undefined);
        expect(s.data.has(CREATE_DRAFT_KEY)).toBe(false);
        expect(loadDraft(s)).toBeUndefined();
    });

    it('reads garbage, an old shape or a blocked storage as no draft', () => {
        const s = memory();
        s.data.set(CREATE_DRAFT_KEY, '{nope');
        expect(loadDraft(s)).toBeUndefined();
        s.data.set(CREATE_DRAFT_KEY, JSON.stringify({type: 'x'}));
        expect(loadDraft(s)).toBeUndefined();
        const blocked: DraftStorage = {getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); }};
        expect(loadDraft(blocked)).toBeUndefined();
        expect(() => saveDraft(blocked, DRAFT)).not.toThrow();
        expect(loadDraft(undefined)).toBeUndefined();
    });
});
