import {describe, expect, it} from "vitest";
import {linkify, safeHttpUrl} from "./dao-text";

describe("safeHttpUrl", () => {
    it.each([
        ["https://getbze.com/a?b=1", "https://getbze.com/a?b=1"],
        ["http://example.org", "http://example.org"],
        ["javascript:alert(1)", ""],
        ["data:text/html,x", ""],
        ["//evil.com", ""],
        ["/relative", ""],
        ["https://a.com/<script>", ""],
        ["https://a.com/ b", ""],
    ])("%s", (input, expected) => expect(safeHttpUrl(input)).toBe(expected));
});

describe("linkify", () => {
    it("keeps plain text and line breaks as text", () => {
        expect(linkify("a\nb")).toEqual([{kind: "text", text: "a\nb"}]);
    });

    it("turns a URL into a link and keeps the punctuation after it out of the link", () => {
        expect(linkify("see https://getbze.com/docs, ok")).toEqual([
            {kind: "text", text: "see "},
            {kind: "link", text: "https://getbze.com/docs", href: "https://getbze.com/docs"},
            {kind: "text", text: ", ok"},
        ]);
    });

    it("never makes a link of markup or a script scheme", () => {
        const segments = linkify('<a href="javascript:alert(1)">x</a> javascript:alert(2)');
        expect(segments.every((s) => s.kind === "text")).toBe(true);
    });
});
