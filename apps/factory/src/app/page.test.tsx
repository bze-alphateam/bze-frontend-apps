import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { MyToken } from "@/lib/my-tokens";
import { GOALS, GOAL_GROUPS } from "@/lib/goals";
import { savePlaybookProgress } from "@/lib/playbooks";

// The goal-first home on mocked hooks: creation fees, the user's tokens, their setup progress and
// navigation. The any-token picker is stubbed with one button.
const m = vi.hoisted(() => ({
    navigate: vi.fn(),
    tokens: [] as unknown[],
    tokensLoading: false,
    setup: { items: [{ key: "created", state: "done" }, { key: "pool", state: "todo" }], pools: [], doneCount: 1, totalCount: 2, isLoading: false },
    fees: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: m.navigate }) }));
vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => ({ tokens: m.tokens, isLoading: m.tokensLoading }) }));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => m.setup }));
vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => ({ rewards: [], isLoading: false, hasError: false, refresh: vi.fn() }) }));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, includeLP, excludeHalted, onSelect }: { label: string; includeLP?: boolean; excludeHalted?: boolean; onSelect: (a: { denom: string }) => void }) => (
        <button onClick={() => onSelect({ denom: "factory/bze1other/umilk" })}>
            {`${label}${includeLP ? " (with LP)" : ""}${excludeHalted ? " (no halted)" : ""}`}
        </button>
    ),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useCreationFees: () => ({ fees: m.fees }),
        useAsset: (denom: string) => ({ asset: denom === "ubze" ? { denom, ticker: "BZE", decimals: 6 } : undefined, isLoading: false }),
        getBurnerApp: () => ({ href: "https://burner.example" }),
    };
});

import HomePage from "./page";

const FEE = { denom: "ubze", amount: "25000000000" };

const token = (ticker: string): MyToken => ({
    admin: "bze1owner",
    asset: { denom: `factory/bze1owner/u${ticker.toLowerCase()}`, ticker, name: `${ticker} Coin`, logo: "", decimals: 6, supply: 1n },
} as MyToken);

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<HomePage />, { wrapper });
const goal = (id: string) => screen.getByTestId(`goal-${id}`);
const searchBox = () => screen.getByRole("combobox", { name: "What do you want to do?" });

beforeEach(() => {
    localStorage.clear();
    m.navigate.mockReset();
    m.tokens = [];
    m.tokensLoading = false;
    m.fees = { createDenomFee: FEE, createMarketFee: FEE, createStakingRewardFee: FEE, createDenomRewardFee: FEE };
});

afterEach(() => vi.restoreAllMocks());

describe("Home: What do you want to do?", { timeout: 20_000 }, () => {
    it("renders every catalogue goal in its group with tech tag and fee", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "What do you want to do?" })).toBeInTheDocument();

        for (const group of GOAL_GROUPS) {
            const section = screen.getByRole("region", { name: group.title });
            expect(within(section).getByRole("heading")).toHaveTextContent(`${group.number} · ${group.title}`);
            for (const g of GOALS.filter(x => x.group === group.id)) {
                expect(within(section).getByTestId(`goal-${g.id}`)).toHaveTextContent(g.title);
                expect(within(section).getByTestId(`goal-${g.id}`)).toHaveTextContent(g.techTag);
            }
        }
        expect(goal("createToken")).toHaveTextContent("Token factory · 25,000 BZE");
        expect(goal("campaign")).toHaveTextContent("Staking program · 25,000 BZE");
        expect(within(goal("stakable")).getByText("Start here")).toBeInTheDocument();
        // No fee: the goal has none, or the chain didn't say (dailyPrize's fee is unknown here).
        expect(within(goal("multisend")).queryByTestId("goal-fee")).not.toBeInTheDocument();
        expect(within(goal("dailyPrize")).queryByTestId("goal-fee")).not.toBeInTheDocument();
    });

    it("goals without a token go straight to their page", async () => {
        renderPage();
        await userEvent.click(goal("createToken"));
        expect(m.navigate).toHaveBeenCalledWith("/token/new");
        await userEvent.click(goal("reach"));
        expect(m.navigate).toHaveBeenLastCalledWith("/reach");
    });

    it("a needsToken goal opens Which token?, and the choice is encoded into the href", async () => {
        m.tokens = [token("HONEY"), token("JAM")];
        renderPage();

        await userEvent.click(goal("stakable"));
        const dialog = await screen.findByRole("dialog", { name: "Which token?" });
        expect(within(dialog).getByRole("button", { name: "Or any token (with LP)" })).toBeInTheDocument();
        await userEvent.click(within(within(dialog).getByRole("group", { name: "Your tokens" })).getByRole("button", { name: /JAM/ }));
        expect(m.navigate).toHaveBeenCalledWith(`/denom-reward/token?denom=${encodeURIComponent("factory/bze1owner/ujam")}`);

        await userEvent.click(goal("registry"));
        await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Or any token" }));
        expect(m.navigate).toHaveBeenLastCalledWith(`/official?denom=${encodeURIComponent("factory/bze1other/umilk")}`);
    });

    it("Run a burning raffle: any token but no halted ones, your halted tokens hidden too", async () => {
        const halted = token("DEAD");
        m.tokens = [token("HONEY"), { ...halted, asset: { ...halted.asset, halted: true } }];
        renderPage();

        expect(goal("raffle")).toHaveTextContent("Run a burning raffle");
        await userEvent.click(goal("raffle"));
        const dialog = await screen.findByRole("dialog", { name: "Which token?" });
        const mine = within(within(dialog).getByRole("group", { name: "Your tokens" }));
        expect(mine.queryByRole("button", { name: /DEAD/ })).not.toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole("button", { name: "Or any token (no halted)" }));
        expect(m.navigate).toHaveBeenLastCalledWith(`/raffle/new?denom=${encodeURIComponent("factory/bze1other/umilk")}`);
    });

    it("mine with exactly one token skips the dialog", async () => {
        m.tokens = [token("HONEY")];
        renderPage();
        await userEvent.click(goal("lock"));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(m.navigate).toHaveBeenCalledWith(`/manage/token?denom=${encodeURIComponent("factory/bze1owner/uhoney")}&tab=control&lock=1`);
    });

    it("mine with no tokens offers Create my token", async () => {
        renderPage();
        await userEvent.click(goal("brandKit"));
        const dialog = await screen.findByRole("dialog", { name: "Which token?" });
        expect(dialog).toHaveTextContent("You don't have a token yet.");
        expect(within(dialog).queryByRole("button", { name: /any token/ })).not.toBeInTheDocument();
        await userEvent.click(within(dialog).getByRole("button", { name: "Create my token" }));
        expect(m.navigate).toHaveBeenCalledWith("/token/new");
    });

    it("the Your tokens strip shows up to 4 tokens with their setup, and hides without tokens", async () => {
        const { unmount } = renderPage();
        expect(screen.queryByRole("region", { name: "Your tokens" })).not.toBeInTheDocument();
        unmount();

        m.tokens = ["A", "B", "C", "D", "E"].map(token);
        renderPage();
        const strip = screen.getByRole("region", { name: "Your tokens" });
        const cards = within(strip).getAllByTestId("strip-token");
        expect(cards).toHaveLength(4);
        expect(cards[0]).toHaveTextContent("no pool yet");
        await userEvent.click(cards[1]);
        expect(m.navigate).toHaveBeenCalledWith(`/manage/token?denom=${encodeURIComponent("factory/bze1owner/ub")}&tab=overview`);
        await userEvent.click(within(strip).getByRole("button", { name: /All my tokens/ }));
        expect(m.navigate).toHaveBeenLastCalledWith("/manage");
    });

    it("the cards always show every goal, whatever is typed", async () => {
        renderPage();
        await userEvent.type(searchBox(), "pool");
        expect(goal("createToken")).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Make it official" })).toBeInTheDocument();
    });

    it("search: a combobox whose panel lists goals in everyday words, with a synonyms hint", async () => {
        renderPage();
        const box = searchBox();
        expect(box).toHaveAttribute("aria-expanded", "false");
        await userEvent.type(box, "airdrop");
        expect(box).toHaveAttribute("aria-expanded", "true");
        const listbox = screen.getByRole("listbox", { name: "Search results" });
        expect(box).toHaveAttribute("aria-controls", listbox.id);
        const options = within(listbox).getAllByRole("option");
        expect(options.slice(0, 3).map(o => o.textContent)).toEqual([
            expect.stringContaining("Gift my stakers, once"),
            expect.stringContaining("Reach another community"),
            expect.stringContaining("Send to a list of wallets"),
        ]);
        expect(box).toHaveAttribute("aria-activedescendant", options[0].id);
        expect(options[0]).toHaveAttribute("aria-selected", "true");
        expect(screen.getByTestId("goal-search-panel")).toHaveTextContent("Also finds: giveaway, gift, drop, bonus, reward stakers…");
    });

    it("search: ↑/↓ move the active row, Enter opens it", async () => {
        renderPage();
        const box = searchBox();
        await userEvent.type(box, "airdrop");
        await userEvent.keyboard("{ArrowDown}{ArrowDown}");
        const options = screen.getAllByRole("option");
        expect(box).toHaveAttribute("aria-activedescendant", options[2].id);
        await userEvent.keyboard("{ArrowUp}");
        expect(box).toHaveAttribute("aria-activedescendant", options[1].id);
        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(m.navigate).toHaveBeenCalledWith("/multisend");
        expect(box).toHaveAttribute("aria-expanded", "false");
    });

    it("search: Enter on a needsToken goal opens Which token?", async () => {
        renderPage();
        await userEvent.type(searchBox(), "giveaway{Enter}");
        expect(await screen.findByRole("dialog", { name: "Which token?" })).toHaveTextContent("Gift my stakers, once");
        expect(m.navigate).not.toHaveBeenCalled();
    });

    it("search: your tokens open their workspace, and tools are found too", async () => {
        m.tokens = [token("HONEY"), token("JAM")];
        renderPage();
        const box = searchBox();
        await userEvent.type(box, "jam");
        const group = screen.getByRole("group", { name: "Your tokens" });
        await userEvent.click(within(group).getByRole("option", { name: /Open JAM/ }));
        expect(m.navigate).toHaveBeenCalledWith(`/manage/token?denom=${encodeURIComponent("factory/bze1owner/ujam")}&tab=overview`);

        const open = vi.spyOn(window, "open").mockReturnValue(null);
        await userEvent.clear(box);
        await userEvent.type(box, "burn{Enter}");
        expect(open).toHaveBeenCalledWith("https://burner.example", "_blank", "noopener,noreferrer");
    });

    it("search: Esc closes the panel, a second Esc clears the box", async () => {
        renderPage();
        const box = searchBox();
        await userEvent.type(box, "logo");
        await userEvent.keyboard("{Escape}");
        expect(box).toHaveAttribute("aria-expanded", "false");
        expect(box).toHaveValue("logo");
        await userEvent.keyboard("{Escape}");
        expect(box).toHaveValue("");
    });

    it("search: no match says so and offers All tools", async () => {
        renderPage();
        await userEvent.type(searchBox(), "qwerty");
        const panel = screen.getByTestId("goal-search-panel");
        expect(panel).toHaveTextContent(`Nothing matches "qwerty". Try other words, or browse all tools below.`);
        await userEvent.click(within(panel).getByRole("button", { name: "My creations" }));
        expect(m.navigate).toHaveBeenCalledWith("/manage");
    });

    it("/ focuses the search from anywhere, but not while typing in another input", async () => {
        renderPage();
        await userEvent.keyboard("/");
        expect(searchBox()).toHaveFocus();
        expect(searchBox()).toHaveValue("");

        searchBox().blur();
        const other = document.createElement("input");
        document.body.appendChild(other);
        other.focus();
        await userEvent.keyboard("/");
        expect(other).toHaveFocus();
        expect(other).toHaveValue("/");
        other.remove();
    });

    it("the chips open their goals", async () => {
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "Let people buy it" }));
        expect(m.navigate).toHaveBeenCalledWith("/pool/new");
    });

    it("All tools: technical names, Burn opens the Burner in a new tab", async () => {
        renderPage();
        const tools = screen.getByRole("region", { name: "All tools" });
        expect(within(tools).getAllByRole("button").map(b => b.textContent)).toEqual([
            "Create token", "Create pool", "Add liquidity", "Create market", "Holder rewards", "Airdrop",
            "Multi-send", "Staking program", "Brand kit", "Chain registry", "My creations",
        ]);
        const burn = within(tools).getByRole("link", { name: "Burner" });
        expect(burn).toHaveAttribute("href", "https://burner.example");
        expect(burn).toHaveAttribute("target", "_blank");
        expect(burn).toHaveAttribute("data-app", "burner");
        await userEvent.click(within(tools).getByRole("button", { name: "My creations" }));
        expect(m.navigate).toHaveBeenCalledWith("/manage");
        await userEvent.click(within(tools).getByRole("button", { name: "Airdrop" }));
        expect(await screen.findByRole("dialog", { name: "Which token?" })).toBeInTheDocument();
    });

    it("ⓘ Which one? opens the reward guide", async () => {
        renderPage();
        await userEvent.click(within(screen.getByRole("region", { name: "Grow the community" })).getByRole("button", { name: "Which reward fits?" }));
        expect(await screen.findByRole("dialog", { name: "Which reward fits?" })).toBeInTheDocument();
    });

    it("playbooks: three cards with their step chain, progress only once started", async () => {
        savePlaybookProgress("launch", { denom: "factory/bze1owner/uhoney", manualDone: [] });
        savePlaybookProgress("noticed", { manualDone: ["reach"] });
        renderPage();
        const section = screen.getByRole("region", { name: "New here? Follow a playbook" });
        expect(section).toHaveTextContent("Proven recipes, step by step. Leave any time, your progress stays.");

        const card = (id: string) => within(section).getByTestId(`playbook-${id}`);
        expect(card("launch")).toHaveTextContent("Create → Pool → Stakable → Logo → Lock");
        expect(card("launch")).toHaveTextContent("5 steps · about 20 min + registry review");
        // Token chosen: create is done by the token, the pool is todo in the mocked checklist.
        expect(within(card("launch")).getByTestId("playbook-progress")).toHaveTextContent("1 of 5");
        expect(within(card("noticed")).getByTestId("playbook-progress")).toHaveTextContent("1 of 2");
        expect(within(card("lps")).queryByTestId("playbook-progress")).not.toBeInTheDocument();

        await userEvent.click(card("lps"));
        expect(m.navigate).toHaveBeenCalledWith("/playbooks?id=lps");
    });
});
