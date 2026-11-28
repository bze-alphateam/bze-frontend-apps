import {describe, expect, it} from "vitest";
import type {DaoControllerResponse} from "@bze/bze-ui-kit";
import {describeControl, type KnownDao} from "./dao-control";

const DAO = "bze1dao";
const dao = (over: Partial<{admin: string; pending_admin: string}> = {}) => ({address: DAO, admin: "bze1person", pending_admin: "", ...over});
const known = (entries: Record<string, KnownDao> = {}) => new Map<string, KnownDao>([[DAO, {id: "1", name: "Mine"}], ...Object.entries(entries)]);
const walk = (end_reason: DaoControllerResponse["end_reason"], path: string[], controller: string): DaoControllerResponse => ({controller, end_reason, path});

describe("describeControl", () => {
    it("a self-owned DAO has no admin", () => {
        const state = describeControl(dao({admin: DAO}), walk("SELF_OWNED", [DAO], DAO), known());
        expect(state).toMatchObject({kind: "self-owned", headline: "No admin", warning: null, steps: []});
    });

    it("an account admin gets the warning that it can spend the treasury", () => {
        const state = describeControl(dao(), walk("ACCOUNT", [DAO], "bze1person"), known());
        expect(state.kind).toBe("account");
        expect(state.headline).toBe("Admin is an account");
        expect(state.warning).toMatch(/spending its treasury/);
    });

    it("an admin that is another DAO: the chain ends at its voters", () => {
        const state = describeControl(dao({admin: "bze1b"}), walk("SELF_OWNED", [DAO, "bze1b"], "bze1b"), known({bze1b: {id: "2", name: "B"}}));
        expect(state.kind).toBe("dao");
        expect(state.headline).toBe("Admin is the DAO B");
        expect(state.steps.map((s) => s.kind)).toEqual(["dao", "dao", "voters"]);
        expect(state.warning).toBeNull();
    });

    it("an admin DAO controlled by an account ends at that account, with the warning", () => {
        const state = describeControl(dao({admin: "bze1b"}), walk("ACCOUNT", [DAO, "bze1b"], "bze1boss"), known({bze1b: {id: "2", name: "B"}}));
        expect(state.steps.at(-1)).toEqual({kind: "account", address: "bze1boss"});
        expect(state.warning).toMatch(/external admin/);
    });

    it("a CYCLE walk names the DAO it loops back to and says control stays with these DAOs", () => {
        const state = describeControl(dao({admin: "bze1b"}), walk("CYCLE", [DAO, "bze1b"], DAO), known({bze1b: {id: "2", name: "B"}}));
        expect(state.note).toBe("The admin chain loops back to Mine, so control stays with these DAOs.");
        expect(state.steps.at(-1)).toEqual({kind: "loop", address: DAO, dao: {id: "1", name: "Mine"}});
    });

    it("a DEPTH_CAP walk ends on the 16th DAO", () => {
        const state = describeControl(dao({admin: "bze1b"}), walk("DEPTH_CAP", [DAO, "bze1b"], "bze1b"), known({bze1b: {id: "2", name: "B"}}));
        expect(state.note).toMatch(/16th DAO/);
        expect(state.steps.at(-1)).toMatchObject({kind: "cap", address: "bze1b"});
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

    it("an admin whose type could not be checked is neither called an account nor warned about", () => {
        const state = describeControl(dao(), null, known(), new Set(["bze1person"]));
        expect(state).toMatchObject({kind: "unknown", warning: null, headline: "Admin (could not check whether it is an account or a DAO)"});
    });

    it("a controller answer settles the admin even when the by-address lookup failed", () => {
        const state = describeControl(dao(), walk("ACCOUNT", [DAO], "bze1person"), known(), new Set(["bze1person"]));
        expect(state.kind).toBe("account");
    });
});
