import {describe, expect, it} from "vitest";
import {daoTabHref, parseDaoTab} from "./dao-tabs";

describe("daoTabHref", () => {
    it("links each tab of a DAO: the Overview has no query, Proposals and History a ?tab=, the console its route", () => {
        expect(daoTabHref("4")).toBe("/dao/4");
        expect(daoTabHref("4", "overview")).toBe("/dao/4");
        expect(daoTabHref("4", "proposals")).toBe("/dao/4?tab=proposals");
        expect(daoTabHref("4", "history")).toBe("/dao/4?tab=history");
        expect(daoTabHref("4", "admin")).toBe("/dao/4/admin");
    });
});

describe("parseDaoTab", () => {
    it("reads the tab of the URL", () => {
        expect(parseDaoTab("proposals")).toBe("proposals");
        expect(parseDaoTab("history")).toBe("history");
        expect(parseDaoTab("overview")).toBe("overview");
    });

    it("a missing or unknown tab is the Overview, the Admin console included (it is its own route)", () => {
        for (const value of [null, undefined, "", "admin", "Proposals", "rules"]) expect(parseDaoTab(value)).toBe("overview");
    });

    it("round-trips with daoTabHref", () => {
        for (const tab of ["overview", "proposals", "history"] as const) {
            const query = new URL(daoTabHref("7", tab), "https://dao.example").searchParams.get("tab");
            expect(parseDaoTab(query)).toBe(tab);
        }
    });
});
