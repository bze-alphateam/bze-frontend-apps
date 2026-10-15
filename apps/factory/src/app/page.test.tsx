import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { MyToken } from "@/lib/my-tokens";
import { GOALS, GOAL_GROUPS } from "@/lib/goals";

// The goal-first home on mocked hooks: creation fees, the user's tokens, their setup progress and
// navigation. The any-token picker is stubbed with one button.
const m = vi.hoisted(() => ({
    navigate: vi.fn(),
    tokens: [] as unknown[],
    tokensLoading: false,
    setup: { items: [{ key: "created", state: "done" }, { key: "pool", state: "todo" }], doneCount: 1, totalCount: 2, isLoading: false },
    fees: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: m.navigate }) }));
vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => ({ tokens: m.tokens, isLoading: m.tokensLoading }) }));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => m.setup }));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, includeLP, onSelect }: { label: string; includeLP?: boolean; onSelect: (a: { denom: string }) => void }) => (
        <button onClick={() => onSelect({ denom: "factory/bze1other/umilk" })}>{`${label}${includeLP ? " (with LP)" : ""}`}</button>
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

beforeEach(() => {
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

    it("the search box filters the goal cards", async () => {
        renderPage();
        await userEvent.type(screen.getByRole("textbox", { name: "What do you want to do?" }), "pool");
        expect(goal("pool")).toBeInTheDocument();
        expect(goal("addLiquidity")).toBeInTheDocument();
        expect(screen.queryByTestId("goal-createToken")).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Make it official" })).not.toBeInTheDocument();

        await userEvent.clear(screen.getByRole("textbox", { name: "What do you want to do?" }));
        await userEvent.type(screen.getByRole("textbox", { name: "What do you want to do?" }), "qwerty");
        expect(screen.getByText(/Nothing matches yet/)).toBeInTheDocument();
    });

    it("the chips open their goals", async () => {
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "Let people buy it" }));
        expect(m.navigate).toHaveBeenCalledWith("/pool/new");
    });

    it("All tools: technical names, Burn opens a new tab", async () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        renderPage();
        const tools = screen.getByRole("region", { name: "All tools" });
        expect(within(tools).getAllByRole("button").map(b => b.textContent)).toEqual([
            "Create token", "Create pool", "Add liquidity", "Create market", "Holder rewards", "Airdrop",
            "Multi-send", "Staking program", "Brand kit", "Chain registry", "Burn ", "My creations",
        ]);
        await userEvent.click(within(tools).getByRole("button", { name: /Burn/ }));
        expect(open).toHaveBeenCalledWith("https://burner.example", "_blank", "noopener,noreferrer");
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
});
