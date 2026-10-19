import { describe, expect, it } from "vitest";
import { isNavItemActive } from "./nav-active";

describe("isNavItemActive", () => {
    it("marks an item active on its own page", () => {
        expect(isNavItemActive("/assets", "/assets")).toBe(true);
        expect(isNavItemActive("/", "/")).toBe(true);
    });

    it.each([
        ["/exchange/market", "/exchange"],
        ["/pools/details", "/pools"],
        ["/assets/details", "/assets"],
    ])("marks the parent item active on %s", (pathname, parent) => {
        expect(isNavItemActive(parent, pathname)).toBe(true);
        expect(isNavItemActive("/", pathname)).toBe(false);
    });

    it("keeps every other item inactive", () => {
        expect(isNavItemActive("/pools", "/assets/details")).toBe(false);
        expect(isNavItemActive("/staking", "/assets")).toBe(false);
    });
});
