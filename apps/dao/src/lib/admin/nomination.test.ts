import {describe, expect, it, vi} from "vitest";
import type {Dao, DaoControllerResponse} from "@bze/bze-ui-kit";
import {checkNomination, type NominationChain} from "./nomination";

type Link = Pick<Dao, "id" | "address" | "name" | "admin_seq" | "pending_admin_seq">;
const dao = (over: Partial<Link> = {}): Link => ({id: "4", address: "bze1dao4", name: "Four", admin_seq: "3", pending_admin_seq: "5", ...over});
const link = (id: string, adminSeq: string) => ({id, address: `bze1dao${id}`, name: `Dao ${id}`, admin_seq: adminSeq}) as Dao;

const chain = (path: string[], links: Record<string, Dao | null> = {}, over: Partial<NominationChain> = {}): NominationChain => ({
    getController: vi.fn(async (): Promise<DaoControllerResponse | null> => ({controller: "bze1person", end_reason: "ACCOUNT", path})),
    getDaoByAddress: vi.fn(async (address: string) => links[address] ?? null),
    ...over,
});

describe("checkNomination", () => {
    it("is fresh while no DAO on the admin chain changed its admin after the nomination", async () => {
        const c = chain(["bze1dao4", "bze1dao9"], {bze1dao9: link("9", "5")});
        // 5 is not above the nomination's 5: only a change made after it counts
        expect(await checkNomination(c, dao())).toEqual({state: "fresh"});
        expect(c.getController).toHaveBeenCalledWith("4");
    });

    it("is stale when a controlling DAO changed hands after the nomination", async () => {
        const c = chain(["bze1dao4", "bze1dao9", "bze1dao12"], {bze1dao9: link("9", "2"), bze1dao12: link("12", "6")});
        expect(await checkNomination(c, dao())).toEqual({state: "stale", by: {id: "12", name: "Dao 12"}});
    });

    it("counts the DAO itself, and compares the numbers as numbers, not as text", async () => {
        expect(await checkNomination(chain(["bze1dao4"]), dao({admin_seq: "6"}))).toMatchObject({state: "stale", by: {id: "4"}});
        // "10" is above "9" as a number, though it sorts below it as text
        expect(await checkNomination(chain(["bze1dao4"]), dao({admin_seq: "10", pending_admin_seq: "9"}))).toMatchObject({state: "stale"});
        expect(await checkNomination(chain(["bze1dao4"]), dao({admin_seq: "9", pending_admin_seq: "10"}))).toEqual({state: "fresh"});
        // beyond what a double holds
        expect(await checkNomination(chain(["bze1dao4"]), dao({admin_seq: "18446744073709551615", pending_admin_seq: "18446744073709551614"}))).toMatchObject({state: "stale"});
    });

    it("takes the DAO itself from the record it was given, and asks the chain for the others", async () => {
        const c = chain(["bze1dao4", "bze1dao9"], {bze1dao9: link("9", "0")});
        await checkNomination(c, dao());
        expect(c.getDaoByAddress).toHaveBeenCalledTimes(1);
        expect(c.getDaoByAddress).toHaveBeenCalledWith("bze1dao9");
    });

    it.each([
        ["the controller read throws", chain([], {}, {getController: vi.fn(async () => { throw new Error("rest"); })})],
        ["the chain has no controller answer (404)", chain([], {}, {getController: vi.fn(async () => null)})],
        ["the path is empty", chain([])],
        ["a DAO on the path throws", chain(["bze1dao4", "bze1dao9"], {}, {getDaoByAddress: vi.fn(async () => { throw new Error("rest"); })})],
        ["a DAO on the path is not found", chain(["bze1dao4", "bze1dao9"], {bze1dao9: null})],
        ["a DAO on the path has no readable sequence", chain(["bze1dao4", "bze1dao9"], {bze1dao9: link("9", "x")})],
    ])("%s: it cannot be checked, which is never read as fresh", async (_name, c) => {
        expect(await checkNomination(c, dao())).toMatchObject({state: "unreadable"});
    });

    it("a nomination whose own sequence is not a number cannot be checked", async () => {
        const c = chain(["bze1dao4"]);
        expect(await checkNomination(c, dao({pending_admin_seq: ""}))).toMatchObject({state: "unreadable"});
        expect(c.getController).not.toHaveBeenCalled();
    });
});
