import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { cleanup as cleanupAll, fireEvent, render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { setInLocalStorage } from "@bze/bze-ui-kit";

// The home: six starting points, work on what exists and the docs footer (BFE-260).
// It looks the same whatever is stored; the drafts in localStorage only add the slim "Continue …"
// line on top.
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return { ...actual, getDexApp: () => ({ href: "https://dex.example" }) };
});

import HomePage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<HomePage />, { wrapper });
const tile = (id: string) => screen.getByTestId(`start-${id}`);

describe("Home: What are you building today?", () => {
    beforeEach(() => { localStorage.clear(); });

    it("shows the hero with one question and no intro line", () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("What are you building today?");
        expect(screen.queryByText(/Pick a starting point/)).not.toBeInTheDocument();
    });

    it.each([
        ["token", "Create a token", "/token/new", ["Token"]],
        ["market", "Create a DEX market", "/create/market", ["Liquidity pool", "Order book"]],
        ["rewards", "Create staking rewards", "/create/rewards", ["Simple reward", "Compounded reward"]],
        ["grow", "Grow a community", "/create/grow", ["Airdrop", "Raffle"]],
    ])("the %s tile is a link to its starting point", (id, title, href, chips) => {
        renderPage();
        const link = tile(id);
        expect(link.tagName).toBe("A");
        expect(link).toHaveAttribute("href", href);
        expect(within(link).getByRole("heading", { level: 2 })).toHaveTextContent(title);
        for (const chip of chips) expect(within(link).getByText(chip)).toBeInTheDocument();
    });

    it("features Create a token with Start here", () => {
        renderPage();
        expect(within(tile("token")).getByText("Start here")).toBeInTheDocument();
        expect(screen.getAllByText("Start here")).toHaveLength(1);
    });

    it.each([["dao", "Create a DAO"], ["contest", "Create a trading contest"]])("the %s tile is Coming soon and not a link", (id, title) => {
        renderPage();
        const t = tile(id);
        expect(t.tagName).not.toBe("A");
        expect(t.closest("a")).toBeNull();
        expect(within(t).queryByRole("link")).not.toBeInTheDocument();
        expect(within(t).getByText("Coming soon")).toBeInTheDocument();
        expect(within(t).getByRole("heading", { level: 2 })).toHaveTextContent(title);
    });

    it("lists the six tiles in grid order", () => {
        renderPage();
        const tiles = within(screen.getByRole("region", { name: "Starting points" })).getAllByTestId(/^start-/);
        expect(tiles.map(t => t.getAttribute("data-testid"))).toEqual(["start-token", "start-market", "start-rewards", "start-grow", "start-dao", "start-contest"]);
    });

    it("offers work on what exists: rewards, tokens and liquidity on the DEX", () => {
        renderPage();
        const row = within(screen.getByRole("region", { name: "Work on something that exists" }));
        expect(row.queryByText(/You don't have to be the one who created it/)).not.toBeInTheDocument();
        expect(row.getByRole("link", { name: /Extend or fund a reward/ })).toHaveAttribute("href", "/rewards");
        expect(row.getByRole("link", { name: /Manage a token/ })).toHaveAttribute("href", "/tokens");
        expect(row.getByText("Mint, edit details, logo, permissions. Admins only, checked live.")).toBeInTheDocument();
        const dex = row.getByTestId("app-link");
        expect(dex).toHaveAttribute("data-app", "dex");
        expect(dex).toHaveAttribute("href", "https://dex.example/pools");
    });

    it("ends on the docs link, in a new tab", () => {
        renderPage();
        const docs = screen.getByRole("link", { name: /Guides and strategies on docs\.getbze\.com/ });
        expect(docs).toHaveAttribute("href", "https://docs.getbze.com");
        expect(docs).toHaveAttribute("target", "_blank");
    });

    it("has no How it works section and no chain promise in the footer", () => {
        const { container } = renderPage();
        expect(screen.queryByRole("region", { name: "How it works" })).not.toBeInTheDocument();
        expect(screen.queryByText(/How it works/)).not.toBeInTheDocument();
        expect(container.querySelector("footer")).not.toHaveTextContent("Everything here reads straight");
        expect(screen.queryByText(/Everything here reads straight/)).not.toBeInTheDocument();
    });

    it("has no goal search, playbooks or tools list any more", () => {
        renderPage();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(screen.queryByText(/Playbook/i)).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "All tools" })).not.toBeInTheDocument();
    });
});

const DAY = 24 * 60 * 60;
const tokenDraft = (symbol: string, answered: string[]) =>
    setInLocalStorage("factory_launch_draft", JSON.stringify({ form: { symbol }, answered }), 30 * DAY);
const multisendDraft = (denom: string) =>
    setInLocalStorage("factory_multisend_draft", JSON.stringify({ denom, mode: "same", sameAmount: "1", text: "bze1a" }), 30 * DAY);
const hint = () => screen.queryByRole("complementary", { name: "Continue where you left off" });

/** Everything on the page but the hint, as markup (React's generated ids aside). */
const layout = () => {
    const { container, unmount } = renderPage();
    container.querySelector('[data-testid="continue-hint"]')?.remove();
    const html = container.innerHTML.replace(/:r[0-9a-z]+:|«r[0-9a-z]+»|_r_[0-9a-z]+_/g, "id");
    unmount();
    return html;
};

describe("Home with stored progress", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    });
    afterEach(() => { vi.useRealTimers(); });

    it("keeps the same cards in the same order with or without drafts", () => {
        const empty = layout();
        tokenDraft("BEE", ["details", "supply"]);
        multisendDraft("ubee");
        setInLocalStorage("factory_multisend_run", JSON.stringify({ fingerprint: "f", denom: "ubee", batches: [{ id: 1, count: 1, total: "1", status: "pending" }], startedAt: 1 }), 30 * DAY);
        renderPage();
        expect(hint()).toBeInTheDocument();
        cleanupAll();
        expect(layout()).toBe(empty);
    });

    it("shows no hint without drafts, or when no wizard has a finished step", () => {
        renderPage();
        expect(hint()).not.toBeInTheDocument();
        cleanupAll();
        tokenDraft("BEE", []);
        multisendDraft("");
        renderPage();
        expect(hint()).not.toBeInTheDocument();
    });

    it("points to the most recent wizard with a finished step", () => {
        tokenDraft("BEE", ["details"]);
        vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
        multisendDraft("ubee");
        vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
        renderPage();
        const line = within(hint()!);
        expect(line.getByRole("link", { name: "Continue your airdrop to a list of wallets" })).toHaveAttribute("href", "/airdrop?to=list");
        expect(hint()).toHaveTextContent("step 3 of 4");
        cleanupAll();

        vi.setSystemTime(new Date("2026-10-04T10:00:00Z"));
        tokenDraft("BEE", ["details"]);
        renderPage();
        expect(within(hint()!).getByRole("link", { name: "Continue creating BEE" })).toHaveAttribute("href", "/token/new");
        expect(hint()).toHaveTextContent("step 2 of 4");
    });

    it("hides the hint once dismissed, until the wizard saves new progress", () => {
        tokenDraft("BEE", ["details"]);
        renderPage();
        fireEvent.click(within(hint()!).getByRole("button", { name: "Dismiss" }));
        expect(hint()).not.toBeInTheDocument();
        cleanupAll();
        renderPage();
        expect(hint()).not.toBeInTheDocument();
        cleanupAll();

        vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));
        tokenDraft("BEE", ["details", "supply"]);
        renderPage();
        expect(hint()).toHaveTextContent("step 3 of 4");
    });
});
