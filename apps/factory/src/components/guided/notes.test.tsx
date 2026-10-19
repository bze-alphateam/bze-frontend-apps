// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { createHiveGlowSystem } from "@bze/bze-ui-kit";
import { BlockerNote, GoodNote, TipNote, WarningNote } from "./notes";

const system = createHiveGlowSystem("factory");
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={system}>{children}</ChakraProvider>;

/** The CSS rules aimed at an element's classes, from the styles Chakra injected. */
function rulesFor(el: HTMLElement): string {
    const text = Array.from(document.querySelectorAll("style")).map(s => s.textContent ?? "").join("\n");
    const inserted = Array.from(document.styleSheets).flatMap(sheet => {
        try { return Array.from(sheet.cssRules).map(rule => rule.cssText) } catch { return [] }
    });
    return [...text.split("}"), ...inserted]
        .filter(rule => Array.from(el.classList).some(cls => rule.includes(`.${cls}`)))
        .join("\n");
}

const NOTES = {
    warning: WarningNote,
    tip: TipNote,
    blocker: BlockerNote,
    good: GoodNote,
} as const;

describe("guided notes", () => {
    it.each([
        ["warning", "hg-warning"],
        ["tip", "hg-inset"],
        ["blocker", "hg-danger"],
        ["good", "hg-success"],
    ] as const)("a %s note is drawn from the %s token, never a palette name", (tone, token) => {
        const Note = NOTES[tone];
        render(<Note lead="Heads up:">The text.</Note>, { wrapper });

        const note = screen.getByTestId(`note-${tone}`);
        expect(note).toHaveAttribute("data-tone", tone);
        expect(note).toHaveTextContent("Heads up: The text.");
        const rules = rulesFor(note);
        expect(rules).toContain(`--chakra-colors-${token}`);
        expect(rules).not.toMatch(/colors-(red|orange|yellow|blue|green|gray)-/);
    });

    it("warnings are amber and tips neutral: the tip never takes the warning or danger colour", () => {
        render(<TipNote lead="Tip:">Use a short ticker.</TipNote>, { wrapper });
        const rules = rulesFor(screen.getByTestId("note-tip"));
        expect(rules).not.toContain("--chakra-colors-hg-warning");
        expect(rules).not.toContain("--chakra-colors-hg-danger");
    });

    it("only a blocker is announced as an alert", () => {
        render(
            <>
                <WarningNote lead="Heads up:">Permanent.</WarningNote>
                <TipNote lead="Tip:">Hint.</TipNote>
                <BlockerNote>This pool already exists.</BlockerNote>
            </>,
            { wrapper },
        );
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(screen.getByRole("alert")).toHaveTextContent("This pool already exists.");
    });
});
