import {describe, expect, it} from "vitest";
import {browserStorage, clearDraft, draftKey, DRAFT_VERSION, isEmptyDraft, loadDraft, saveDraft, type Draft, type DraftStorage} from "./draft";

const memory = (): DraftStorage & {data: Map<string, string>} => {
    const data = new Map<string, string>();
    return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)};
};
const known = (type: string) => type === "pay" || type === "custom";
let n = 0;
const newKey = () => `k${++n}`;

const draft: Draft = {title: "T", summary: "S", expedited: true, actions: [{key: "x", type: "pay", fields: {denom: "ubze", amount: "1", to: "bze1"}}]};

describe("the unsent draft", () => {
    it("round-trips per DAO and gives rows fresh keys", () => {
        const s = memory();
        saveDraft(s, "4", draft);
        expect(loadDraft(s, "5", known, newKey)).toBeNull();
        const back = loadDraft(s, "4", known, newKey);
        expect(back).toMatchObject({title: "T", summary: "S", expedited: true});
        expect(back?.actions).toEqual([{key: expect.stringMatching(/^k\d+$/), type: "pay", fields: {denom: "ubze", amount: "1", to: "bze1"}}]);
        expect(back?.actions[0].key).not.toBe("x");
    });

    it("an empty draft removes the entry, and clearing removes it", () => {
        const s = memory();
        saveDraft(s, "4", draft);
        saveDraft(s, "4", {title: "", summary: "", expedited: false, actions: []});
        expect(s.data.size).toBe(0);
        saveDraft(s, "4", draft);
        clearDraft(s, "4");
        expect(s.data.size).toBe(0);
        expect(isEmptyDraft({title: "", summary: "", expedited: false, actions: []})).toBe(true);
    });

    describe("restoring never trusts what it reads", () => {
        const put = (value: unknown) => {
            const s = memory();
            s.setItem(draftKey("4"), typeof value === "string" ? value : JSON.stringify(value));
            return s;
        };

        it.each([
            ["not JSON", "{{"],
            ["a number", 5],
            ["null", null],
            ["a list", []],
            ["another version", {v: DRAFT_VERSION + 1, title: "T"}],
            ["no version", {title: "T"}],
        ])("%s is no draft", (_name, value) => {
            expect(loadDraft(put(value), "4", known, newKey)).toBeNull();
        });

        it("keeps the valid fields and drops the invalid ones, one by one", () => {
            const back = loadDraft(put({
                v: DRAFT_VERSION,
                title: 42,
                summary: "kept",
                expedited: "yes",
                actions: [
                    {type: "pay", fields: {denom: "ubze", amount: 5, to: "bze1"}},
                    {type: "gone", fields: {a: "b"}},
                    {type: "pay", fields: "nope"},
                    {type: 7, fields: {}},
                    "junk",
                    null,
                    {type: "custom", fields: {json: "{}"}},
                ],
            }), "4", known, newKey);
            expect(back).toEqual({
                title: "", summary: "kept", expedited: false,
                actions: [
                    {key: expect.any(String), type: "pay", fields: {denom: "ubze", to: "bze1"}},
                    {key: expect.any(String), type: "custom", fields: {json: "{}"}},
                ],
            });
        });

        it("caps the number of actions and the size of a field", () => {
            const many = Array.from({length: 200}, () => ({type: "pay", fields: {denom: "ubze"}}));
            expect(loadDraft(put({v: DRAFT_VERSION, actions: many}), "4", known, newKey)?.actions).toHaveLength(64);
            expect(loadDraft(put({v: DRAFT_VERSION, title: "x".repeat(200_001), summary: "ok"}), "4", known, newKey)).toMatchObject({title: "", summary: "ok"});
        });

        it("never restores a field whose control is not there: expedited for a DAO that disallows it, a summary when it allows none", () => {
            const s = put({v: DRAFT_VERSION, title: "T", summary: "S", expedited: true});
            expect(loadDraft(s, "4", known, newKey, {allowExpedite: false, allowSummary: true})).toMatchObject({summary: "S", expedited: false});
            expect(loadDraft(s, "4", known, newKey, {allowExpedite: true, allowSummary: false})).toMatchObject({summary: "", expedited: true});
            expect(loadDraft(put({v: DRAFT_VERSION, summary: "S", expedited: true}), "4", known, newKey, {allowExpedite: false, allowSummary: false})).toBeNull();
        });

        it("a draft with nothing usable left is no draft", () => {
            expect(loadDraft(put({v: DRAFT_VERSION, title: 1, actions: [{type: "gone", fields: {}}]}), "4", known, newKey)).toBeNull();
        });
    });

    it("storage that throws loses the draft, never the page", () => {
        const broken: DraftStorage = {
            getItem: () => { throw new Error("blocked"); },
            setItem: () => { throw new Error("quota"); },
            removeItem: () => { throw new Error("blocked"); },
        };
        expect(() => saveDraft(broken, "4", draft)).not.toThrow();
        expect(() => clearDraft(broken, "4")).not.toThrow();
        expect(loadDraft(broken, "4", known, newKey)).toBeNull();
        expect(() => saveDraft(null, "4", draft)).not.toThrow();
        expect(loadDraft(null, "4", known, newKey)).toBeNull();
    });

    it("finds the browser's storage, or none", () => {
        expect(browserStorage()).toBe(window.localStorage);
    });
});
