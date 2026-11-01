import { describe, it, expect, beforeEach } from "vitest";
import {
    AFTER_MERGE_COPY,
    BEEZEE_APPS_READ_LIVE_REGISTRY,
    buildRegistryEntry,
    isHttpsUrl,
    isRegistryPrUrl,
    loadOfficialProgress,
    officialHref,
    registryAssetListUrl,
    registryEntryJson,
    saveOfficialProgress,
    suggestLogoFileName,
    linksSummary,
    logoSummary,
    prSummary,
} from "./registry-entry";

// The VDL token as the chain holds it (bank metadata, with the alias the Factory sets).
const VDL_BASE = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum";
const VDL = {
    description: "Vidulum app token",
    denom_units: [
        { denom: VDL_BASE, exponent: 0, aliases: ["vidulum"] },
        { denom: "VDL", exponent: 6, aliases: [] },
    ],
    base: VDL_BASE,
    display: "VDL",
    name: "Vidulum",
    symbol: "VDL",
};
const IMAGE = "https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/vdl.svg";

beforeEach(() => localStorage.clear());

describe("buildRegistryEntry", () => {
    it("matches the registry's factory entry shape, in its key order, without aliases", () => {
        const entry = buildRegistryEntry(VDL, { format: "svg", fileName: "vdl.svg" });
        expect(Object.keys(entry)).toEqual([
            "description", "denom_units", "base", "name", "display", "symbol", "logo_URIs", "images", "type_asset",
        ]);
        expect(entry).toEqual({
            description: "Vidulum app token",
            denom_units: [{ denom: VDL_BASE, exponent: 0 }, { denom: "VDL", exponent: 6 }],
            base: VDL_BASE,
            name: "Vidulum",
            display: "VDL",
            symbol: "VDL",
            logo_URIs: { svg: IMAGE },
            images: [{ svg: IMAGE }],
            type_asset: "sdk.coin",
        });
    });

    it("pretty-prints with two spaces", () => {
        const json = registryEntryJson(VDL, { format: "png", fileName: "vdl.png" });
        expect(json.split("\n").slice(0, 5)).toEqual([
            "{",
            '  "description": "Vidulum app token",',
            '  "denom_units": [',
            "    {",
            `      "denom": "${VDL_BASE}",`,
        ]);
        expect(json).toContain('"png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/vdl.png"');
    });

    it("takes the display exponent from the metadata", () => {
        const meta = { ...VDL, denom_units: [{ denom: VDL_BASE, exponent: 0 }, { denom: "VDL", exponent: 8 }] };
        expect(buildRegistryEntry(meta, { format: "svg", fileName: "vdl.svg" }).denom_units[1]).toEqual({ denom: "VDL", exponent: 8 });
    });

    it("adds socials last, only the ones given", () => {
        expect(buildRegistryEntry(VDL, { format: "svg", fileName: "vdl.svg", socials: { website: " ", x: "" } })).not.toHaveProperty("socials");
        const entry = buildRegistryEntry(VDL, { format: "svg", fileName: "vdl.svg", socials: { x: "https://x.com/vidulum" } });
        expect(Object.keys(entry).at(-1)).toBe("socials");
        expect(entry.socials).toEqual({ x: "https://x.com/vidulum" });
    });
});

describe("links and names", () => {
    it("points at the beezee asset list and the guide", () => {
        expect(registryAssetListUrl()).toBe("https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/assetlist.json");
        expect(officialHref(VDL_BASE)).toBe(`/official?denom=${encodeURIComponent(VDL_BASE)}`);
    });

    it.each([
        ["https://github.com/cosmos/chain-registry/pull/1234", true],
        [" https://github.com/cosmos/chain-registry/pull/7 ", true],
        ["https://github.com/cosmos/chain-registry/pull/1234/files", false],
        ["https://github.com/someone/chain-registry/pull/1234", false],
        ["http://github.com/cosmos/chain-registry/pull/1234", false],
        ["https://github.com/cosmos/chain-registry/pulls", false],
    ])("PR link %s → %s", (url, ok) => {
        expect(isRegistryPrUrl(url)).toBe(ok);
    });

    it.each([
        ["https://vidulum.app", true],
        ["https://x.com/vidulum", true],
        ["http://vidulum.app", false],
        ["vidulum.app", false],
        ["https://localhost", false],
    ])("social link %s → %s", (url, ok) => {
        expect(isHttpsUrl(url)).toBe(ok);
    });

    it("suggests a lower-case file name", () => {
        expect(suggestLogoFileName("VDL", "svg")).toBe("vdl.svg");
        expect(suggestLogoFileName("My Coin", "png")).toBe("mycoin.png");
    });
});

describe("after-merge copy", () => {
    it("says BeeZee apps follow the live registry (BFE-329)", () => {
        expect(BEEZEE_APPS_READ_LIVE_REGISTRY).toBe(true);
        expect(AFTER_MERGE_COPY).toContain("BeeZee apps show the logo within about an hour.");
        expect(AFTER_MERGE_COPY).toContain("Other wallets follow when they update their lists.");
    });
});

describe("progress", () => {
    it("is stored and restored per token", () => {
        saveOfficialProgress("factory/a/one", { format: "png", fileName: "one.png", done: ["logo"] });
        saveOfficialProgress("factory/a/two", { prUrl: "https://github.com/cosmos/chain-registry/pull/1", done: ["logo", "submit"] });
        expect(loadOfficialProgress("factory/a/one")).toEqual({ format: "png", fileName: "one.png", done: ["logo"] });
        expect(loadOfficialProgress("factory/a/two").done).toEqual(["logo", "submit"]);
        expect(loadOfficialProgress("factory/a/three")).toEqual({ done: [] });
    });

    it("drops unknown steps and survives a broken entry", () => {
        saveOfficialProgress("factory/a/one", { done: ["logo", "nope" as never] });
        expect(loadOfficialProgress("factory/a/one").done).toEqual(["logo"]);
    });
});

describe("the guide's step summaries (BFE-274)", () => {
    it("logo: the name, size and file size that were saved", () => {
        expect(logoSummary({ fileName: "honey.png", width: 512, height: 512, bytes: 86_000 })).toBe("honey.png · 512×512 · 84 KB ✓");
        expect(logoSummary({ fileName: "honey.svg" })).toBe("honey.svg ✓");
    });

    it("links: the ones given, or Skipped", () => {
        expect(linksSummary({ website: "https://a.example", x: "https://x.com/a" })).toBe("Website, X");
        expect(linksSummary({ x: "https://x.com/a" })).toBe("X");
        expect(linksSummary(undefined)).toBe("Skipped");
    });

    it("submit: the PR number", () => {
        expect(prSummary("https://github.com/cosmos/chain-registry/pull/1234")).toBe("PR #1234 opened");
        expect(prSummary(undefined)).toBe("");
    });
});
