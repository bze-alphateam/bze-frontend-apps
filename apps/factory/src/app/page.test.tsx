import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The disconnected home (BFE-260): six starting points, work on what exists, how it works and the
// docs footer. It needs no wallet and no chain data.
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    getDexApp: () => ({ href: "https://dex.example" }),
}));

import HomePage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<HomePage />, { wrapper });
const tile = (id: string) => screen.getByTestId(`start-${id}`);

describe("Home: What are you building today?", () => {
    it("shows the hero with one question and the promise", () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("What are you building today?");
        expect(screen.getByText(/Pick a starting point\. We guide you step by step/)).toBeInTheDocument();
    });

    it.each([
        ["token", "Create a token", "/token/new", ["Token"]],
        ["market", "Create a DEX market", "/create/market", ["Liquidity pool", "Order book"]],
        ["rewards", "Create staking rewards", "/create/rewards", ["Simple reward", "Compounded reward"]],
        ["grow", "Grow a community", "/create/grow", ["Airdrop", "Multi-send", "Raffle", "+1"]],
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
        expect(row.getByText("For any token or reward on BeeZee. You don't have to be the one who created it.")).toBeInTheDocument();
        expect(row.getByRole("link", { name: /Extend or fund a reward/ })).toHaveAttribute("href", "/rewards");
        expect(row.getByRole("link", { name: /Manage a token/ })).toHaveAttribute("href", "/tokens");
        expect(row.getByText("Mint, edit details, logo, permissions. Admins only, checked live.")).toBeInTheDocument();
        const dex = row.getByTestId("app-link");
        expect(dex).toHaveAttribute("data-app", "dex");
        expect(dex).toHaveAttribute("href", "https://dex.example/pools");
    });

    it("explains the four steps", () => {
        renderPage();
        const steps = within(screen.getByRole("region", { name: "How it works" })).getAllByRole("heading", { level: 3 });
        expect(steps.map(s => s.textContent)).toEqual(["Pick", "Fill in", "Review", "Done"]);
    });

    it("ends on the chain promise and the docs link, in a new tab", () => {
        renderPage();
        expect(screen.getByText("Everything here reads straight from the chain.")).toBeInTheDocument();
        const docs = screen.getByRole("link", { name: /Guides and strategies on docs\.getbze\.com/ });
        expect(docs).toHaveAttribute("href", "https://docs.getbze.com");
        expect(docs).toHaveAttribute("target", "_blank");
    });

    it("has no goal search, playbooks or tools list any more", () => {
        renderPage();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(screen.queryByText(/Playbook/i)).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "All tools" })).not.toBeInTheDocument();
    });
});
