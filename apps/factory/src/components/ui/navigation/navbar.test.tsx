import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";

const m = vi.hoisted(() => ({ path: "/" }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: vi.fn(), currentPathName: m.path }) }));
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    AppsMenu: () => null,
    useWalletButtonLabel: () => "Connect",
    WalletSidebarContent: () => null,
    SettingsToggle: () => null,
}));

import { createHiveGlowSystem } from "@bze/bze-ui-kit";
import { PendingTxProvider, PendingTxStore, createPendingTxStore } from "@/contexts/pending-tx";
import { TopNavBar } from "./navbar";

const system = createHiveGlowSystem("factory");

let store: PendingTxStore;
function memoryStore(): PendingTxStore {
    let value: string | null = null;
    return createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
}
const renderNav = () => render(
    <ChakraProvider value={system}><PendingTxProvider store={store}><TopNavBar /></PendingTxProvider></ChakraProvider>,
);

const CREATE = ["/", "/token/new", "/market/new", "/pool/new", "/pool/add", "/reward/new", "/multisend", "/reach", "/playbooks", "/raffle/new"];
const MANAGE = ["/manage", "/manage/token", "/rewards", "/denom-reward/token", "/denom-reward/schedule", "/denom-reward/airdrop", "/official"];

// The desktop nav's links (the logo links home too).
const active = () => within(screen.getAllByRole("navigation", { name: "Main" })[0]).getAllByRole("link").filter(l => l.getAttribute("aria-current") === "page").map(l => l.textContent);

beforeEach(() => {
    m.path = "/";
    store = memoryStore();
});

describe("TopNavBar", () => {
    it.each(CREATE)("%s lights up Create", (path) => {
        m.path = path;
        renderNav();
        expect(active()).toEqual(["Create"]);
    });

    it.each(MANAGE)("%s lights up Manage", (path) => {
        m.path = path;
        renderNav();
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

    it("shows the in-progress pill on the item owning a pending wizard, leading back to it", () => {
        m.path = "/manage";
        store.add({ href: "/token/new?return=%2Fmanage", hash: "H1", title: "Create token HONEY", startedAt: Date.now() });
        renderNav();

        const nav = within(screen.getAllByRole("navigation", { name: "Main" })[0]);
        expect(nav.getByLabelText("1 transaction in progress")).toBeInTheDocument();
        expect(nav.getByRole("link", { name: /Create/ })).toHaveAttribute("href", "/token/new?return=%2Fmanage");
        expect(nav.getByRole("link", { name: /Manage/ })).toHaveAttribute("href", "/manage");
    });

    it("drops the pill once the result is known", () => {
        store.add({ href: "/token/new", hash: "H1", title: "Create token HONEY", startedAt: Date.now() });
        store.resolve("H1", { status: "confirmed", height: 5 });
        renderNav();

        expect(screen.queryByLabelText(/in progress/)).not.toBeInTheDocument();
    });
});
