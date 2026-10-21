import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { rulesFor } from "@/test-support/css-rules";
import { SwapLayoutSwitcher } from "./swap-layout-switcher";
import type { SwapLayout, SwapLayoutStore } from "./swap-layout";

function fakeStore(initial = "centered") {
    return {
        get: vi.fn(() => initial as SwapLayout),
        set: vi.fn<(layout: SwapLayout) => void>(),
    } satisfies SwapLayoutStore;
}

function renderSwitcher(store: SwapLayoutStore) {
    return render(<SwapLayoutSwitcher store={store} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const radio = (name: string) => screen.getByRole("radio", { name });
const ALIGNED = "Layout: aligned bands";
const CENTERED = "Layout: swap centre stage";
const SPLIT = "Layout: swap left, activity right";

const htmlLayout = () => document.documentElement.getAttribute("data-swap-layout");

afterEach(() => {
    delete document.documentElement.dataset.swapLayout;
});

describe("SwapLayoutSwitcher", () => {
    it("is a labelled radio group with B checked by default", () => {
        renderSwitcher(fakeStore());
        expect(screen.getByRole("radiogroup", { name: "Swap page layout" })).toBeInTheDocument();
        expect(radio(CENTERED)).toHaveAttribute("aria-checked", "true");
        expect(radio(ALIGNED)).toHaveAttribute("aria-checked", "false");
        expect(radio(SPLIT)).toHaveAttribute("aria-checked", "false");
    });

    it("gives every option its label as a tooltip", () => {
        renderSwitcher(fakeStore());
        for (const name of [ALIGNED, CENTERED, SPLIT]) {
            expect(radio(name)).toHaveAttribute("title", name);
        }
    });

    it("checks the stored layout", () => {
        renderSwitcher(fakeStore("split"));
        expect(radio(SPLIT)).toHaveAttribute("aria-checked", "true");
        expect(radio(CENTERED)).toHaveAttribute("aria-checked", "false");
    });

    it("shows B for an invalid value from the store", () => {
        renderSwitcher(fakeStore("wide"));
        expect(radio(CENTERED)).toHaveAttribute("aria-checked", "true");
    });

    it.each([
        [ALIGNED, "aligned"],
        [SPLIT, "split"],
    ])("stores %s and sets it on <html>", (name, layout) => {
        const store = fakeStore();
        renderSwitcher(store);
        fireEvent.click(radio(name));
        expect(store.set).toHaveBeenCalledWith(layout);
        expect(htmlLayout()).toBe(layout);
        expect(radio(name)).toHaveAttribute("aria-checked", "true");
        expect(radio(CENTERED)).toHaveAttribute("aria-checked", "false");
    });

    it("removes the <html> attribute when B is picked", () => {
        const store = fakeStore("aligned");
        document.documentElement.dataset.swapLayout = "aligned";
        renderSwitcher(store);
        fireEvent.click(radio(CENTERED));
        expect(store.set).toHaveBeenCalledWith("centered");
        expect(document.documentElement.hasAttribute("data-swap-layout")).toBe(false);
        expect(radio(CENTERED)).toHaveAttribute("aria-checked", "true");
    });

    it("is hidden below lg", () => {
        renderSwitcher(fakeStore());
        const css = rulesFor(screen.getByRole("radiogroup"));
        expect(css).toMatch(/max-width:[^{]*\{[^}]*display:\s*none/);
    });
});
