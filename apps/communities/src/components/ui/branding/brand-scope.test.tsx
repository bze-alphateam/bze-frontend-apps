import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {DenomBranding} from "@bze/bze-ui-kit";

const useColorMode = vi.fn();
vi.mock("@/components/ui/color-mode", () => ({
    useColorMode: () => useColorMode(),
}));

import {BrandScope} from "./brand-scope";

const KIT: DenomBranding = {
    font: "montserrat",
    light: {background: "#FAFAFA", text: "#101010", primary: "#AA0000", secondary: "#00AA00"},
    dark: {background: "#050505", text: "#F0F0F0", primary: "#FF5555", secondary: "#55FF55"},
};

function renderScope(kit: DenomBranding | null | undefined) {
    return render(
        <ChakraProvider value={defaultSystem}>
            <BrandScope kit={kit}><p>token page</p></BrandScope>
        </ChakraProvider>,
    );
}

// React hoists stylesheets into <head> and dedupes them for the whole document, so tests compare
// the links before and after a render instead of cleaning <head>.
const fontLinks = () => Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]'));

beforeEach(() => {
    useColorMode.mockReset();
});

describe("BrandScope", () => {
    it("sets the light palette in light mode", () => {
        useColorMode.mockReturnValue({colorMode: "light"});
        renderScope(KIT);

        const scope = screen.getByTestId("brand-scope");
        expect(scope.style.getPropertyValue("--brand-bg")).toBe("#FAFAFA");
        expect(scope.style.getPropertyValue("--brand-primary")).toBe("#AA0000");
        expect(screen.getByText("token page")).toBeInTheDocument();
    });

    it("re-resolves to the dark palette when the mode switches", () => {
        useColorMode.mockReturnValue({colorMode: "light"});
        const {rerender} = renderScope(KIT);

        useColorMode.mockReturnValue({colorMode: "dark"});
        rerender(
            <ChakraProvider value={defaultSystem}>
                <BrandScope kit={KIT}><p>token page</p></BrandScope>
            </ChakraProvider>,
        );

        const scope = screen.getByTestId("brand-scope");
        expect(scope.style.getPropertyValue("--brand-bg")).toBe("#050505");
        expect(scope.style.getPropertyValue("--brand-text")).toBe("#F0F0F0");
    });

    it("loads the stylesheet of a curated font", () => {
        useColorMode.mockReturnValue({colorMode: "light"});
        renderScope({...KIT, font: "jetbrains-mono"});

        const hrefs = fontLinks().map(l => l.getAttribute("href"));
        expect(hrefs.filter(h => h?.includes("family=JetBrains+Mono"))).toHaveLength(1);
    });

    it("loads no stylesheet for a font outside the curated list", () => {
        useColorMode.mockReturnValue({colorMode: "light"});
        const before = fontLinks().length;
        renderScope({...KIT, font: "papyrus"});

        expect(screen.getByTestId("brand-scope").style.getPropertyValue("--brand-bg")).toBe("#FAFAFA");
        expect(fontLinks()).toHaveLength(before);
    });

    it.each([null, undefined])("renders the children untouched without a kit (%s)", (kit) => {
        useColorMode.mockReturnValue({colorMode: "light"});
        const before = fontLinks().length;
        renderScope(kit);

        expect(screen.queryByTestId("brand-scope")).not.toBeInTheDocument();
        expect(screen.getByText("token page")).toBeInTheDocument();
        expect(fontLinks()).toHaveLength(before);
    });

    it("waits for the colour mode before applying a kit", () => {
        useColorMode.mockReturnValue({colorMode: undefined});
        renderScope(KIT);

        expect(screen.queryByTestId("brand-scope")).not.toBeInTheDocument();
    });
});
