import {describe, expect, it} from "vitest";
import {clampPage, cursorCount, pageCount, pageItems, parsePageParam, rangeCount, slicePage} from "./pagination";

describe("pageCount", () => {
    it("rounds up, and is 0 for nothing", () => {
        expect([0, 1, 20, 21, 40, 41].map((n) => pageCount(n, 20))).toEqual([0, 1, 1, 2, 2, 3]);
    });
});

describe("pageItems", () => {
    it("is one page for a list that fits", () => {
        expect(pageItems(1, 1)).toEqual([1]);
    });

    it("lists every page up to seven", () => {
        expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
        expect(pageItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("keeps the first, the last and the current page with its neighbours, with a gap for each run left out", () => {
        expect(pageItems(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
        expect(pageItems(1, 12)).toEqual([1, 2, "gap", 12]);
        expect(pageItems(2, 12)).toEqual([1, 2, 3, "gap", 12]);
        expect(pageItems(3, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
        expect(pageItems(12, 12)).toEqual([1, "gap", 11, 12]);
        expect(pageItems(10, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
    });
});

describe("slicePage", () => {
    it("cuts the page out of a list, the last one short", () => {
        const rows = Array.from({length: 45}, (_, i) => i + 1);
        expect(slicePage(rows, 1, 20)).toHaveLength(20);
        expect(slicePage(rows, 2, 20)[0]).toBe(21);
        expect(slicePage(rows, 3, 20)).toEqual([41, 42, 43, 44, 45]);
        expect(slicePage(rows, 4, 20)).toEqual([]);
    });
});

describe("clampPage", () => {
    it("holds a page within the pages there are", () => {
        expect([clampPage(0, 4), clampPage(9, 4), clampPage(3, 4), clampPage(5, 0)]).toEqual([1, 4, 3, 1]);
    });
});

describe("parsePageParam", () => {
    it("is a positive integer up to 2^31, else 1", () => {
        expect(["3", "1", null, "", "0", "-2", "1.5", "abc", String(2 ** 31 + 1)].map(parsePageParam)).toEqual([3, 1, 1, 1, 1, 1, 1, 1, 1]);
    });
});

describe("rangeCount", () => {
    it("names its own rows: the range on a numbered page, the plain count when it fits on one", () => {
        expect(rangeCount({page: 2, pageSize: 20, rows: 3, total: 23, one: "proposal", many: "proposals"})).toBe("21–23 of 23 proposals");
        expect(rangeCount({page: 1, pageSize: 20, rows: 1, total: 1, one: "event", many: "events"})).toBe("1 event");
        expect(rangeCount({page: 1, pageSize: 20, rows: 18, total: 18, one: "proposal", many: "proposals"})).toBe("18 proposals");
    });
});

describe("cursorCount", () => {
    it("counts a list without a total by its page", () => {
        expect(cursorCount(2)).toBe("Page 2");
    });
});
