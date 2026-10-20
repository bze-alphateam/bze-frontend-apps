import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { MyToken } from "@/lib/my-tokens";

// Drive the page off mocked hooks: useMyTokens, useTokenSetup (records which denoms it was asked
// for), the wallet address, and the chain's pools and markets. No wallet/chain providers.
const m = vi.hoisted(() => ({
    useMyTokens: vi.fn(),
    navigate: vi.fn(),
    setupCalls: [] as string[],
    setup: {} as Record<string, unknown>,
    address: "bze1owner" as string | undefined,
    pools: [] as Record<string, unknown>[],
    markets: [] as Record<string, unknown>[],
    toast: vi.fn(),
}));

vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => m.useMyTokens() }));
vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: m.navigate }) }));
vi.mock("@/hooks/useTokenSetup", () => ({
    useTokenSetup: (denom: string) => {
        m.setupCalls.push(denom);
        return m.setup;
    },
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useToast: () => ({ toast: { success: m.toast, error: vi.fn(), info: vi.fn() } }),
        useLiquidityPools: () => ({ pools: m.pools, isLoading: false }),
        useMarkets: () => ({ markets: m.markets, isLoading: false }),
        useAsset: (denom: string) => ({ asset: denom === "ubze" ? { ticker: "BZE", logo: "" } : undefined, isLoading: false }),
    };
});

import ManagePage from "./page";

// `admin` is required on purpose: a default would swallow an explicit undefined
// (the "lookup failed" state) and turn it into a renounced admin.
function token(ticker: string, admin: string | undefined): MyToken {
    const denom = `factory/bze1owner/u${ticker.toLowerCase()}`;
    return {
        admin,
        asset: {
            denom,
            ticker,
            name: `${ticker} Token`,
            type: "factory",
            decimals: 6,
            logo: "",
            stable: false,
            verified: false,
            supply: 1000000n,
        },
    } as MyToken;
}

const setupWith = (items: { key: string; state: string }[], isLoading = false) => ({
    items,
    doneCount: items.filter(i => i.state === "done").length,
    totalCount: items.length,
    isLoading,
});

function renderPage() {
    return render(<ManagePage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    m.useMyTokens.mockReset();
    m.navigate.mockReset();
    m.setupCalls = [];
    m.setup = setupWith([{ key: "created", state: "done" }, { key: "pool", state: "todo" }, { key: "holderRewards", state: "todo" }]);
    m.address = "bze1owner";
    m.pools = [];
    m.markets = [];
});

describe("Your tokens (/manage)", () => {
    it("points to the staking programs on /rewards", () => {
        m.useMyTokens.mockReturnValue({ tokens: [], isLoading: false });
        renderPage();

        expect(screen.getByRole("link", { name: "Looking for staking programs? They're under Rewards →" }))
            .toHaveAttribute("href", "/rewards?tab=programs&filter=all&sort=staked&status=all");
    });

    it("shows the header and no empty/loaded content while loading", () => {
        m.useMyTokens.mockReturnValue({ tokens: [], isLoading: true });
        renderPage();

        expect(screen.getByRole("heading", { name: "Your tokens" })).toBeInTheDocument();
        expect(screen.getByText("Everything created by your connected address, straight from the chain.")).toBeInTheDocument();
        expect(screen.queryByText("No tokens yet.")).not.toBeInTheDocument();
    });

    it("shows the empty state when the address owns no tokens", () => {
        m.useMyTokens.mockReturnValue({ tokens: [], isLoading: false });
        renderPage();

        expect(screen.getByText("No tokens yet.")).toBeInTheDocument();
        expect(screen.getByText("Connect your wallet if you haven't already.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Create your first token/ })).toBeInTheDocument();
    });

    it("lists a card per owned token once loaded, with the right trust badge", () => {
        m.useMyTokens.mockReturnValue({ tokens: [token("HONEY", "bze1admin"), token("MILK", "")], isLoading: false });
        renderPage();

        expect(screen.getByText("HONEY Token")).toBeInTheDocument();
        expect(screen.getByText("MILK Token")).toBeInTheDocument();
        expect(screen.queryByText("No tokens yet.")).not.toBeInTheDocument();
        // Active admin -> Mintable; renounced admin ('') -> Fixed supply.
        expect(screen.getByText("Mintable")).toBeInTheDocument();
        expect(screen.getByText("Fixed supply")).toBeInTheDocument();
        expect(screen.getAllByText("Total supply")).toHaveLength(2);
    });

    it("a token card offers Open only, no Burner link", () => {
        m.useMyTokens.mockReturnValue({ tokens: [token("HONEY", "bze1admin")], isLoading: false });
        renderPage();

        const card = screen.getByTestId("my-token");
        expect(within(card).getByRole("button", { name: "Open" })).toBeInTheDocument();
        expect(within(card).queryByRole("link", { name: /Burner/ })).not.toBeInTheDocument();
    });

    it("shows a neutral badge when the admin lookup failed, never Fixed supply", () => {
        m.useMyTokens.mockReturnValue({ tokens: [token("HONEY", undefined)], isLoading: false });
        renderPage();

        expect(screen.getByText("Control unknown")).toBeInTheDocument();
        expect(screen.queryByText("Fixed supply")).not.toBeInTheDocument();
        expect(screen.queryByText("Mintable")).not.toBeInTheDocument();
    });

    it("explains the badges in a collapsible note", async () => {
        m.useMyTokens.mockReturnValue({ tokens: [], isLoading: false });
        renderPage();

        expect(screen.queryByText(/nobody can ever change the supply/)).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /What do the badges mean\?/ }));
        expect(await screen.findByText(/nobody can ever change the supply/)).toBeInTheDocument();
    });

    it("navigates to the token form from New token, and Open goes to the workspace", async () => {
        m.useMyTokens.mockReturnValue({ tokens: [token("HONEY", "bze1admin")], isLoading: false });
        renderPage();

        await userEvent.click(screen.getByRole("button", { name: /New token/ }));
        expect(m.navigate).toHaveBeenCalledWith("/token/new");
        await userEvent.click(screen.getByRole("button", { name: "Open" }));
        expect(m.navigate).toHaveBeenCalledWith(`/manage/token?denom=${encodeURIComponent("factory/bze1owner/uhoney")}&tab=overview`);
    });

    it("shows each token's setup progress and its first unfinished item", () => {
        m.useMyTokens.mockReturnValue({ tokens: [token("HONEY", "bze1admin")], isLoading: false });
        renderPage();

        expect(screen.getByTestId("setup-progress")).toHaveTextContent("1 of 3 set up· no pool yet");
    });

    it("a skeleton while the setup is read; no hint when everything is done", () => {
        m.useMyTokens.mockReturnValue({ tokens: [token("HONEY", "bze1admin")], isLoading: false });
        m.setup = setupWith([{ key: "created", state: "done" }], true);
        const { unmount } = renderPage();
        expect(screen.getByTestId("setup-progress-loading")).toBeInTheDocument();
        unmount();

        m.setup = setupWith([{ key: "created", state: "done" }, { key: "pool", state: "done" }]);
        renderPage();
        expect(screen.getByTestId("setup-progress")).toHaveTextContent(/^2 of 2 set up$/);
    });

    it("reads the setup of the first 10 tokens only, then 10 more on Show more", async () => {
        const many = Array.from({ length: 12 }, (_, i) => token(`T${i}`, "bze1admin"));
        m.useMyTokens.mockReturnValue({ tokens: many, isLoading: false });
        renderPage();

        expect(screen.getAllByTestId("my-token")).toHaveLength(10);
        expect(new Set(m.setupCalls).size).toBe(10);
        expect(m.setupCalls).not.toContain("factory/bze1owner/ut10");

        await userEvent.click(screen.getByRole("button", { name: "Show more (2 left)" }));
        expect(screen.getAllByTestId("my-token")).toHaveLength(12);
        expect(new Set(m.setupCalls).size).toBe(12);
        expect(screen.queryByRole("button", { name: /Show more/ })).not.toBeInTheDocument();
    });
});

describe("Markets and pools you created", () => {
    const POOL = (id: string, creator: string) => ({ id, base: "factory/bze1owner/uhoney", quote: "ubze", lp_denom: `ulp_${id}`, fee: "0.003", creator });
    const MARKET = (base: string, creator: string) => ({ base, quote: "ubze", creator });

    it("lists only the pools and markets this address created", async () => {
        Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
        m.useMyTokens.mockReturnValue({ tokens: [], isLoading: false });
        m.pools = [POOL("p1", "bze1owner"), POOL("p2", "bze1someone")];
        m.markets = [MARKET("factory/bze1owner/uhoney", "bze1owner"), MARKET("factory/bze1x/umilk", "bze1someone")];
        renderPage();

        const pools = screen.getByTestId("created-pools");
        expect(pools).toHaveTextContent("Pools (1)");
        expect(within(pools).getByText("factory/bze1owner/uhoney/BZE")).toBeInTheDocument();
        expect(within(pools).getByText("0.3% swap fee")).toBeInTheDocument();
        expect(within(pools).queryByText("ulp_p2")).not.toBeInTheDocument();
        await userEvent.click(within(pools).getByRole("button", { name: "Add liquidity" }));
        expect(m.navigate).toHaveBeenCalledWith("/pool/add?pool=p1");
        await userEvent.click(within(pools).getByRole("button", { name: "Copy LP denom" }));
        expect(m.toast).toHaveBeenCalledWith("Copied", "LP denom copied to clipboard.");

        const markets = screen.getByTestId("created-markets");
        expect(markets).toHaveTextContent("Markets (1)");
        expect(within(markets).queryByText(/umilk/)).not.toBeInTheDocument();
    });

    it("empty, or without a wallet: offers to create a pool or a market", async () => {
        m.useMyTokens.mockReturnValue({ tokens: [], isLoading: false });
        m.address = undefined;
        m.pools = [POOL("p1", "bze1owner")];
        renderPage();

        const section = screen.getByRole("region", { name: "Markets and pools you created" });
        expect(section).toHaveTextContent("You haven't created a market or pool yet.");
        await userEvent.click(within(section).getByRole("button", { name: "Create a pool" }));
        expect(m.navigate).toHaveBeenCalledWith("/pool/new");
        await userEvent.click(within(section).getByRole("button", { name: "Create a market" }));
        expect(m.navigate).toHaveBeenCalledWith("/market/new");
    });
});
