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

const CREATE = ["/", "/create/market", "/create/rewards", "/create/grow", "/token/new", "/market/new", "/pool/new", "/pool/add", "/reward/new", "/multisend", "/reach", "/raffle/new"];
const TOKENS = ["/tokens", "/tokens/token", "/official"];
const REWARDS = ["/rewards", "/reward/extend", "/denom-reward/token", "/denom-reward/schedule", "/denom-reward/airdrop"];

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

    it.each(TOKENS)("%s lights up Tokens", (path) => {
        m.path = path;
        renderNav();
        expect(active()).toEqual(["Tokens"]);
    });

    it.each(REWARDS)("%s lights up Rewards", (path) => {
        m.path = path;
        renderNav();
        expect(active()).toEqual(["Rewards"]);
    });

    it("shows Create · Tokens · Rewards, in that order", () => {
        renderNav();
        const nav = within(screen.getAllByRole("navigation", { name: "Main" })[0]);
        expect(nav.getAllByRole("link").map(l => l.textContent).filter(t => ["Create", "Tokens", "Rewards"].includes(t ?? ""))).toEqual(["Create", "Tokens", "Rewards"]);
        expect(nav.getByRole("link", { name: "Tokens" })).toHaveAttribute("href", "/tokens");
        expect(nav.getByRole("link", { name: "Rewards" })).toHaveAttribute("href", "/rewards");
    });

    it("every page of the app is in one of the three lists", () => {
        const appDir = join(__dirname, "../../../app");
        const routes = readdirSync(appDir, { recursive: true, encoding: "utf8" })
            .filter(f => f.endsWith(`${sep}page.tsx`) || f === "page.tsx")
            .map(f => `/${relative(".", f).split(sep).slice(0, -1).join("/")}`);
        expect(routes.length).toBeGreaterThan(10);
        expect([...routes].sort()).toEqual([...CREATE, ...TOKENS, ...REWARDS].sort());
    });

    it("shows the in-progress pill on the item owning a pending wizard, leading back to it", () => {
        m.path = "/tokens";
        store.add({ href: "/token/new?return=%2Ftokens", hash: "H1", title: "Create token HONEY", startedAt: Date.now() });
        renderNav();

        const nav = within(screen.getAllByRole("navigation", { name: "Main" })[0]);
        expect(nav.getByLabelText("1 transaction in progress")).toBeInTheDocument();
        expect(nav.getByRole("link", { name: /Create/ })).toHaveAttribute("href", "/token/new?return=%2Ftokens");
        expect(nav.getByRole("link", { name: /Tokens/ })).toHaveAttribute("href", "/tokens");
    });

    it("drops the pill once the result is known", () => {
        store.add({ href: "/token/new", hash: "H1", title: "Create token HONEY", startedAt: Date.now() });
        store.resolve("H1", { status: "confirmed", height: 5 });
        renderNav();

        expect(screen.queryByLabelText(/in progress/)).not.toBeInTheDocument();
    });
});
