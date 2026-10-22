import { describe, it, expect } from "vitest";
import { adminState, factoryCreator, ownerBadge, tokenPageAccess, tokenPageReturn, workspaceHref } from "./workspace";

const OWNER = "bze1owner";
const DENOM = `factory/${OWNER}/utok`;
const ENC = encodeURIComponent(DENOM);

describe("workspaceHref", () => {
    it("links the token page, optionally to one section", () => {
        expect(workspaceHref(DENOM)).toBe(`/tokens/token?denom=${ENC}`);
        expect(workspaceHref(DENOM, "rewards")).toBe(`/tokens/token?denom=${ENC}#rewards`);
    });

    it("gives wizards the way back without a section", () => {
        expect(tokenPageReturn({ denom: DENOM, ticker: "TOK" })).toEqual({ href: `/tokens/token?denom=${ENC}`, label: "TOK" });
    });
});

describe("tokenPageAccess", () => {
    it("opens any Factory token in the asset list", () => {
        expect(tokenPageAccess(DENOM, { denom: DENOM })).toBe("token");
        expect(tokenPageAccess("factory/bze1someoneelse/x", { denom: "factory/bze1someoneelse/x" })).toBe("token");
    });

    it("is not-found for an unknown denom and not-factory for other assets", () => {
        expect(tokenPageAccess(DENOM, undefined)).toBe("not-found");
        expect(tokenPageAccess("ubze", { denom: "ubze" })).toBe("not-factory");
        expect(tokenPageAccess("ibc/ABC", { denom: "ibc/ABC" })).toBe("not-factory");
        expect(tokenPageAccess("ulp_x_y", { denom: "ulp_x_y" })).toBe("not-factory");
    });
});

describe("factoryCreator", () => {
    it("reads the creator from the denom", () => {
        expect(factoryCreator(DENOM)).toBe(OWNER);
        expect(factoryCreator("ubze")).toBeUndefined();
        expect(factoryCreator("factory/")).toBeUndefined();
    });
});

describe("adminState", () => {
    it("never reads a failed lookup as renounced or not admin", () => {
        expect(adminState(undefined, OWNER)).toBe("unknown");
        expect(adminState("", OWNER)).toBe("renounced");
        expect(adminState(OWNER, OWNER)).toBe("admin");
        expect(adminState(OWNER, undefined)).toBe("not-admin");
        expect(adminState("bze1other", OWNER)).toBe("not-admin");
    });
});

describe("ownerBadge", () => {
    it("picks the first badge that applies", () => {
        expect(ownerBadge(DENOM, OWNER, OWNER)).toBe("Created by you · you are admin");
        expect(ownerBadge(DENOM, "", OWNER)).toBe("Created by you · admin given up");
        expect(ownerBadge(DENOM, "bze1newadmin000000000000000000000000000", OWNER)).toMatch(/^Created by you · admin is bze1ne.+/);
        expect(ownerBadge(DENOM, "bze1handed", "bze1handed")).toBe("You are admin");
    });

    it("shows none for anyone else, without a wallet, or while the admin is unknown", () => {
        expect(ownerBadge(DENOM, OWNER, "bze1other")).toBeUndefined();
        expect(ownerBadge(DENOM, OWNER, undefined)).toBeUndefined();
        expect(ownerBadge(DENOM, undefined, OWNER)).toBeUndefined();
    });
});
