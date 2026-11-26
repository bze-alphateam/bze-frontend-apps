import {describe, expect, it} from "vitest";
import type {DraftStorage} from "./draft";
import {clearPending, loadPending, pendingKey, readProposalId, savePending} from "./pending";

const memory = (): DraftStorage & {data: Map<string, string>} => {
    const data = new Map<string, string>();
    return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)};
};
const HASH = "0123456789abcdef".repeat(4);

describe("the pending transaction of a DAO", () => {
    it("round-trips per DAO and clears", () => {
        const s = memory();
        savePending(s, "4", HASH);
        expect(loadPending(s, "4")).toBe(HASH);
        expect(loadPending(s, "5")).toBeNull();
        clearPending(s, "4");
        expect(loadPending(s, "4")).toBeNull();
    });

    it.each([
        ["not JSON", "{{"],
        ["a string", '"x"'],
        ["null", "null"],
        ["another version", JSON.stringify({v: 2, hash: HASH})],
        ["a hash that is not 64 hex digits", JSON.stringify({v: 1, hash: "../../etc"})],
        ["a number", JSON.stringify({v: 1, hash: 5})],
    ])("%s is no pending transaction", (_name, raw) => {
        const s = memory();
        s.setItem(pendingKey("4"), raw);
        expect(loadPending(s, "4")).toBeNull();
    });

    it("storage that throws, or none, never breaks the page", () => {
        const broken: DraftStorage = {getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); }};
        expect(() => savePending(broken, "4", HASH)).not.toThrow();
        expect(() => clearPending(broken, "4")).not.toThrow();
        expect(loadPending(broken, "4")).toBeNull();
        expect(() => savePending(null, "4", HASH)).not.toThrow();
        expect(loadPending(null, "4")).toBeNull();
    });
});

describe("readProposalId", () => {
    const event = [{type: "bze.dao.EventProposalSubmitted", attributes: [{key: "id", value: '"8"'}]}];

    it("prefers the response's own events and does not ask the node then", async () => {
        let asked = false;
        expect(await readProposalId({events: event}, HASH, async () => { asked = true; return []; })).toBe("8");
        expect(asked).toBe(false);
    });

    it("falls back to the node's copy, and gives up quietly when it cannot be read", async () => {
        expect(await readProposalId({}, HASH, async () => event)).toBe("8");
        expect(await readProposalId({}, HASH, async () => { throw new Error("down"); })).toBeNull();
        expect(await readProposalId({}, HASH, async () => [])).toBeNull();
    });
});
