import {describe, expect, it} from "vitest";
import type {DenomBranding} from "@bze/bze-ui-kit";

import {dangerColor, tokenSiteVars} from "./theme";

const KIT: DenomBranding = {
    font: "space-grotesk",
    light: {background: "#FBF7F0", text: "#1E1B16", primary: "#FFD000", secondary: "#2E6E8E"},
    dark: {background: "#15161A", text: "#F1EDE4", primary: "#1A2B3C", secondary: "#E2D0D7"},
};

describe("tokenSiteVars", () => {
    it("takes the four colours of the light palette and derives the tints from text and background", () => {
        const vars = tokenSiteVars(KIT, "light");

        expect(vars["--ts-bg"]).toBe("#FBF7F0");
        expect(vars["--ts-fg"]).toBe("#1E1B16");
        expect(vars["--ts-pri"]).toBe("#FFD000");
        expect(vars["--ts-sec"]).toBe("#2E6E8E");
        expect(vars["--ts-muted"]).toBe("color-mix(in oklab, #1E1B16 64%, #FBF7F0)");
        expect(vars["--ts-card"]).toBe("color-mix(in oklab, #1E1B16 4%, #FBF7F0)");
        expect(vars["--ts-border"]).toBe("color-mix(in oklab, #1E1B16 11%, #FBF7F0)");
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
