import {describe, it, expect, vi} from "vitest";
import type {DenomBranding} from "@bze/bze-ui-kit";

import {brandCssVars, brandFontStylesheetUrl, contrastText, createBrandKitCache, resolveBrandFont} from "./brand-kit";

const KIT: DenomBranding = {
    font: "poppins",
    light: {background: "#FFFFFF", text: "#111111", primary: "#FFD000", secondary: "#334455"},
    dark: {background: "#000000", text: "#EEEEEE", primary: "#1A2B3C", secondary: "#AABBCC"},
};

describe("resolveBrandFont", () => {
    it("returns the curated font of a known slug", () => {
        expect(resolveBrandFont("space-grotesk")?.label).toBe("Space Grotesk");
    });

    it("returns undefined for a slug outside the curated list", () => {
        expect(resolveBrandFont("comic-sans")).toBeUndefined();
    });

    it("builds a stylesheet for that one family only", () => {
        const url = brandFontStylesheetUrl(resolveBrandFont("space-grotesk")!);
        expect(url).toContain("family=Space+Grotesk");
        expect(url).toContain("display=swap");
        expect(url.match(/family=/g)).toHaveLength(1);
    });
});

describe("contrastText", () => {
    it("picks black on light colours and white on dark ones", () => {
        expect(contrastText("#FFD000")).toBe("#000000");
        expect(contrastText("#1A2B3C")).toBe("#FFFFFF");
    });
});

describe("brandCssVars", () => {
    it("maps the light palette onto the brand and Chakra variables", () => {
        const vars = brandCssVars(KIT, "light");
        expect(vars["--brand-bg"]).toBe("#FFFFFF");
        expect(vars["--brand-text"]).toBe("#111111");
        expect(vars["--brand-primary"]).toBe("#FFD000");
        expect(vars["--brand-secondary"]).toBe("#334455");
        expect(vars["--chakra-colors-bg-subtle"]).toBe("#FFFFFF");
        expect(vars["--chakra-colors-fg"]).toBe("#111111");
        expect(vars["--chakra-colors-green-solid"]).toBe("#FFD000");
        expect(vars["--chakra-colors-color-palette-solid"]).toBe("#FFD000");
        expect(vars["--chakra-colors-green-contrast"]).toBe("#000000");
    });

    it("maps the dark palette in dark mode", () => {
        const vars = brandCssVars(KIT, "dark");
        expect(vars["--brand-bg"]).toBe("#000000");
        expect(vars["--brand-primary"]).toBe("#1A2B3C");
        expect(vars["--chakra-colors-green-contrast"]).toBe("#FFFFFF");
    });

    it("sets the font only for a curated slug", () => {
        expect(brandCssVars(KIT, "light")["--chakra-fonts-body"]).toBe("'Poppins', sans-serif");
        expect(brandCssVars({...KIT, font: "papyrus"}, "light")["--chakra-fonts-body"]).toBeUndefined();
    });
});

describe("createBrandKitCache", () => {
    it("reuses a kit within the TTL and refetches after it", async () => {
        let now = 0;
        const fetchKit = vi.fn().mockResolvedValue(KIT);
        const cache = createBrandKitCache(fetchKit, 1000, () => now);

        expect(await cache.get("factory/a/u")).toBe(KIT);
        now = 999;
        expect(cache.peek("factory/a/u")).toBe(KIT);
        expect(await cache.get("factory/a/u")).toBe(KIT);
        expect(fetchKit).toHaveBeenCalledTimes(1);

        now = 1000;
        expect(cache.peek("factory/a/u")).toBeUndefined();
        await cache.get("factory/a/u");
        expect(fetchKit).toHaveBeenCalledTimes(2);
    });

    it("caches a token without a kit as null", async () => {
        const fetchKit = vi.fn().mockResolvedValue(null);
        const cache = createBrandKitCache(fetchKit, 1000, () => 0);

        expect(await cache.get("factory/a/u")).toBeNull();
        expect(cache.peek("factory/a/u")).toBeNull();
    });

    it("fails open to null on an error and retries next time", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const fetchKit = vi.fn().mockRejectedValueOnce(new Error("501")).mockResolvedValueOnce(KIT);
        const cache = createBrandKitCache(fetchKit, 1000, () => 0);

        expect(await cache.get("factory/a/u")).toBeNull();
        expect(cache.peek("factory/a/u")).toBeUndefined();
        expect(await cache.get("factory/a/u")).toBe(KIT);
    });
});
