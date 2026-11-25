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
        ["an admin of a mintable token", "bze1owner", true, "Mintable", "warning"],
        ["an admin who turned minting off", "bze1owner", false, "Fixed supply", "success"],
        ["a renounced admin", "", false, "Fixed supply", "success"],
        ["an unknown admin", undefined, undefined, "Admin unknown", "neutral"],
    ] as const)("%s reads %s in the %s tone", (_, admin, mintable, label, tone) => {
        render(<TrustBadge admin={admin} mintable={mintable} />, { wrapper });
        const pill = screen.getByTestId("status-pill");
        expect(pill).toHaveTextContent(label);
        expect(pill).toHaveAttribute("data-tone", tone);
    });

    it.each([
        ["bze1owner", true, "hg-warning-text"],
        ["", false, "hg-success-text"],
        [undefined, undefined, "hg-text-secondary"],
    ] as const)("admin %j takes its text colour from the %s token, never a palette name", (admin, mintable, token) => {
        render(<TrustBadge admin={admin} mintable={mintable} />, { wrapper });
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
