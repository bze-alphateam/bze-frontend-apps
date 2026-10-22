import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { setInLocalStorage, type Asset } from "@bze/bze-ui-kit";
import type { MyToken } from "@/lib/my-tokens";

// The home against mocked hooks: the wallet address (useChain), the wallet's own tokens
// (useMyTokens), their chain facts (pools, compounded reward, simple rewards) and the drafts in
// localStorage. Disconnected (BFE-260): six starting points, work on what exists, how it works and
// the docs footer. Connected (BFE-275): the welcome hero and "Pick up where you left off".
const m = vi.hoisted(() => ({
    address: undefined as string | undefined,
    mine: { tokens: [] as MyToken[], isLoading: false, refreshAdmins: () => {} },
    pools: [] as { id: string; base: string; quote: string; lp_denom: string }[],
    denomRewards: {} as Record<string, { staked_amount: string } | undefined>,
    schedules: {} as Record<string, { schedule_id: string; duration: number; payouts: number }[]>,
    denomRewardError: {} as Record<string, boolean>,
    simpleRewards: [] as { staking_denom: string; duration: number; payouts: number }[],
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => m.mine }));
vi.mock("@/hooks/useDenomReward", () => ({
    useDenomReward: (denom: string) => ({
        denomReward: m.denomRewards[denom],
        schedules: m.schedules[denom] ?? [],
        prizes: [],
        hasError: Boolean(m.denomRewardError[denom]),
        isLoading: false,
        refresh: async () => undefined,
    }),
}));
vi.mock("@/hooks/useStakingRewards", () => ({
    useStakingRewards: () => ({ rewards: m.simpleRewards, isLoading: false, hasError: false, refresh: () => {} }),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const tickers: Record<string, string> = { ubze: "BZE" };
    const ticker = (denom: string) => tickers[denom] ?? denom.split("/").pop()!.slice(1).toUpperCase();
    return {
        ...actual,
        getDexApp: () => ({ href: "https://dex.example" }),
        getChainNativeAssetDenom: () => "ubze",
        useAssets: () => ({
            denomTicker: ticker,
            denomDecimals: () => 6,
            getAsset: (denom: string) => ({ denom, ticker: ticker(denom), logo: "" }),
        }),
        useLiquidityPools: () => ({ pools: m.pools, isLoading: false }),
    };
});

import HomePage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<HomePage />, { wrapper });
const tile = (id: string) => screen.getByTestId(`start-${id}`);

describe("Home: What are you building today?", () => {
    beforeEach(() => { m.address = undefined; });

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

const ME = "bze1me";
const asset = (ticker: string): Asset => ({
    denom: `factory/${ME}/u${ticker.toLowerCase()}`,
    type: "Factory",
    ticker,
    name: `${ticker} Token`,
    decimals: 6,
    logo: "",
    stable: false,
    verified: false,
    supply: 1_000_000_000_000n,
});
const mine = (...tickers: string[]): MyToken[] => tickers.map(t => ({ asset: asset(t), admin: ME }));
const pickUp = () => within(screen.getByRole("region", { name: "Pick up where you left off" }));

describe("Home, connected: Pick up where you left off", () => {
    beforeEach(() => {
        localStorage.clear();
        m.address = ME;
        m.mine = { tokens: [], isLoading: false, refreshAdmins: () => {} };
        m.pools = [];
        m.denomRewards = {};
        m.schedules = {};
        m.denomRewardError = {};
        m.simpleRewards = [];
    });

    it("greets the user; with nothing to pick up it keeps the starting points, work on what exists and how it works", () => {
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back. What's next?");
        expect(screen.getByText("Drafts from this browser, and suggestions for tokens you created, read from the chain.")).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Pick up where you left off" })).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Starting points" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Work on something that exists" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "How it works" })).toBeInTheDocument();
    });

    it("shows the unfinished token draft as the gold card", () => {
        setInLocalStorage("factory_launch_draft", JSON.stringify({ form: { name: "Bee", symbol: "bee" }, answered: ["details"] }), 60);
        renderPage();
        const card = pickUp().getByRole("article", { name: "Unfinished: BEE token" });
        expect(within(card).getByText("Draft · step 2 of 4 · saved in this browser")).toBeInTheDocument();
        expect(within(card).getByRole("img", { name: "Step 2 of 4" })).toBeInTheDocument();
        expect(within(card).getByRole("link", { name: "Continue creating BEE" })).toHaveAttribute("href", "/token/new");
        expect(pickUp().getByRole("link", { name: /Tokens you created/ })).toHaveAttribute("href", "/tokens?filter=mine");
    });

    it("then switches the starting points to the compact list, still with work on what exists and the footer", () => {
        setInLocalStorage("factory_launch_draft", JSON.stringify({ form: { symbol: "BEE" }, answered: [] }), 60);
        renderPage();
        const list = within(screen.getByRole("region", { name: "Start something new" }));
        expect(list.getByTestId("start-market")).toHaveAttribute("href", "/create/market");
        expect(list.getByText("Liquidity pool · Order book")).toBeInTheDocument();
        expect(list.getByTestId("start-dao").closest("a")).toBeNull();
        expect(within(list.getByTestId("start-dao")).getByText("Coming soon")).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Starting points" })).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Work on something that exists" })).toBeInTheDocument();
        expect(screen.getByText("Everything here reads straight from the chain.")).toBeInTheDocument();
    });

    it("suggests a pool for a token you created that has none, read from the chain", () => {
        m.mine = { tokens: mine("HONEY"), isLoading: false, refreshAdmins: () => {} };
        renderPage();
        const card = pickUp().getByRole("article", { name: "HONEY" });
        expect(within(card).getByText("No market yet")).toBeInTheDocument();
        expect(within(card).getByRole("link", { name: "Create a HONEY/BZE pool" }))
            .toHaveAttribute("href", `/pool/new?base=${encodeURIComponent(asset("HONEY").denom)}`);
    });

    it("suggests rewarding the liquidity, and extending a daily prize that ends soon", () => {
        const honey = asset("HONEY").denom;
        const wax = asset("WAX").denom;
        m.mine = { tokens: mine("HONEY", "WAX"), isLoading: false, refreshAdmins: () => {} };
        m.pools = [
            { id: "1", base: honey, quote: "ubze", lp_denom: "ulp_1" },
            { id: "2", base: wax, quote: "ubze", lp_denom: "ulp_2" },
        ];
        m.simpleRewards = [{ staking_denom: "ulp_2", duration: 30, payouts: 1 }];
        m.denomRewards = { [wax]: { staked_amount: "5000000" } };
        m.schedules = { [wax]: [{ schedule_id: "9", duration: 30, payouts: 27 }] };
        renderPage();
        expect(within(pickUp().getByRole("article", { name: "HONEY" })).getByRole("link", { name: "Reward HONEY/BZE liquidity" }))
            .toHaveAttribute("href", "/reward/new?staking=ulp_1");
        const prize = pickUp().getByRole("article", { name: "WAX compounded reward" });
        expect(within(prize).getByText("Daily prize ends in 3 days")).toBeInTheDocument();
        expect(within(prize).getByText("5 WAX is staked. Extend the daily prize before it stops.")).toBeInTheDocument();
    });

    it("skips a token whose chain facts failed", () => {
        m.mine = { tokens: mine("HONEY"), isLoading: false, refreshAdmins: () => {} };
        m.denomRewardError = { [asset("HONEY").denom]: true };
        renderPage();
        expect(screen.queryByRole("region", { name: "Pick up where you left off" })).not.toBeInTheDocument();
    });

    it("shows a shimmer card while your tokens are still loading", () => {
        m.mine = { tokens: [], isLoading: true, refreshAdmins: () => {} };
        renderPage();
        expect(pickUp().getAllByTestId("pickup-shimmer")).toHaveLength(1);
    });

    it("ignores the drafts when no wallet is connected", () => {
        m.address = undefined;
        setInLocalStorage("factory_launch_draft", JSON.stringify({ form: { symbol: "BEE" }, answered: [] }), 60);
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("What are you building today?");
        expect(screen.queryByRole("region", { name: "Pick up where you left off" })).not.toBeInTheDocument();
    });
});
