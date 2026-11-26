import {describe, expect, it} from "vitest";
import {ADMINISTERED_DAO, ctxWith, DAO, STAKE_DAO, SUB_DAO} from "@/test/composer-fixtures";
import {ACTION_ENTRIES, availableActions, findAction} from "./registry";

const ids = (entries: {id: string}[]) => entries.map((e) => e.id);

describe("the action registry", () => {
    it("lists every entry once, in the order the picker shows them", () => {
        expect(ids([...ACTION_ENTRIES])).toEqual([
            "pay", "update-metadata", "update-rules", "update-members", "update-electorate",
            "nominate-admin", "withdraw-nomination", "accept-nomination", "sub-dao-admin", "sub-dao-execute", "custom",
        ]);
        expect(new Set(ids([...ACTION_ENTRIES])).size).toBe(ACTION_ENTRIES.length);
    });

    it("finds an entry by id", () => {
        expect(findAction("pay")?.label).toBe("Pay from the treasury");
        expect(findAction("nope")).toBeUndefined();
    });

    it("offers a self-owned member-list DAO pay, rename, rules, members, nominate and custom", () => {
        expect(ids(availableActions(DAO, ctxWith()))).toEqual(["pay", "update-metadata", "update-rules", "update-members", "nominate-admin", "custom"]);
    });

    it("offers a stake DAO the electorate instead of the members", () => {
        expect(ids(availableActions(STAKE_DAO, ctxWith({dao: STAKE_DAO})))).toEqual(["pay", "update-metadata", "update-rules", "update-electorate", "nominate-admin", "custom"]);
    });

    it("hides the admin handover from a DAO that has an admin: its admin hands it over", () => {
        expect(ids(availableActions(ADMINISTERED_DAO, ctxWith({dao: ADMINISTERED_DAO})))).toEqual(["pay", "update-metadata", "update-rules", "update-members", "custom"]);
    });

    it("offers the withdraw only while a nomination is pending", () => {
        const pending = {...DAO, pending_admin: "bze1someone"};
        expect(ids(availableActions(pending, ctxWith({dao: pending})))).toContain("withdraw-nomination");
        expect(ids(availableActions(DAO, ctxWith()))).not.toContain("withdraw-nomination");
    });

    it("offers the sub-DAO actions only to a DAO that administers one (or whose sub-DAOs could not be read)", () => {
        expect(ids(availableActions(DAO, ctxWith({subDaos: [SUB_DAO]})))).toEqual(expect.arrayContaining(["sub-dao-admin", "sub-dao-execute"]));
        expect(ids(availableActions(DAO, ctxWith({subDaos: []})))).not.toContain("sub-dao-admin");
        expect(ids(availableActions(DAO, ctxWith({subDaos: null})))).toContain("sub-dao-execute");
    });

    it("offers the acceptance only when a DAO nominated this one; when Scan did not answer it is skipped", () => {
        const incoming = [{id: "9", name: "Hive", address: "bze1x"}];
        expect(ids(availableActions(DAO, ctxWith({incoming})))).toContain("accept-nomination");
        expect(ids(availableActions(DAO, ctxWith({incoming: []})))).not.toContain("accept-nomination");
        expect(ids(availableActions(DAO, ctxWith({incoming: null})))).not.toContain("accept-nomination");
    });

    it("offers no data-dependent entry without the context", () => {
        expect(ids(availableActions(DAO))).toEqual(["pay", "update-metadata", "update-rules", "update-members", "nominate-admin", "custom"]);
    });
});
