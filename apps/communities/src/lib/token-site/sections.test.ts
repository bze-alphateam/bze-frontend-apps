import {describe, expect, it} from "vitest";

import {siteSections} from "./sections";

const DENOM = "factory/bze1owner/upage";
const ENCODED = "factory%2Fbze1owner%2Fupage";

describe("siteSections", () => {
    it("puts Activity between Burn and Token, Earn and Trade only when they exist", () => {
        expect(siteSections({denom: DENOM, hasEarn: true, hasTrade: true, page: "main"}).map((s) => s.label))
            .toEqual(["Stake", "Earn", "Trade", "Burn", "Activity", "Token"]);
        expect(siteSections({denom: DENOM, hasEarn: false, hasTrade: false, page: "main"}).map((s) => s.label))
            .toEqual(["Stake", "Burn", "Activity", "Token"]);
    });

    it("scrolls to the sections on the token page, Activity to the snippet", () => {
        const sections = siteSections({denom: DENOM, hasEarn: false, hasTrade: false, page: "main"});

        expect(sections.every((s) => s.href === undefined)).toBe(true);
        expect(sections.find((s) => s.label === "Activity")?.id).toBe("activity");
    });

    it("links back to the token page from an inner page, Activity to its own page", () => {
        const sections = siteSections({denom: DENOM, hasEarn: false, hasTrade: false, page: "inner"});

        expect(sections.map((s) => s.href)).toEqual([
            `/token?denom=${ENCODED}#stake`,
            `/token?denom=${ENCODED}#burn`,
            `/token/activity?denom=${ENCODED}`,
            `/token?denom=${ENCODED}#details`,
        ]);
    });
});
