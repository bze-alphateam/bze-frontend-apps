import { describe, it, expect } from "vitest";
import { checkLogo, logoPasses, MAX_READ_BYTES } from "./logo-check";

// Tiny logos built in the test: a PNG is its signature plus an IHDR header (padded to a size),
// an SVG is plain text.
const png = (width: number, height: number, size = 64) => {
    const bytes = new Uint8Array(Math.max(size, 33));
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(bytes.buffer).setUint32(16, width);
    new DataView(bytes.buffer).setUint32(20, height);
    return bytes;
};
const text = (s: string) => new TextEncoder().encode(s);
const svg = (attrs: string, body = '<circle cx="5" cy="5" r="4"/>') => text(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`);
const paths = (n: number) => '<path d="M0 0h1"/>'.repeat(n);

const byKey = (result: ReturnType<typeof checkLogo>, key: string) => result.checks.find(c => c.key === key);

describe("checkLogo: PNG", () => {
    it("a square 512 × 512 PNG passes", () => {
        const result = checkLogo(png(512, 512), "honey.png", "HONEY");
        expect(result).toMatchObject({ format: "png", width: 512, height: 512, suggestedFileName: "honey.png" });
        expect(result.checks.map(c => c.key)).toEqual(["format", "size", "square", "name"]);
        expect(byKey(result, "square")).toEqual({ key: "square", ok: true, message: "Square, 512 × 512" });
        expect(byKey(result, "size")?.message).toBe("1 KB (under 250 KB)");
        expect(logoPasses(result)).toBe(true);
    });

    it("a non-square PNG fails", () => {
        const result = checkLogo(png(512, 256), "honey.png", "HONEY");
        expect(byKey(result, "square")).toEqual({ key: "square", ok: false, message: "Not square: 512 × 256" });
        expect(logoPasses(result)).toBe(false);
    });

    it("a PNG over 250 KB fails the size check", () => {
        const result = checkLogo(png(64, 64, 300 * 1024), "honey.png", "HONEY");
        expect(byKey(result, "size")).toEqual({ key: "size", ok: false, message: "300 KB, over the 250 KB limit" });
        expect(logoPasses(result)).toBe(false);
    });

    it("a file bigger than what was read fails on its real size", () => {
        const result = checkLogo(png(64, 64), "honey.png", "HONEY", 3 * 1024 * 1024);
        expect(byKey(result, "size")?.message).toBe("3072 KB, over the 250 KB limit");
    });
});

describe("checkLogo: not PNG or SVG", () => {
    it("JPEG bytes named .png get the renamed-JPG message", () => {
        const result = checkLogo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]), "honey.png", "HONEY");
        expect(result.format).toBeUndefined();
        expect(byKey(result, "format")).toEqual({
            key: "format", ok: false, message: "This is a JPG, renamed to .png. The registry only takes PNG or SVG.",
        });
        expect(logoPasses(result)).toBe(false);
    });

    it("a plain JPG", () => {
        const result = checkLogo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "honey.jpg", "HONEY");
        expect(byKey(result, "format")?.message).toBe("This is a JPG. The registry only takes PNG or SVG.");
    });

    it("anything else", () => {
        const result = checkLogo(text("GIF89a"), "honey.gif", "HONEY");
        expect(byKey(result, "format")?.message).toBe("Only PNG or SVG files work.");
    });
});

describe("checkLogo: SVG", () => {
    it("a square viewBox passes", () => {
        const result = checkLogo(svg('viewBox="0 0 100 100"'), "honey.svg", "HONEY");
        expect(result).toMatchObject({ format: "svg", width: 100, height: 100, suggestedFileName: "honey.svg" });
        expect(byKey(result, "format")?.message).toBe("SVG, preferred");
        expect(byKey(result, "square")?.message).toBe("Square, 100 × 100");
        expect(byKey(result, "shapes")?.message).toBe("1 shape (under 1,000)");
        expect(byKey(result, "picture")).toMatchObject({ ok: true });
        expect(logoPasses(result)).toBe(true);
    });

    it("falls back to width and height", () => {
        expect(byKey(checkLogo(svg('width="64" height="32"'), "honey.svg", "HONEY"), "square")?.message).toBe("Not square: 64 × 32");
    });

    it("without a size it warns but passes", () => {
        const result = checkLogo(svg(""), "honey.svg", "HONEY");
        expect(byKey(result, "square")).toEqual({ key: "square", ok: true, warn: true, message: "Can't tell if it's square. Make sure it is." });
        expect(logoPasses(result)).toBe(true);
    });

    it("1,000 shapes fail, 999 pass", () => {
        const many = checkLogo(svg('viewBox="0 0 1 1"', paths(1000)), "honey.svg", "HONEY");
        expect(byKey(many, "shapes")).toEqual({ key: "shapes", ok: false, message: "Too detailed: 1,000 shapes, the registry allows under 1,000" });
        expect(logoPasses(many)).toBe(false);
        const enough = checkLogo(svg('viewBox="0 0 1 1"', paths(999)), "honey.svg", "HONEY");
        expect(byKey(enough, "shapes")).toMatchObject({ ok: true, message: "999 shapes (under 1,000)" });
    });

    it.each([
        ['<image href="data:image/png;base64,iVBORw0KGgo="/>'],
        ['<image xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="data:image/jpeg;base64,/9j/"/>'],
    ])("an SVG wrapping a picture fails: %s", (body) => {
        const result = checkLogo(svg('viewBox="0 0 10 10"', body), "honey.svg", "HONEY");
        expect(byKey(result, "picture")).toEqual({
            key: "picture", ok: false, message: "This SVG only wraps a picture. Use the PNG instead, or real vector art.",
        });
        expect(logoPasses(result)).toBe(false);
    });

    it("an unreadable SVG", () => {
        const result = checkLogo(text('<svg xmlns="http://www.w3.org/2000/svg"><path></svg>'), "honey.svg", "HONEY");
        expect(result.format).toBeUndefined();
        expect(byKey(result, "format")).toEqual({ key: "format", ok: false, message: "This SVG can't be read" });
    });

    it("an SVG too big to read is not parsed, only failed on size", () => {
        const result = checkLogo(text('<svg xmlns="http://www.w3.org/2000/svg">'), "honey.svg", "HONEY", MAX_READ_BYTES + 1);
        expect(result.checks.map(c => c.key)).toEqual(["format", "size"]);
        expect(logoPasses(result)).toBe(false);
    });
});

describe("checkLogo: file name", () => {
    it("an upper-case name warns with the suggested one", () => {
        const result = checkLogo(svg('viewBox="0 0 1 1"'), "Honey Logo.svg", "HONEY");
        expect(byKey(result, "name")).toEqual({ key: "name", ok: true, warn: true, message: "Name it honey.svg when you upload it" });
        expect(logoPasses(result)).toBe(true);
    });

    it("the suggested name is ok", () => {
        expect(byKey(checkLogo(png(8, 8), "honey.png", "HONEY"), "name")).toEqual({ key: "name", ok: true, message: "File name honey.png" });
    });
});
