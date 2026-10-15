import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

const m = vi.hoisted(() => ({ path: "/" }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: vi.fn(), currentPathName: m.path }) }));
vi.mock("@bze/bze-ui-kit", () => ({ getEcosystemApps: () => [] }));

import { NavbarLinks } from "./navbar-links";

const CREATE = ["/", "/token/new", "/market/new", "/pool/new", "/pool/add", "/reward/new", "/multisend", "/reach", "/playbooks", "/raffle/new"];
const MANAGE = ["/manage", "/manage/token", "/rewards", "/denom-reward/token", "/denom-reward/schedule", "/denom-reward/airdrop", "/official"];

const active = () => screen.getAllByRole("link").filter(l => l.getAttribute("aria-current") === "page").map(l => l.textContent);

beforeEach(() => {
    m.path = "/";
});

describe("NavbarLinks", () => {
    it.each(CREATE)("%s lights up Create", (path) => {
        m.path = path;
        render(<ChakraProvider value={defaultSystem}><NavbarLinks /></ChakraProvider>);
        expect(active()).toEqual(["Create"]);
    });

    it.each(MANAGE)("%s lights up Manage", (path) => {
        m.path = path;
        render(<ChakraProvider value={defaultSystem}><NavbarLinks /></ChakraProvider>);
        expect(active()).toEqual(["Manage"]);
    });

    it("every page of the app is in one of the two lists", () => {
        const appDir = join(__dirname, "../../../app");
        const routes = readdirSync(appDir, { recursive: true, encoding: "utf8" })
            .filter(f => f.endsWith(`${sep}page.tsx`) || f === "page.tsx")
            .map(f => `/${relative(".", f).split(sep).slice(0, -1).join("/")}`);
        expect(routes.length).toBeGreaterThan(10);
        expect([...routes].sort()).toEqual([...CREATE, ...MANAGE].sort());
    });
});
