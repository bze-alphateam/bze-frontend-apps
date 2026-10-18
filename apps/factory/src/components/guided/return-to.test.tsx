import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { params } = vi.hoisted(() => ({ params: { current: new URLSearchParams() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => params.current }));

import { useReturnTo, withReturn } from "./return-to";

// Builds the page URL's query string the way a link would (the return path encoded once).
const visit = (path: string, label?: string) => {
    params.current = new URLSearchParams(
        `return=${encodeURIComponent(path)}${label !== undefined ? `&returnLabel=${encodeURIComponent(label)}` : ""}`,
    );
};
const visitRaw = (query: string) => { params.current = new URLSearchParams(query); };
const result = () => renderHook(() => useReturnTo()).result.current;

beforeEach(() => { params.current = new URLSearchParams(); });

describe("useReturnTo", () => {
    it("is undefined without a return param", () => {
        expect(result()).toBeUndefined();
    });

    it("accepts an internal path with its own encoded query", () => {
        const path = "/manage/token?denom=factory%2Fbze1abc%2Futok&tab=trading";
        visit(path, "TOK");
        expect(result()).toEqual({ href: path, label: "TOK" });
    });

    it("falls back to a generic label", () => {
        visit("/manage");
        expect(result()?.label).toBe("where you were");
    });

    it.each([
        ["protocol-relative", "//evil.com"],
        ["absolute URL", "https://x"],
        ["backslash", "/\\evil"],
        ["encoded backslash", "/%5Cevil"],
        ["encoded double slash", "/%2Fevil.com"],
        ["control character", "/\t/evil.com"],
        ["relative path", "manage"],
    ])("rejects a %s path", (_name, path) => {
        visit(path);
        expect(result()).toBeUndefined();
    });

    it("rejects a path that does not decode", () => {
        visitRaw("return=/manage%25E0%25A4%25A");
        expect(result()).toBeUndefined();
    });
});

describe("withReturn", () => {
    const back = { href: "/manage/token?denom=factory%2Fbze1abc%2Futok&tab=trading", label: "TOK" };

    it("leaves the link alone without a return path", () => {
        expect(withReturn("/pool/new?base=a", undefined)).toBe("/pool/new?base=a");
    });

    it("appends the encoded params, round-tripping through useReturnTo", () => {
        const href = withReturn("/pool/new?base=a&quote=b", back);
        expect(href.startsWith("/pool/new?base=a&quote=b&return=")).toBe(true);

        visitRaw(href.split("?")[1]);
        expect(result()).toEqual(back);
        expect(params.current.get("base")).toBe("a");
    });

    it("starts the query when the link has none", () => {
        expect(withReturn("/market/new", back)).toMatch(/^\/market\/new\?return=/);
    });
});
