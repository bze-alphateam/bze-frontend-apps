import {describe, expect, it, vi} from "vitest";
import type {Dao, DaoControllerResponse} from "@bze/bze-ui-kit";
import {isNominationStale, type NominatedDao, type NominationChain} from "./nomination";

// DAO 4 is run by DAO 9, which is run by DAO 12, which is run by an account.
const dao = (over: Partial<NominatedDao> = {}): NominatedDao => ({id: "4", address: "bze1dao4", admin: "bze1dao9", pending_admin: "bze1nominee", pending_admin_seq: "5", ...over});
const link = (id: string, adminSeq: string) => ({id, address: `bze1dao${id}`, name: `Dao ${id}`, admin_seq: adminSeq}) as Dao;

const chain = (path: string[], links: Record<string, Dao | null> = {}, over: Partial<NominationChain> = {}): NominationChain => ({
    getController: vi.fn(async (): Promise<DaoControllerResponse | null> => ({controller: "bze1person", end_reason: "ACCOUNT", path})),
    getDaoByAddress: vi.fn(async (address: string) => links[address] ?? null),
    ...over,
});

const NOT_STALE = {stale: false, checked: true};
const UNCHECKED = {stale: false, checked: false};

describe("isNominationStale", () => {
    it("is not stale while no DAO above changed its admin after the nomination", async () => {
        const c = chain(["bze1dao4", "bze1dao9", "bze1dao12"], {bze1dao9: link("9", "5"), bze1dao12: link("12", "1")});
        // 5 is not above the nomination's 5: only a change made after it counts
        expect(await isNominationStale(c, dao())).toEqual(NOT_STALE);
        expect(c.getController).toHaveBeenCalledWith("4");
    });

    it("is stale one level up: the DAO that runs it changed its admin, and it is the one to nominate again", async () => {
        const c = chain(["bze1dao4", "bze1dao9"], {bze1dao9: link("9", "6")});
        expect(await isNominationStale(c, dao())).toEqual({stale: true, parent: {id: "9", name: "Dao 9"}, changed: {id: "9", name: "Dao 9"}});
    });

    it("is stale two levels up: the change is above the parent, the parent still has to nominate again", async () => {
        const c = chain(["bze1dao4", "bze1dao9", "bze1dao12"], {bze1dao9: link("9", "2"), bze1dao12: link("12", "6")});
        expect(await isNominationStale(c, dao())).toEqual({stale: true, parent: {id: "9", name: "Dao 9"}, changed: {id: "12", name: "Dao 12"}});
    });

    it("a cycle in the admin chain (DAO 9 is run by DAO 4): each DAO above is compared once", async () => {
        const cycle = (adminSeq: string) => chain(["bze1dao4", "bze1dao9"], {bze1dao9: link("9", adminSeq)}, {
            getController: vi.fn(async (): Promise<DaoControllerResponse | null> => ({controller: "bze1dao4", end_reason: "CYCLE", path: ["bze1dao4", "bze1dao9"]})),
        });
        const fresh = cycle("3");
        expect(await isNominationStale(fresh, dao())).toEqual(NOT_STALE);
        expect(fresh.getDaoByAddress).toHaveBeenCalledTimes(1);
        expect(await isNominationStale(cycle("8"), dao())).toEqual({stale: true, parent: {id: "9", name: "Dao 9"}, changed: {id: "9", name: "Dao 9"}});
    });

    it("the depth cap (16 DAOs on the path): every DAO the chain walked is compared, the last one included", async () => {
        const path = Array.from({length: 16}, (_, i) => (i === 0 ? "bze1dao4" : `bze1dao${100 + i}`));
        const links = Object.fromEntries(path.slice(1).map((address, i) => [address, link(String(101 + i), "1")]));
        const capped = (lastSeq: string) => chain(path, {...links, bze1dao115: link("115", lastSeq)}, {
            getController: vi.fn(async (): Promise<DaoControllerResponse | null> => ({controller: "bze1dao4", end_reason: "DEPTH_CAP", path})),
        });
        const fresh = capped("1");
        expect(await isNominationStale(fresh, dao())).toEqual(NOT_STALE);
        expect(fresh.getDaoByAddress).toHaveBeenCalledTimes(15);
        expect(await isNominationStale(capped("6"), dao())).toEqual({stale: true, parent: {id: "101", name: "Dao 101"}, changed: {id: "115", name: "Dao 115"}});
    });

    it("compares the sequences as numbers, not as text, beyond what a double holds", async () => {
        const one = (adminSeq: string, pendingSeq: string) => isNominationStale(chain(["bze1dao4", "bze1dao9"], {bze1dao9: link("9", adminSeq)}), dao({pending_admin_seq: pendingSeq}));
        expect(await one("10", "9")).toMatchObject({stale: true});
        expect(await one("9", "10")).toEqual(NOT_STALE);
        expect(await one("18446744073709551615", "18446744073709551614")).toMatchObject({stale: true});
    });

    it("never counts the DAO itself: its own admin change clears the nomination, so it cannot go stale that way", async () => {
        const c = chain(["bze1dao4", "bze1dao9"], {bze1dao4: link("4", "99"), bze1dao9: link("9", "0")});
        expect(await isNominationStale(c, dao())).toEqual(NOT_STALE);
        expect(c.getDaoByAddress).toHaveBeenCalledTimes(1);
        expect(c.getDaoByAddress).toHaveBeenCalledWith("bze1dao9");
    });

    it("a DAO whose admin is an account is never stale: the admin chain ends at the DAO", async () => {
        const c = chain(["bze1dao4"]);
        expect(await isNominationStale(c, dao({admin: "bze1person"}))).toEqual(NOT_STALE);
        expect(c.getDaoByAddress).not.toHaveBeenCalled();
    });

    it("a self-owned DAO, or one with no nomination, is never stale, and nothing is read", async () => {
        const c = chain(["bze1dao4"]);
        expect(await isNominationStale(c, dao({admin: "bze1dao4"}))).toEqual(NOT_STALE);
        expect(await isNominationStale(c, dao({pending_admin: ""}))).toEqual(NOT_STALE);
        expect(c.getController).not.toHaveBeenCalled();
    });

    it.each([
        ["the controller read throws", chain([], {}, {getController: vi.fn(async () => { throw new Error("rest"); })})],
        ["the chain has no controller answer (404)", chain([], {}, {getController: vi.fn(async () => null)})],
        ["the path is empty", chain([])],
        ["a DAO above throws", chain(["bze1dao4", "bze1dao9"], {}, {getDaoByAddress: vi.fn(async () => { throw new Error("rest"); })})],
        ["a DAO above is not found", chain(["bze1dao4", "bze1dao9"], {bze1dao9: null})],
        ["a DAO above has no readable sequence", chain(["bze1dao4", "bze1dao9"], {bze1dao9: link("9", "x")})],
    ])("%s: the chain read failed, so it is not stale and not checked (never throws)", async (_name, c) => {
        expect(await isNominationStale(c, dao())).toEqual(UNCHECKED);
    });

    it("a nomination whose own sequence is not a number cannot be checked, and nothing is read", async () => {
        const c = chain(["bze1dao4", "bze1dao9"]);
        expect(await isNominationStale(c, dao({pending_admin_seq: ""}))).toEqual(UNCHECKED);
        expect(c.getController).not.toHaveBeenCalled();
    });
});
