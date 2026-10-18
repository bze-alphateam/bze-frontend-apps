import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// The Trading tab off the ui-kit pool/market hooks: every pool and market with the token, whoever
// created it, and the links into the forms (all carrying the return path back to this tab).
const OWNER = "bze1owner";
const DENOM = "factory/bze1owner/utok";
const ENC = encodeURIComponent(DENOM);

const ASSETS: Record<string, { ticker: string; logo: string; decimals: number; halted?: boolean }> = {
    [DENOM]: { ticker: "TOK", logo: "", decimals: 6 },
    ubze: { ticker: "BZE", logo: "", decimals: 6 },
    uatom: { ticker: "ATOM", logo: "", decimals: 6 },
    uhalt: { ticker: "OLD", logo: "", decimals: 6, halted: true },
};

const pool = (id: string, base: string, quote: string, creator = "bze1someone") => ({
    id, base, quote, creator, fee: "0.003", lp_denom: `ulp_${id}`, reserve_base: "2000000", reserve_quote: "5000000",
});

const m = vi.hoisted(() => ({
    pools: [] as unknown[],
    markets: [] as unknown[],
    isLoading: false,
    toast: vi.fn(),
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1owner" }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        TokenLogo: () => null,
        getDexApp: () => ({ href: "https://dex.example" }),
        useAsset: (denom: string) => ({ asset: ASSETS[denom] }),
        useLiquidityPools: () => ({ pools: m.pools, isLoading: m.isLoading }),
        useMarkets: () => ({ markets: m.markets, isLoading: m.isLoading }),
        useToast: () => ({ toast: { success: m.toast } }),
    };
});

import { TradingTab } from "./trading-tab";
import type { WorkspaceTabProps } from "./types";

const RETURN = `return=${encodeURIComponent(`/manage/token?denom=${ENC}&tab=trading`)}&returnLabel=TOK`;

const props = (over: Partial<WorkspaceTabProps> = {}, halted = false): WorkspaceTabProps => ({
    asset: { denom: DENOM, ticker: "TOK", name: "Tok", decimals: 6, logo: "", supply: 1n, halted } as unknown as WorkspaceTabProps["asset"],
    admin: OWNER,
    adminState: "admin",
    supplyDisplay: new BigNumber(1),
    isSupplyLoading: false,
    balanceDisplay: new BigNumber(0),
    refreshSupply: vi.fn(),
    refreshAdmins: vi.fn(async () => {}),
    goTo: vi.fn(),
    ...over,
});

const renderTab = (p: WorkspaceTabProps) => render(
    <ChakraProvider value={defaultSystem}>
        <TradingTab {...p} />
    </ChakraProvider>,
);

beforeEach(() => {
    m.pools = [
        pool("1", DENOM, "ubze", OWNER),
        pool("2", "uatom", DENOM),
        pool("3", "uatom", "ubze"),
    ];
    m.markets = [
        { base: DENOM, quote: "ubze", creator: "bze1someone" },
        { base: "uatom", quote: DENOM, creator: OWNER },
        { base: "uatom", quote: "ubze", creator: OWNER },
    ];
    m.isLoading = false;
    m.toast.mockReset();
});

describe("TradingTab pools", () => {
    it("lists the pools with the token as base or as quote, nothing else", () => {
        renderTab(props());
        expect(screen.getByTestId("trading-pool-1")).toHaveTextContent("TOK/BZE");
        expect(screen.getByTestId("trading-pool-2")).toHaveTextContent("ATOM/TOK");
        expect(screen.queryByTestId("trading-pool-3")).not.toBeInTheDocument();
    });

    it("shows the fee, the reserves and the LP denom; copies it with a toast", async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        renderTab(props());
        const row = within(screen.getByTestId("trading-pool-1"));
        expect(row.getByText("0.3% swap fee")).toBeInTheDocument();
        expect(row.getByTestId("pool-reserves")).toHaveTextContent("2 TOK + 5 BZE");
        expect(row.getByText("ulp_1")).toBeInTheDocument();
        await userEvent.click(row.getByRole("button", { name: "Copy LP denom" }));
        expect(writeText).toHaveBeenCalledWith("ulp_1");
        expect(m.toast).toHaveBeenCalledWith("LP denom copied");
    });

    it("badges only the pools the wallet created", () => {
        renderTab(props());
        expect(within(screen.getByTestId("trading-pool-1")).getByText("You created it")).toBeInTheDocument();
        expect(within(screen.getByTestId("trading-pool-2")).queryByText("You created it")).not.toBeInTheDocument();
    });

    it("links add liquidity, reward LPs and create another pool with the return path", async () => {
        const p = props();
        renderTab(p);
        const row = within(screen.getByTestId("trading-pool-2"));
        await userEvent.click(row.getByRole("button", { name: "Add liquidity" }));
        await userEvent.click(row.getByRole("button", { name: "Reward liquidity providers" }));
        await userEvent.click(screen.getByRole("button", { name: "Create another pool" }));
        expect(p.goTo).toHaveBeenNthCalledWith(1, `/pool/add?pool=2&${RETURN}`);
        expect(p.goTo).toHaveBeenNthCalledWith(2, `/reward/new?staking=ulp_2&${RETURN}`);
        expect(p.goTo).toHaveBeenNthCalledWith(3, `/pool/new?base=${ENC}&${RETURN}`);
    });

    it("opens the pool on the DEX", async () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        renderTab(props());
        await userEvent.click(within(screen.getByTestId("trading-pool-1")).getByRole("button", { name: /View on DEX/ }));
        expect(open).toHaveBeenCalledWith("https://dex.example/pools/details?id=1", "_blank", "noopener,noreferrer");
        open.mockRestore();
    });

    it("hides Add liquidity when the other side is halted", () => {
        m.pools = [pool("9", DENOM, "uhalt")];
        renderTab(props());
        const row = within(screen.getByTestId("trading-pool-9"));
        expect(row.queryByRole("button", { name: "Add liquidity" })).not.toBeInTheDocument();
        expect(row.getByRole("button", { name: "Reward liquidity providers" })).toBeInTheDocument();
    });

    it("empty: nobody can buy it yet, with a create button", async () => {
        m.pools = [pool("3", "uatom", "ubze")];
        const p = props();
        renderTab(p);
        expect(screen.getByText("Nobody can buy TOK yet.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Create another pool" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Create a TOK pool" }));
        expect(p.goTo).toHaveBeenCalledWith(`/pool/new?base=${ENC}&${RETURN}`);
    });

    it("skeletons while loading", () => {
        m.isLoading = true;
        renderTab(props());
        expect(screen.getAllByTestId("trading-skeleton")).toHaveLength(2);
        expect(screen.queryByText("Nobody can buy TOK yet.")).not.toBeInTheDocument();
    });
});

describe("TradingTab markets", () => {
    const id1 = `${DENOM}/ubze`;
    const id2 = `uatom/${DENOM}`;

    it("lists the markets with the token on either side, nothing else", () => {
        renderTab(props());
        expect(screen.getByTestId(`trading-market-${id1}`)).toHaveTextContent("TOK/BZE");
        expect(screen.getByTestId(`trading-market-${id1}`)).toHaveTextContent(id1);
        expect(screen.getByTestId(`trading-market-${id2}`)).toHaveTextContent("ATOM/TOK");
        expect(screen.queryByTestId("trading-market-uatom/ubze")).not.toBeInTheDocument();
    });

    it("badges only the markets the wallet created", () => {
        renderTab(props());
        expect(within(screen.getByTestId(`trading-market-${id1}`)).queryByText("You created it")).not.toBeInTheDocument();
        expect(within(screen.getByTestId(`trading-market-${id2}`)).getByText("You created it")).toBeInTheDocument();
    });

    it("opens the market on the DEX", async () => {
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        renderTab(props());
        await userEvent.click(within(screen.getByTestId(`trading-market-${id1}`)).getByRole("button", { name: /View on DEX/ }));
        expect(open).toHaveBeenCalledWith(`https://dex.example/exchange/market?id=${encodeURIComponent(id1)}`, "_blank", "noopener,noreferrer");
        open.mockRestore();
    });

    it("empty: optional order book, with a create button", async () => {
        m.markets = [];
        const p = props();
        renderTab(p);
        expect(screen.getByText("No order book yet. Optional: traders can place limit orders on one.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Create a market" }));
        expect(p.goTo).toHaveBeenCalledWith(`/market/new?base=${ENC}&${RETURN}`);
    });
});

describe("TradingTab halted token", () => {
    it("shows the halted notice and hides every create and add button", () => {
        m.markets = [];
        renderTab(props({}, true));
        expect(screen.getByRole("note")).toHaveTextContent("TOK is no longer tradeable on BZE");
        expect(screen.queryByRole("button", { name: "Create another pool" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Add liquidity" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Create a market" })).not.toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /View on DEX/ }).length).toBeGreaterThan(0);
    });

    it("empty pools: no create button either", () => {
        m.pools = [];
        renderTab(props({}, true));
        expect(screen.getByText("Nobody can buy TOK yet.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Create a TOK pool" })).not.toBeInTheDocument();
    });
});
