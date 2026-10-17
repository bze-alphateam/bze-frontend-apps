import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ currentPathName: pathnameMock(), navigate: vi.fn() }),
}));
vi.mock("@bze/bze-ui-kit", () => ({
    getEcosystemApps: () => [],
}));

import { NavbarLinks } from "./navbar-links";

function renderLinks(pathname: string) {
    pathnameMock.mockReturnValue(pathname);
    return render(<NavbarLinks />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => pathnameMock.mockReset());

describe("NavbarLinks", () => {
    it("links to Governance", () => {
        renderLinks("/");

        expect(screen.getByRole("link", { name: "Governance" })).toHaveAttribute("href", "/governance");
        expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: "Governance" })).not.toHaveAttribute("aria-current");
    });

    it.each(["/governance", "/governance/48"])("marks Governance active on %s", (path) => {
        renderLinks(path);

        expect(screen.getByRole("link", { name: "Governance" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    });

    it("does not match a path that only starts with the same letters", () => {
        renderLinks("/governanceship");

        expect(screen.getByRole("link", { name: "Governance" })).not.toHaveAttribute("aria-current");
    });
});
