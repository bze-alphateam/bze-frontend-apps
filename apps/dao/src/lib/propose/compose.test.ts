import {describe, expect, it} from "vitest";
import {CONFIG, ctxWith, DAO, DAO_ADDRESS, OTHER, PARAMS} from "@/test/composer-fixtures";
import type {ActionDraft} from "@/lib/actions/types";
import {composeProposal} from "./compose";

const pay = (key = "a", over: Record<string, string> = {}): ActionDraft => ({key, type: "pay", fields: {denom: "ubze", amount: "1", to: OTHER, ...over}});
const input = (over: Partial<Parameters<typeof composeProposal>[0]> = {}) => ({title: "Fund the festival", summary: "", expedited: false, actions: [], ...over});

describe("composeProposal", () => {
    it("a text-only proposal is ready with no message", () => {
        const c = composeProposal(input(), ctxWith());
        expect(c).toMatchObject({ready: true, msgs: [], size: 0, maxBytes: 20000});
    });

    it("builds the messages of every action in order, signed by the DAO", () => {
        const c = composeProposal(input({actions: [pay("a"), pay("b", {amount: "2"})]}), ctxWith());
        expect(c.ready).toBe(true);
        expect(c.msgs.map((m) => (m.value as {amount: {amount: string}[]}).amount[0].amount)).toEqual(["1000000", "2000000"]);
        expect(c.msgs.every((m) => (m.value as {fromAddress: string}).fromAddress === DAO_ADDRESS)).toBe(true);
        expect(c.size).toBeGreaterThan(0);
    });

    it("an incomplete action keeps the proposal from being ready and says why", () => {
        const c = composeProposal(input({actions: [pay("a"), pay("b", {amount: ""})]}), ctxWith());
        expect(c.ready).toBe(false);
        expect(c.msgs).toEqual([]);
        expect(c.actions[0].error).toBeUndefined();
        expect(c.actions[1].error).toMatch(/Enter an amount/);
    });

    it("an action of a kind that is not known is an error, not a crash", () => {
        const c = composeProposal(input({actions: [{key: "x", type: "gone", fields: {}}]}), ctxWith());
        expect(c.ready).toBe(false);
        expect(c.actions[0].error).toMatch(/not known/);
    });

    it("carries the warnings of an action that is still valid", () => {
        const c = composeProposal(input({actions: [pay("a", {amount: "9999"})]}), ctxWith());
        expect(c.ready).toBe(true);
        expect(c.actions[0].warnings.join(" ")).toMatch(/holds less/);
    });

    describe("limits at their boundaries", () => {
        it("title: empty, 140 bytes, 141 bytes, and multi-byte characters count their bytes", () => {
            expect(composeProposal(input({title: ""}), ctxWith()).contentError).toBe("Enter a title.");
            expect(composeProposal(input({title: "a".repeat(140)}), ctxWith()).ready).toBe(true);
            expect(composeProposal(input({title: "a".repeat(141)}), ctxWith()).contentError).toMatch(/at most 140 bytes \(it has 141\)/);
            // 70 two-byte characters = 140 bytes; 71 = 142
            expect(composeProposal(input({title: "é".repeat(70)}), ctxWith()).ready).toBe(true);
            expect(composeProposal(input({title: "é".repeat(71)}), ctxWith()).contentError).toMatch(/it has 142/);
        });

        it("summary: 5,000 bytes pass, 5,001 do not, multi-byte too; a param of 0 allows a title only", () => {
            expect(composeProposal(input({summary: "a".repeat(5000)}), ctxWith()).ready).toBe(true);
            expect(composeProposal(input({summary: "a".repeat(5001)}), ctxWith()).contentError).toMatch(/summary can have at most 5000 bytes/);
            expect(composeProposal(input({summary: "€".repeat(1667)}), ctxWith()).contentError).toMatch(/it has 5001/);
            const titlesOnly = ctxWith({params: {...PARAMS, max_summary_len: "0"}});
            expect(composeProposal(input({summary: ""}), titlesOnly).ready).toBe(true);
            expect(composeProposal(input({summary: "x"}), titlesOnly).contentError).toMatch(/at most 0 bytes/);
        });

        it("message count: the maximum passes, one more does not", () => {
            const many = (n: number) => Array.from({length: n}, (_, i) => pay(`k${i}`));
            expect(composeProposal(input({actions: many(16)}), ctxWith()).ready).toBe(true);
            expect(composeProposal(input({actions: many(17)}), ctxWith()).contentError).toMatch(/at most 16 actions \(it has 17\)/);
        });

        it("packed size: exactly the limit passes, one byte over does not", () => {
            const one = composeProposal(input({actions: [pay("a")]}), ctxWith()).size;
            const at = ctxWith({params: {...PARAMS, max_proposal_bytes: String(one)}});
            const under = ctxWith({params: {...PARAMS, max_proposal_bytes: String(one - 1)}});
            expect(composeProposal(input({actions: [pay("a")]}), at).ready).toBe(true);
            const over = composeProposal(input({actions: [pay("a")]}), under);
            expect(over.ready).toBe(false);
            expect(over.contentError).toMatch(/bytes, at most/);
            expect(over.size).toBe(one);
        });
    });

    it("expedited needs the DAO to allow it", () => {
        expect(composeProposal(input({expedited: true}), ctxWith()).ready).toBe(true);
        const closed = ctxWith({dao: {...DAO, config: {...CONFIG, allow_expedite: false}}});
        const c = composeProposal(input({expedited: true}), closed);
        expect(c).toMatchObject({ready: false, expeditedError: "This DAO does not allow expedited proposals."});
        expect(composeProposal(input({expedited: false}), closed).ready).toBe(true);
    });
});
