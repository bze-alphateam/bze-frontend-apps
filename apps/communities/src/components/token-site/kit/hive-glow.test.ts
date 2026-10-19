import {describe, expect, it} from "vitest";
import {type BrandingColors, DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";

import {darken, GLOW_PRIMARY, GLOW_SECONDARY, tokenSiteGlow, tokenSiteGlowVars} from "./hive-glow";

// A dark kit whose blue primary is too dark to read as a word on its background.
const DARK_BLUE: BrandingColors = {background: "#0A0F24", text: "#EEF1FB", primary: "#3B5FD0", secondary: "#9AA8D6"};

describe("darken", () => {
    it("scales every channel down", () => {
        expect(darken("#FBBF24", 0.25)).toBe("#BC8F1B");
        expect(darken("#be1981", 0.25)).toBe("#8F1361");
        expect(darken("#FFFFFF", 0)).toBe("#FFFFFF");
        expect(darken("#FFFFFF", 1)).toBe("#000000");
    });
});

describe("tokenSiteGlow", () => {
    it("runs the default kit's gradient from its primary to the primary 25 % darker, never to the secondary", () => {
        const {dark} = DEFAULT_DENOM_BRANDING;
        const glow = tokenSiteGlow(dark);

        expect(glow.primaryDark).toBe("#BC8F1B");
        expect(glow.gradient).toBe("linear-gradient(135deg, #FBBF24, #BC8F1B)");
        expect(glow.gradient).not.toContain(dark.secondary);
    });

    it("keeps the hero word on the plain gradient when the primary reads on the background", () => {
        const glow = tokenSiteGlow(DEFAULT_DENOM_BRANDING.dark);

        expect(glow.heroGradient).toBe(glow.gradient);
    });

    it("starts a dark kit's hero word from a light tint of the primary, so the name stays readable", () => {
        const glow = tokenSiteGlow(DARK_BLUE);

        expect(glow.gradient).toBe("linear-gradient(135deg, #3B5FD0, #2C479C)");
        expect(glow.heroGradient).toBe("linear-gradient(135deg, color-mix(in oklab, #3B5FD0 70%, #EEF1FB), #3B5FD0)");
    });

    it("glows with the primary at 18 % and the secondary at 10 %", () => {
        const glow = tokenSiteGlow(DEFAULT_DENOM_BRANDING.dark);

        expect(GLOW_PRIMARY).toBe(18);
        expect(GLOW_SECONDARY).toBe(10);
        expect(glow.glow).toContain("color-mix(in oklab, #FBBF24 18%, transparent)");
        expect(glow.glow).toContain("color-mix(in oklab, #9CA3AF 10%, transparent)");
        expect(glow.glow).toMatch(/^radial-gradient\(/);
    });
});

describe("tokenSiteGlowVars", () => {
    it("exposes the gradient, hero word, glow and inset as --ts-* variables", () => {
        const vars = tokenSiteGlowVars(DEFAULT_DENOM_BRANDING.dark);

        expect(vars).toEqual({
            "--ts-pri2": "#BC8F1B",
            "--ts-gradient": "linear-gradient(135deg, #FBBF24, #BC8F1B)",
            "--ts-hero-gradient": "linear-gradient(135deg, #FBBF24, #BC8F1B)",
            "--ts-glow": tokenSiteGlow(DEFAULT_DENOM_BRANDING.dark).glow,
            "--ts-inset": "color-mix(in oklab, #F9FAFB 6%, #111827)",
        });
    });
});
