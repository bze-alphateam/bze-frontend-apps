import {describe, expect, it} from "vitest";
import {historyHref, parseHistoryPage, parseProposalsQuery, proposalsHref} from "./dao-tab-query";

describe("the Proposals tab's URL", () => {
    it("reads the status and the page next to tab=proposals", () => {
        expect(parseProposalsQuery("tab=proposals&status=active&page=2")).toEqual({filter: "active", page: 2});
    });

    it("ignores an unknown status and an unusable page", () => {
        expect(parseProposalsQuery("tab=proposals&status=voting&page=0")).toEqual({filter: "all", page: 1});
        expect(parseProposalsQuery(new URLSearchParams("page=abc"))).toEqual({filter: "all", page: 1});
    });

    it("writes tab=proposals first and leaves out All and page 1", () => {
        expect(proposalsHref("4", {filter: "active", page: 2})).toBe("/dao/4?tab=proposals&status=active&page=2");
        expect(proposalsHref("4", {filter: "passed", page: 1})).toBe("/dao/4?tab=proposals&status=passed");
        expect(proposalsHref("4", {filter: "all", page: 3})).toBe("/dao/4?tab=proposals&page=3");
        expect(proposalsHref("4", {filter: "all", page: 1})).toBe("/dao/4?tab=proposals");
    });

    it("round-trips", () => {
        const query = {filter: "cancelled" as const, page: 7};
        expect(parseProposalsQuery(proposalsHref("4", query).split("?")[1])).toEqual(query);
    });
});

describe("the History tab's URL", () => {
    it("reads and writes the page next to tab=history", () => {
        expect(parseHistoryPage("tab=history&page=3")).toBe(3);
        expect(parseHistoryPage("tab=history")).toBe(1);
        expect(historyHref("2", 3)).toBe("/dao/2?tab=history&page=3");
        expect(historyHref("2", 1)).toBe("/dao/2?tab=history");
    });
});
