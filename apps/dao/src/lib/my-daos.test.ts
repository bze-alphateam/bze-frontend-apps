import {describe, expect, it} from "vitest";
import type {DaoCard} from "./dao-types";
import {buildMyDaos} from "./my-daos";

const card = (id: number, over: Partial<DaoCard> = {}): DaoCard => ({
    id: String(id), name: `Dao ${id}`, kind: "static_list", address: `bze1dao${id}`, admin: "bze1other", selfOwned: false,
    createdAt: null, proposalsOpen: null, ...over,
});

describe("buildMyDaos", () => {
    it("lists a DAO that is both administered and joined once, with both labels in a fixed order", () => {
        const rows = buildMyDaos({admin: [card(1)], nominated: [], member: [card(1)], staker: []});
        expect(rows).toHaveLength(1);
        expect(rows[0].reasons).toEqual(["Admin", "Member"]);
    });

    it("labels each source and sorts the newest DAO first", () => {
        const rows = buildMyDaos({admin: [card(2)], nominated: [card(5)], member: [card(7)], staker: [card(4)]});
        expect(rows.map((r) => [r.dao.id, r.reasons])).toEqual([["7", ["Member"]], ["5", ["Nominated"]], ["4", ["Staker"]], ["2", ["Admin"]]]);
    });

    it("never labels a self-owned DAO as administered", () => {
        expect(buildMyDaos({admin: [card(1, {selfOwned: true})], nominated: [], member: [], staker: []})).toEqual([]);
        expect(buildMyDaos({admin: [card(1, {selfOwned: true})], nominated: [], member: [card(1, {selfOwned: true})], staker: []})[0].reasons).toEqual(["Member"]);
    });

    it("takes Scan's card, which has the open count, over the chain's", () => {
        const rows = buildMyDaos({admin: [card(1)], nominated: [], member: [card(1, {proposalsOpen: 3})], staker: []});
        expect(rows[0].dao.proposalsOpen).toBe(3);
    });

    it("labels a nomination, between the admin and the member labels", () => {
        const rows = buildMyDaos({admin: [], nominated: [card(3)], member: [card(3)], staker: [card(3)]});
        expect(rows[0].reasons).toEqual(["Nominated", "Member", "Staker"]);
    });

    it("is empty without any list", () => {
        expect(buildMyDaos({admin: [], nominated: [], member: [], staker: []})).toEqual([]);
    });
});
