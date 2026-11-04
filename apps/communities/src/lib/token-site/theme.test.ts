import {describe, expect, it} from "vitest";
import {BRANDING_TEMPLATES, type BrandingColors, type BrandingPalette, contrastRatio, DEFAULT_DENOM_BRANDING, type DenomBranding} from "@bze/bze-ui-kit";

import {dangerColor, tokenSiteSurfaces, tokenSiteVars} from "./theme";

const KIT: DenomBranding = {
    font: "space-grotesk",
    light: {background: "#FBF7F0", text: "#1E1B16", primary: "#FFD000", secondary: "#2E6E8E"},
    dark: {background: "#15161A", text: "#F1EDE4", primary: "#1A2B3C", secondary: "#E2D0D7"},
};

describe("tokenSiteVars", () => {
    it("takes the four colours of the light palette and derives the surfaces from text and background", () => {
        const vars = tokenSiteVars(KIT, "light");

        expect(vars["--ts-bg"]).toBe("#FBF7F0");
        expect(vars["--ts-fg"]).toBe("#1E1B16");
        expect(vars["--ts-pri"]).toBe("#FFD000");
        expect(vars["--ts-sec"]).toBe("#2E6E8E");
        expect(vars["--ts-muted"]).toBe("color-mix(in oklab, #1E1B16 64%, #FBF7F0)");
        expect(vars["--ts-card"]).toBe("#F1EDE6");
        expect(vars["--ts-inset"]).toBe("#ECE8E1");
        expect(vars["--ts-border"]).toBe("#E0DCD5");
        expect(vars["--ts-border-strong"]).toBe("#CECAC4");
    });

    it("switches every colour to the dark palette", () => {
        const vars = tokenSiteVars(KIT, "dark");

        expect(vars["--ts-bg"]).toBe("#15161A");
        expect(vars["--ts-fg"]).toBe("#F1EDE4");
        expect(vars["--ts-pri"]).toBe("#1A2B3C");
        expect(vars["--ts-sec"]).toBe("#E2D0D7");
        expect(vars["--ts-muted"]).toBe("color-mix(in oklab, #F1EDE4 64%, #15161A)");
    });

    it("picks black or white text for primary and secondary by contrast", () => {
        // Light: a bright yellow primary takes black, a dark blue secondary white.
        expect(tokenSiteVars(KIT, "light")["--ts-on-pri"]).toBe("#000000");
        expect(tokenSiteVars(KIT, "light")["--ts-on-sec"]).toBe("#FFFFFF");
        // Dark: the other way round.
        expect(tokenSiteVars(KIT, "dark")["--ts-on-pri"]).toBe("#FFFFFF");
        expect(tokenSiteVars(KIT, "dark")["--ts-on-sec"]).toBe("#000000");
    });

    it("fits the danger red to the background", () => {
        expect(tokenSiteVars(KIT, "light")["--ts-danger"]).toBe("#B92318");
        expect(tokenSiteVars(KIT, "dark")["--ts-danger"]).toBe("#F5524A");
    });

    it("uses the curated font with a system fallback, and only the fallback for an unknown slug", () => {
        expect(tokenSiteVars(KIT, "light")["--ts-font"]).toBe("'Space Grotesk', system-ui, sans-serif");
        expect(tokenSiteVars({...KIT, font: "papyrus"}, "light")["--ts-font"]).toBe("system-ui, sans-serif");
    });
});

// The contrast floors on the background, from the faintest surface to the strongest, and the
// least step from the card to its border.
const FLOORS = {card: 1.08, inset: 1.12, hover: 1.15, border: 1.24, line: 1.38, borderStrong: 1.44} as const;
const BORDER_ON_CARD = 1.15;
const ORDER = ["card", "inset", "hover", "border", "line", "borderStrong"] as const;

const PALETTES: { name: string; mode: BrandingPalette; colors: BrandingColors }[] = [
    ...BRANDING_TEMPLATES,
    {id: "default", branding: DEFAULT_DENOM_BRANDING},
].flatMap(({id, branding}) => (["light", "dark"] as const).map((mode) => ({name: `${id} ${mode}`, mode, colors: branding[mode]})));

describe("tokenSiteSurfaces", () => {
    it("separates card, inset, hover, border and lines from the background on every template, light and dark", () => {
        const table = PALETTES.map(({name, colors}) => {
            const s = tokenSiteSurfaces(colors);
            return {
                kit: name,
                bg: colors.background,
                card: s.card,
                "card/bg": +contrastRatio(s.card, colors.background).toFixed(3),
                border: s.border,
                "border/bg": +contrastRatio(s.border, colors.background).toFixed(3),
                "border/card": +contrastRatio(s.border, s.card).toFixed(3),
            };
        });
        console.table(table);

        for (const {name, colors} of PALETTES) {
            const s = tokenSiteSurfaces(colors);
            const onBg = (key: keyof typeof FLOORS) => contrastRatio(s[key], colors.background);
            for (const key of ORDER) {
                expect(onBg(key), `${name} ${key}`).toBeGreaterThanOrEqual(FLOORS[key]);
            }
            for (let i = 1; i < ORDER.length; i++) {
                expect(onBg(ORDER[i]), `${name} ${ORDER[i]} after ${ORDER[i - 1]}`).toBeGreaterThan(onBg(ORDER[i - 1]));
            }
            expect(contrastRatio(s.border, s.card), `${name} border/card`).toBeGreaterThanOrEqual(BORDER_ON_CARD);
        }
    });

    it("lifts the cards of a pure black kit off the background (Terminal dark painted them #000000)", () => {
        const terminal = BRANDING_TEMPLATES.find((t) => t.id === "terminal")!.branding.dark;
        const s = tokenSiteSurfaces(terminal);

        expect(terminal.background).toBe("#000000");
        expect(s.card).not.toBe("#000000");
        expect(s.border).not.toBe("#000000");
        expect(s).toEqual({card: "#0D0F0D", inset: "#111412", hover: "#151816", border: "#1B1F1C", line: "#262B28", borderStrong: "#2A302C"});
    });

    it("keeps the design shares on light kits: 4 % card, 6 % inset, 11 % border", () => {
        expect(tokenSiteSurfaces(DEFAULT_DENOM_BRANDING.light)).toEqual({card: "#F4F4F5", inset: "#EFEFF1", hover: "#E9EAEC", border: "#E1E2E5", line: "#D4D5D9", borderStrong: "#CED0D4"});
    });

    it("stays bounded when the text is almost the background", () => {
        const s = tokenSiteSurfaces({background: "#808080", text: "#818181", primary: "#000000", secondary: "#000000"});

        expect(s.card).toMatch(/^#[0-9A-F]{6}$/);
        expect(s.borderStrong).toMatch(/^#[0-9A-F]{6}$/);
    });
});

describe("dangerColor", () => {
    it("keeps the saturated red where it reads, on white and on black", () => {
        expect(dangerColor("#FFFFFF")).toBe("#DC3328");
        expect(dangerColor("#000000")).toBe("#DC3328");
    });

    it("walks darker on a light background and lighter on a dark one until it reads", () => {
        expect(dangerColor("#FBF7F0")).toBe("#B92318");
        expect(dangerColor("#FFD000")).toBe("#941B12");
        expect(dangerColor("#15161A")).toBe("#F5524A");
    });

    it("takes the best-reading red on a mid-tone background no red reaches AA on", () => {
        expect(dangerColor("#808080")).toBe("#70140D");
    });
});
