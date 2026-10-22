import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BigNumber from "bignumber.js";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";
import type { MyToken } from "@/lib/my-tokens";

// The directory against mocked hooks: the asset list (useAssets), the wallet's own tokens with their
// admins (useMyTokens), the denom reward list and the wallet address. No wallet/chain providers.
const m = vi.hoisted(() => ({
    assets: [] as Asset[],
    assetsLoading: false,
    native: true,
    updateAssets: vi.fn(),
    prices: new Map<string, unknown>(),
    mine: { tokens: [] as MyToken[], isLoading: false, refreshAdmins: vi.fn() },
    drs: vi.fn(),
    address: undefined as string | undefined,
    query: "",
    replace: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock("@/hooks/useMyTokens", () => ({ useMyTokens: () => m.mine }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate, replace: m.replace }),
    useNavigationWithParams: () => ({
        navigate: m.navigate,
        replace: m.replace,
        getQueryParam: (k: string) => new URLSearchParams(m.query).get(k),
        denomParam: null,
    }),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({
            assets: m.assets,
            isLoading: m.assetsLoading,
            nativeAsset: m.native ? { denom: "ubze", ticker: "BZE" } : undefined,
        }),
        useAssetsContext: () => ({ usdPricesMap: m.prices, updateAssets: m.updateAssets }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
        getAllDenomRewards: () => m.drs(),
    };
});

import TokensPage from "./page";

const ME = "bze1me";
const OTHER = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

function asset(ticker: string, creator = OTHER, extra: Partial<Asset> = {}): Asset {
    return {
        denom: `factory/${creator}/u${ticker.toLowerCase()}`,
        type: "Factory",
        ticker,
        name: `${ticker} Token`,
        decimals: 6,
        logo: "",
        stable: false,
        verified: false,
        supply: 1_000_000_000_000n,
        ...extra,
    };
}

const dr = (a: Asset, staked: string) => ({ staking_denom: a.denom, lock: 7, min_stake: "0", staked_amount: staked });

const HONEY = asset("HONEY", ME);
const WAX = asset("WAX", ME);
const PAGE = asset("PAGE");
const GUILD = asset("GUILD");
const VDL = asset("VDL", OTHER, { name: "Vidulum", halted: true });
const NOT_FACTORY = [
    { ...asset("BZE"), denom: "ubze", type: "Native" },
    { ...asset("ATOM"), denom: "ibc/ABC", type: "IBC" },
    { ...asset("LP"), denom: `ulp_factory/${OTHER}/upage_ubze`, type: "LP" },
] as Asset[];

function renderPage() {
    return render(<TokensPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const tickers = (testId: string) =>
    screen.queryAllByTestId(testId).map(row => row.getAttribute("data-denom")!.split("/u").pop()!.toUpperCase());

beforeEach(() => {
    m.assets = [HONEY, WAX, PAGE, GUILD, VDL, ...NOT_FACTORY];
    m.assetsLoading = false;
    m.native = true;
    m.updateAssets.mockReset();
    m.prices = new Map();
    m.mine = { tokens: [], isLoading: false, refreshAdmins: vi.fn() };
    m.drs.mockReset();
    m.drs.mockResolvedValue([dr(PAGE, "1230000000000"), dr(GUILD, "640000000")]);
    m.address = undefined;
    m.query = "";
    m.replace.mockReset();
    m.navigate.mockReset();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });
});

describe("Tokens (/tokens)", () => {
    it("shows the header and every Factory token, sorted by staked value then A–Z", async () => {
        renderPage();

        expect(screen.getByRole("heading", { level: 1, name: "Tokens" })).toBeInTheDocument();
        expect(screen.getByText(/Every token made with Factory\. Open one to see what you can do with it\./)).toBeInTheDocument();

        const all = await screen.findByRole("region", { name: "All tokens" });
        expect(within(all).getByRole("heading", { name: "All tokens · 5" })).toBeInTheDocument();
        // No LP share, IBC or native token; staked PAGE then GUILD, then A–Z.
        expect(tickers("token-row")).toEqual(["PAGE", "GUILD", "HONEY", "VDL", "WAX"]);
    });

    it("says what is staked, links each row to the token page, and tags a halted token", async () => {
        renderPage();

        const page = (await screen.findAllByTestId("token-row"))[0];
        expect(within(page).getByTestId("token-stake")).toHaveTextContent("Stakable · 1,230,000 staked");
        expect(within(page).getByTestId("token-supply")).toHaveTextContent("1,000,000 PAGE");
        expect(within(page).getByRole("link", { name: "PAGE Token · PAGE" }))
            .toHaveAttribute("href", `/tokens/token?denom=${encodeURIComponent(PAGE.denom)}`);
        expect(within(page).getByText("factory/bze1z3…qwg3l/upage")).toBeInTheDocument();
        expect(within(page).queryByText("Halted")).not.toBeInTheDocument();

        const vdl = screen.getAllByTestId("token-row").find(r => r.getAttribute("data-denom") === VDL.denom)!;
        expect(within(vdl).getByTestId("token-stake")).toHaveTextContent("Not stakable yet");
        expect(within(vdl).getByText("Halted")).toBeInTheDocument();
    });

    it("copies a denom", async () => {
        renderPage();

        await userEvent.click(await screen.findByRole("button", { name: "Copy the denom of PAGE" }));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(PAGE.denom);
    });

    it("sorts by USD value when the tokens are priced", async () => {
        // 640 GUILD at $10 beats 1,230,000 PAGE at $0.000001.
        m.prices = new Map([[PAGE.denom, new BigNumber("0.000001")], [GUILD.denom, new BigNumber("10")]]);
        renderPage();

        await screen.findByRole("region", { name: "All tokens" });
        expect(tickers("token-row").slice(0, 2)).toEqual(["GUILD", "PAGE"]);
    });

    it("has no 'Created by you' group without a wallet", async () => {
        renderPage();

        await screen.findByRole("region", { name: "All tokens" });
        expect(screen.queryByRole("region", { name: "Created by you" })).not.toBeInTheDocument();
    });
});

describe("Created by you", () => {
    const mine = (a: Asset, admin: string | undefined): MyToken => ({ asset: a, admin });

    beforeEach(() => {
        m.address = ME;
    });

    it("pins the wallet's tokens on top and leaves them out of All tokens", async () => {
        m.mine.tokens = [mine(HONEY, ME), mine(WAX, "")];
        renderPage();

        const group = await screen.findByRole("region", { name: "Created by you" });
        expect(within(group).getByRole("heading", { name: "Created by you · 2" })).toBeInTheDocument();
        expect(tickers("my-token-row")).toEqual(["HONEY", "WAX"]);
        expect(tickers("token-row")).toEqual(["PAGE", "GUILD", "VDL"]);
    });

    it.each([
        ["you", ME, false, "You are admin"],
        ["renounced", "", false, "Admin given up"],
        ["transferred", OTHER, false, "Admin is bze1z3…qwg3l"],
        ["checking", undefined, true, "Checking admin…"],
        ["error", undefined, false, "Couldn't check admin"],
    ] as const)("badge %s", async (kind, admin, isLoading, label) => {
        m.mine = { tokens: [mine(HONEY, admin)], isLoading, refreshAdmins: vi.fn() };
        renderPage();

        const badge = within(await screen.findByTestId("my-token-row")).getByTestId("admin-badge");
        expect(badge).toHaveAttribute("data-kind", kind);
        expect(badge).toHaveTextContent(label);
    });

    it("adds '· fixed' to the supply once the admin is given up", async () => {
        m.mine.tokens = [mine(HONEY, "")];
        renderPage();

        expect(within(await screen.findByTestId("my-token-row")).getByTestId("token-supply")).toHaveTextContent("1,000,000 HONEY · fixed");
    });

    it("a failed admin lookup offers Retry, never 'Admin given up'", async () => {
        m.mine.tokens = [mine(HONEY, undefined)];
        renderPage();

        const row = await screen.findByTestId("my-token-row");
        expect(within(row).queryByText("Admin given up")).not.toBeInTheDocument();
        await userEvent.click(within(row).getByRole("button", { name: "Retry" }));
        expect(m.mine.refreshAdmins).toHaveBeenCalled();
    });

    it("the 'Created by you' filter shows only that group", async () => {
        m.query = "filter=mine";
        m.mine.tokens = [mine(HONEY, ME)];
        renderPage();

        await screen.findByRole("region", { name: "Created by you" });
        expect(screen.queryByRole("region", { name: "All tokens" })).not.toBeInTheDocument();
    });
});

describe("filters and search", () => {
    it("the Stakable filter keeps the tokens with a compounded reward", async () => {
        m.query = "filter=stakable";
        renderPage();

        await screen.findByRole("region", { name: "All tokens" });
        expect(tickers("token-row")).toEqual(["PAGE", "GUILD"]);
        expect(screen.getByRole("button", { name: "Stakable" })).toHaveAttribute("aria-pressed", "true");
    });

    it("a chip writes the filter to the URL and goes back to page 1", async () => {
        m.query = "q=gu&page=2";
        renderPage();

        await userEvent.click(screen.getByRole("button", { name: "Stakable" }));
        expect(m.replace).toHaveBeenLastCalledWith("/tokens?filter=stakable&q=gu");
    });

    it("searches by name, ticker or denom, and keeps the search in the URL", async () => {
        m.query = "q=vidul";
        renderPage();

        await screen.findByRole("region", { name: "All tokens" });
        expect(screen.getByRole("textbox", { name: "Search tokens" })).toHaveValue("vidul");
        expect(tickers("token-row")).toEqual(["VDL"]);

        await userEvent.clear(screen.getByRole("textbox", { name: "Search tokens" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Search tokens" }), "upa");
        expect(tickers("token-row")).toEqual(["PAGE"]);
        expect(m.replace).toHaveBeenLastCalledWith("/tokens?filter=all&q=upa");
    });

    it("says when nothing matches the search", async () => {
        m.query = "q=nothing";
        renderPage();

        expect(await screen.findByTestId("tokens-no-match")).toHaveTextContent("No token matches 'nothing'.");
    });

    it("asks to connect a wallet for 'Created by you' without one", async () => {
        m.query = "filter=mine";
        renderPage();

        expect(await screen.findByTestId("tokens-no-match")).toHaveTextContent("Connect your wallet to see the tokens you created.");
    });
});

describe("paging", () => {
    const many = Array.from({ length: 45 }, (_, i) => asset(`T${String(i).padStart(2, "0")}`));

    beforeEach(() => {
        m.assets = many;
        m.drs.mockResolvedValue([]);
    });

    const desktopRows = () => screen.getAllByTestId("token-row").filter(r => !r.hasAttribute("data-phone-only"));

    it("shows 20 rows a page with numbered pages, and writes the page to the URL", async () => {
        renderPage();

        await screen.findByRole("region", { name: "All tokens" });
        expect(screen.getAllByTestId("token-row")).toHaveLength(20);
        const pages = screen.getByRole("navigation", { name: "Pages" });
        expect(within(pages).getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
        expect(within(pages).getAllByRole("button").map(b => b.textContent)).toEqual(["1", "2", "3"]);

        await userEvent.click(within(pages).getByRole("button", { name: "Page 3" }));
        expect(m.replace).toHaveBeenLastCalledWith("/tokens?filter=all&page=3");
    });

    it("opens the page from the URL; phones keep the earlier rows, desktop shows that page alone", async () => {
        m.query = "page=2";
        renderPage();

        await screen.findByRole("region", { name: "All tokens" });
        expect(screen.getAllByTestId("token-row")).toHaveLength(40);
        expect(desktopRows()).toHaveLength(20);
        expect(desktopRows()[0]).toHaveAttribute("data-denom", many[20].denom);
        expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    });

    it("phones get 'Show 20 more', then the rest", async () => {
        m.query = "page=2";
        renderPage();

        await userEvent.click(await screen.findByRole("button", { name: "Show 5 more" }));
        expect(m.replace).toHaveBeenLastCalledWith("/tokens?filter=all&page=3");
    });

    it("the first page offers 'Show 20 more'", async () => {
        renderPage();

        expect(await screen.findByRole("button", { name: "Show 20 more" })).toBeInTheDocument();
    });
});

describe("states", () => {
    it("a skeleton while the assets load", () => {
        m.assetsLoading = true;
        renderPage();

        expect(screen.getByTestId("tokens-loading")).toBeInTheDocument();
    });

    it("no Factory token at all: an empty state with a Create a token CTA", async () => {
        m.assets = NOT_FACTORY;
        renderPage();

        expect(await screen.findByText("No tokens yet.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Create a token/ }));
        expect(m.navigate).toHaveBeenCalledWith("/token/new");
    });

    it("the asset list failed: an error with Retry", async () => {
        m.assets = [];
        m.native = false;
        renderPage();

        expect(screen.getByText("Couldn't load the tokens.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(m.updateAssets).toHaveBeenCalled();
    });

    it("the denom rewards failed: every token still lists, as not stakable, A–Z", async () => {
        m.drs.mockRejectedValue(new Error("down"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        expect(await screen.findByTestId("tokens-stake-unknown")).toBeInTheDocument();
        expect(tickers("token-row")).toEqual(["GUILD", "HONEY", "PAGE", "VDL", "WAX"]);
    });
});

