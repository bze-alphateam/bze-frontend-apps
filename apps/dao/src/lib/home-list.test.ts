import {describe, expect, it} from "vitest";
import {governedBy, governedByLine, mineCount, numberedCount, roleTone} from "./home-list";

describe("numberedCount", () => {
    it("says how many there are when they all fit on one page", () => {
        expect(numberedCount({page: 1, pageSize: 20, rows: 1, total: 1})).toBe("1 DAO");
        expect(numberedCount({page: 1, pageSize: 20, rows: 4, total: 4})).toBe("4 DAOs");
        expect(numberedCount({page: 1, pageSize: 20, rows: 20, total: 20})).toBe("20 DAOs");
    });

    it("gives the range of the rows the page holds", () => {
        expect(numberedCount({page: 1, pageSize: 20, rows: 20, total: 23})).toBe("1–20 of 23 DAOs");
        expect(numberedCount({page: 2, pageSize: 20, rows: 3, total: 23})).toBe("21–23 of 23 DAOs");
        expect(numberedCount({page: 1, pageSize: 20, rows: 4, total: 24})).toBe("1–4 of 24 DAOs");
        expect(numberedCount({page: 3, pageSize: 20, rows: 20, total: 1200})).toBe("41–60 of 1,200 DAOs");
    });
});

describe("the other lines", () => {
    it("counts My DAOs by its size", () => {
        expect(mineCount(1)).toBe("1 of your DAOs");
        expect(mineCount(4)).toBe("4 of your DAOs");
    });

    it("says who governs a DAO: a member list or stakers, never an admin", () => {
        expect(governedBy("static_list")).toBe("A member list");
        expect(governedBy("stake")).toBe("Stakers");
        expect(governedByLine("static_list")).toBe("Governed by a member list");
        expect(governedByLine("stake")).toBe("Governed by stakers");
    });

    it("colours Nominated amber and every other role indigo", () => {
        expect(roleTone("Nominated")).toBe("amber");
        expect((["Admin", "Member", "Staker"] as const).map(roleTone)).toEqual(["indigo", "indigo", "indigo"]);
    });
});
