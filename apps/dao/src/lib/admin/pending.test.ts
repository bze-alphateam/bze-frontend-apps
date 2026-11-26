import {describe, expect, it} from "vitest";
import type {DraftStorage} from "@/lib/propose/draft";
import {adminPendingKey, clearAdminPending, loadAdminPending, saveAdminPending} from "./pending";

const memory = (): DraftStorage & {data: Map<string, string>} => {
    const data = new Map<string, string>();
    return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)};
};
const HASH = "0123456789abcdef".repeat(4);

describe("the console's pending transaction", () => {
    it("is kept per DAO and per wallet, the wallet in lower case", () => {
        expect(adminPendingKey("4", "BZE1ABC")).toBe(adminPendingKey("4", "bze1abc"));
        expect(adminPendingKey("4", "bze1abc")).not.toBe(adminPendingKey("5", "bze1abc"));
        expect(adminPendingKey("4", "bze1abc")).not.toBe(adminPendingKey("4", "bze1xyz"));
        const s = memory();
        saveAdminPending(s, "4", "BZE1ABC", HASH, "accept");
        expect(loadAdminPending(s, "4", "bze1abc")).toEqual({hash: HASH, kind: "accept"});
        expect(loadAdminPending(s, "5", "bze1abc")).toBeNull();
        expect(loadAdminPending(s, "4", "bze1xyz")).toBeNull();
        clearAdminPending(s, "4", "bze1abc");
        expect(loadAdminPending(s, "4", "bze1abc")).toBeNull();
    });

    it.each(["nominate", "hand-over", "withdraw", "accept", "admin-execute"] as const)("restores a %s record with its kind", (kind) => {
        const s = memory();
        saveAdminPending(s, "4", "bze1abc", HASH, kind);
        expect(loadAdminPending(s, "4", "bze1abc")).toEqual({hash: HASH, kind});
    });

    it("reads a kind it does not know as an admin execute, which is judged by its hash alone", () => {
        const s = memory();
        s.setItem(adminPendingKey("4", "bze1abc"), JSON.stringify({v: 1, hash: HASH, kind: "vote"}));
        expect(loadAdminPending(s, "4", "bze1abc")).toEqual({hash: HASH, kind: "admin-execute"});
        s.setItem(adminPendingKey("4", "bze1abc"), JSON.stringify({v: 1, hash: HASH}));
        expect(loadAdminPending(s, "4", "bze1abc")?.kind).toBe("admin-execute");
    });

    it.each(["{{", "null", '"x"', JSON.stringify({v: 2, hash: HASH}), JSON.stringify({v: 1, hash: "../x", kind: "accept"})])("a corrupt value (%s) is no pending transaction", (raw) => {
        const s = memory();
        s.setItem(adminPendingKey("4", "bze1abc"), raw);
        expect(loadAdminPending(s, "4", "bze1abc")).toBeNull();
    });

    it("storage that is missing or throws never breaks the page", () => {
        expect(loadAdminPending(null, "4", "bze1abc")).toBeNull();
        const broken: DraftStorage = {getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); }};
        expect(() => saveAdminPending(broken, "4", "bze1abc", HASH, "accept")).not.toThrow();
        expect(loadAdminPending(broken, "4", "bze1abc")).toBeNull();
    });
});
