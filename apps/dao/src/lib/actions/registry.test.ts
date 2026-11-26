import {describe, expect, it} from "vitest";
import {DAO, STAKE_DAO} from "@/test/composer-fixtures";
import {ACTION_ENTRIES, availableActions, findAction} from "./registry";

describe("the action registry", () => {
    it("lists the launch entries with unique ids", () => {
        expect(ACTION_ENTRIES.map((e) => e.id)).toEqual(["pay", "custom"]);
        expect(new Set(ACTION_ENTRIES.map((e) => e.id)).size).toBe(ACTION_ENTRIES.length);
    });

    it("finds an entry by id", () => {
        expect(findAction("pay")?.label).toBe("Pay from the treasury");
        expect(findAction("nope")).toBeUndefined();
    });

    it("offers both entries to a member-list and a stake DAO", () => {
        expect(availableActions(DAO)).toHaveLength(2);
        expect(availableActions(STAKE_DAO)).toHaveLength(2);
    });
});
