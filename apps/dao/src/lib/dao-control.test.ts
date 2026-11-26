import {describe, expect, it} from "vitest";
import type {DaoControllerResponse} from "@bze/bze-ui-kit";
import {describeControl, type KnownDao} from "./dao-control";

const DAO = "bze1dao";
const dao = (over: Partial<{admin: string; pending_admin: string}> = {}) => ({address: DAO, admin: "bze1person", pending_admin: "", ...over});
const known = (entries: Record<string, KnownDao> = {}) => new Map<string, KnownDao>([[DAO, {id: "1", name: "Mine"}], ...Object.entries(entries)]);
const walk = (end_reason: DaoControllerResponse["end_reason"], path: string[], controller: string): DaoControllerResponse => ({controller, end_reason, path});

describe("describeControl", () => {
    it("a self-owned DAO is governed by its voters", () => {
        const state = describeControl(dao({admin: DAO}), walk("SELF_OWNED", [DAO], DAO), known());
        expect(state).toMatchObject({kind: "self-owned", headline: "Governed by its voters", warning: null, steps: []});
    });

    it("an account admin gets the warning that it can spend the treasury", () => {
        const state = describeControl(dao(), walk("ACCOUNT", [DAO], "bze1person"), known());
        expect(state.kind).toBe("account");
        expect(state.headline).toBe("Admin: bze1person");
        expect(state.warning).toMatch(/spending its treasury/);
    });

    it("an admin that is another DAO: the chain ends at its voters", () => {
        const state = describeControl(dao({admin: "bze1b"}), walk("SELF_OWNED", [DAO, "bze1b"], "bze1b"), known({bze1b: {id: "2", name: "B"}}));
        expect(state.kind).toBe("dao");
        expect(state.headline).toBe("Administered by the DAO B");
        expect(state.steps.map((s) => s.kind)).toEqual(["dao", "dao", "voters"]);
        expect(state.warning).toBeNull();
    });

    it("an admin DAO controlled by an account ends at that account, with the warning", () => {
        const state = describeControl(dao({admin: "bze1b"}), walk("ACCOUNT", [DAO, "bze1b"], "bze1boss"), known({bze1b: {id: "2", name: "B"}}));
        expect(state.steps.at(-1)).toEqual({kind: "account", address: "bze1boss"});
        expect(state.warning).toMatch(/external admin/);
    });

    it.each([
        ["CYCLE", /loops back/],
        ["DEPTH_CAP", /too long/],
    ] as const)("a %s walk is explained", (reason, text) => {
        const state = describeControl(dao({admin: "bze1b"}), walk(reason, [DAO, "bze1b"], "bze1b"), known({bze1b: {id: "2", name: "B"}}));
        expect(state.note).toMatch(text);
        expect(state.steps.some((s) => s.kind === "voters" || s.kind === "account")).toBe(false);
    });

    it("an admin DAO is still named when the controller query failed", () => {
        const state = describeControl(dao({admin: "bze1b"}), null, known({bze1b: {id: "2", name: "B"}}));
        expect(state.kind).toBe("dao");
        expect(state.steps).toHaveLength(2);
    });

    it("a pending nomination names the nominee and says the admin stays in charge", () => {
        const state = describeControl(dao({pending_admin: "bze1next"}), walk("ACCOUNT", [DAO], "bze1person"), known());
        expect(state.pending).toMatchObject({nominee: "bze1next"});
        expect(state.pending?.text).toMatch(/bze1next is nominated as the new admin/);
        expect(state.pending?.text).toMatch(/stays in charge/);
    });

    it("a nominee that is a DAO is shown by name", () => {
        const state = describeControl(dao({pending_admin: "bze1n"}), null, known({bze1n: {id: "7", name: "Nominee DAO"}}));
        expect(state.pending?.text).toMatch(/^Nominee DAO is nominated/);
    });
});
