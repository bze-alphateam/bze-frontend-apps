// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { createHiveGlowSystem } from "@bze/bze-ui-kit";
import { TrustBadge } from "./trust-badge";

const system = createHiveGlowSystem("factory");
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={system}>{children}</ChakraProvider>;

describe("TrustBadge", () => {
    it.each([
        ["an active admin", "bze1owner", "Mintable", "warning"],
        ["a renounced admin", "", "Fixed supply", "success"],
        ["an unknown admin", undefined, "Control unknown", "neutral"],
    ] as const)("%s reads %s in the %s tone", (_, admin, label, tone) => {
        render(<TrustBadge admin={admin} />, { wrapper });
        const pill = screen.getByTestId("status-pill");
        expect(pill).toHaveTextContent(label);
        expect(pill).toHaveAttribute("data-tone", tone);
    });

    it.each([
        ["bze1owner", "hg-warning-text"],
        ["", "hg-success-text"],
        [undefined, "hg-text-secondary"],
    ] as const)("admin %j takes its text colour from the %s token, never a palette name", (admin, token) => {
        render(<TrustBadge admin={admin} />, { wrapper });
        const pill = screen.getByTestId("status-pill");
        // The page's CSS, written as text or through insertRule, cut into rules; keep the ones aimed at the pill's classes.
        const text = Array.from(document.querySelectorAll("style")).map(el => el.textContent ?? "").join("\n");
        const inserted = Array.from(document.styleSheets).flatMap(sheet => {
            try { return Array.from(sheet.cssRules).map(rule => rule.cssText) } catch { return [] }
        });
        const rules = [...text.split("}"), ...inserted]
            .filter(rule => Array.from(pill.classList).some(cls => rule.includes(`.${cls}`)))
            .join("\n");
        expect(rules).toContain(`--chakra-colors-${token}`);
        expect(rules).not.toMatch(/colors-(orange|green|gray|yellow)-/);
    });
});
