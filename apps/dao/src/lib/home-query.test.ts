import {describe, expect, it} from "vitest";
import {buildHomeQuery, parseHomeQuery, searchTerm, type HomeQuery} from "./home-query";

describe("parseHomeQuery", () => {
    it("is the first page of every DAO without a filter when the URL has nothing", () => {
        expect(parseHomeQuery("", true)).toEqual({page: 1, kind: "", q: "", mine: false});
    });

    it("reads the page, the type, the search and My DAOs", () => {
        expect(parseHomeQuery("?page=3&type=stake&q=club&mine=1", true)).toEqual({page: 3, kind: "stake", q: "club", mine: true});
        expect(parseHomeQuery(new URLSearchParams("type=static_list"), false).kind).toBe("static_list");
    });

    it("ignores a page that is not a positive integer", () => {
        for (const page of ["0", "-2", "1.5", "abc", "", "2e3", " 4", "0x10", "2147483649", "99999999999999999999"]) {
            expect(parseHomeQuery(`page=${encodeURIComponent(page)}`, true).page).toBe(1);
        }
        expect(parseHomeQuery("page=2147483648", true).page).toBe(2147483648);
    });

    it("ignores an unknown type", () => {
        expect(parseHomeQuery("type=dao", true).kind).toBe("");
        expect(parseHomeQuery("type=STAKE", true).kind).toBe("");
    });

    it("applies My DAOs only with a wallet connected, and only as mine=1", () => {
        expect(parseHomeQuery("mine=1", false).mine).toBe(false);
        expect(parseHomeQuery("mine=1", true).mine).toBe(true);
        for (const value of ["0", "true", "yes", ""]) expect(parseHomeQuery(`mine=${value}`, true).mine).toBe(false);
    });
});

describe("buildHomeQuery", () => {
    const base: HomeQuery = {page: 1, kind: "", q: "", mine: false};

    it("leaves out everything that is the default", () => {
        expect(buildHomeQuery(base, true)).toBe("");
    });

    it("writes what is set, the page only from the second", () => {
        expect(buildHomeQuery({page: 2, kind: "stake", q: "club", mine: true}, true)).toBe("?mine=1&type=stake&q=club&page=2");
        expect(buildHomeQuery({...base, page: 1, kind: "static_list"}, true)).toBe("?type=static_list");
    });

    it("trims the search and leaves out a blank one", () => {
        expect(buildHomeQuery({...base, q: "  club "}, true)).toBe("?q=club");
        expect(buildHomeQuery({...base, q: "   "}, true)).toBe("");
        expect(buildHomeQuery({...base, q: "a b&c"}, true)).toBe("?q=a+b%26c");
    });

    it("drops My DAOs without a wallet", () => {
        expect(buildHomeQuery({...base, mine: true, kind: "stake"}, false)).toBe("?type=stake");
    });

    it("round-trips through the parser", () => {
        for (const query of [
            base,
            {page: 4, kind: "stake" as const, q: "hive club", mine: false},
            {page: 1, kind: "static_list" as const, q: "x&y=z", mine: true},
        ]) {
            expect(parseHomeQuery(buildHomeQuery(query, true), true)).toEqual(query);
        }
    });
});

describe("searchTerm", () => {
    it("is the trimmed text from two characters on, and empty before", () => {
        expect(searchTerm(" club ")).toBe("club");
        expect(searchTerm("ab")).toBe("ab");
        expect(searchTerm(" a ")).toBe("");
        expect(searchTerm("")).toBe("");
    });
});
