import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The token page (BFE-271) off its chain hooks: the admin query, the asset list, the setup facts, the
// compounded reward and the simple rewards are mocked, so each admin state can be asserted on its own.
const m = vi.hoisted(() => ({
    navigate: vi.fn(),
    replace: vi.fn(),
    query: {} as Record<string, string | undefined>,
    address: "bze1owner" as string | undefined,
    admin: vi.fn<(denom: string) => Promise<string | undefined>>(),
    assets: [] as { denom: string; ticker: string; name: string; decimals: number; logo: string; supply: bigint; halted?: boolean }[],
    assetsLoading: false,
    setup: vi.fn(),
    denomReward: vi.fn(),
    stakingRewards: vi.fn(),
    pools: [] as Record<string, string>[],
    markets: [] as Record<string, string>[],
    raffles: [] as Record<string, unknown>[],
    registry: "not-listed",
    supplyDenoms: [] as string[],
}));

vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: m.navigate, replace: m.replace }),
    useNavigationWithParams: () => ({
        navigate: m.navigate,
        replace: m.replace,
        denomParam: m.query.denom ?? null,
        getQueryParam: (k: string) => m.query[k] ?? null,
    }),
}));
vi.mock("@/hooks/useTokenSupply", () => ({
    useTokenSupply: (denom: string) => {
        m.supplyDenoms.push(denom);
        return { supply: "4000000", isLoading: false, refresh: vi.fn() };
    },
}));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => m.setup() }));
vi.mock("@/hooks/useDenomReward", () => ({ useDenomReward: () => m.denomReward() }));
vi.mock("@/hooks/useStakingRewards", () => ({ useStakingRewards: () => m.stakingRewards() }));
vi.mock("@/hooks/useRegistryListing", () => ({ useRegistryListing: () => ({ status: m.registry, retry: vi.fn() }) }));
vi.mock("@/hooks/useTokenMetadata", () => ({ useTokenMetadata: () => ({ metadata: undefined, isLoading: false, refresh: vi.fn() }) }));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: vi.fn() }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@/components/manage/brand-kit-card", () => ({ BrandKitCard: ({ access }: { access: string }) => <div>brand kit {access}</div> }));
vi.mock("@/components/manage/metadata-card", () => ({ MetadataCard: ({ access }: { access: string }) => <div>metadata {access}</div> }));
vi.mock("@/components/workspace/lock-dialog", async (importActual) => ({
    ...(await importActual<typeof import("@/components/workspace/lock-dialog")>()),
    LockDialog: ({ open }: { open: boolean }) => (open ? <div>lock dialog</div> : null),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BigNumber } = await import("bignumber.js");
    const byDenom = (denom: string) => m.assets.find(a => a.denom === denom);
    return {
        ...actual,
        TokenLogo: () => null,
        getFactoryDenomAdmin: (denom: string) => m.admin(denom),
        useAssets: () => ({
            assets: m.assets,
            isLoading: m.assetsLoading,
            getAsset: byDenom,
            denomTicker: (d: string) => byDenom(d)?.ticker ?? d,
        }),
        useAsset: (denom: string) => ({ asset: byDenom(denom), isLoading: false }),
        useBalance: () => ({ balance: { amount: new BigNumber(1000000) } }),
        useMaxSpendable: () => ({ gasFee: { amount: new BigNumber(0) } }),
        useCreationFees: () => ({ denomRewardLimits: { maxPrizeDenomsPerDr: 5 } }),
        useToast: () => ({ toast: { success: vi.fn() } }),
        getCommunitiesApp: () => ({ href: "https://communities.example" }),
        getDexApp: () => ({ href: "https://dex.example" }),
        getBurnerApp: () => ({ href: "https://burner.example" }),
        getExplorerBaseURL: () => "https://explorer.example",
        useLiquidityPools: () => ({ pools: m.pools, isLoading: false }),
        useMarkets: () => ({ markets: m.markets, isLoading: false }),
        useEpochs: () => ({ hourEpochInfo: { current_epoch: 1n }, dayEpochInfo: { current_epoch: 10n } }),
        getRafflesOrThrow: async () => m.raffles,
    };
});

import TokenPage from "./page";

const OWNER = "bze1owner";
const OTHER = "bze1other";
const NEW_ADMIN = "bze1newadmin000000000000000000000000000";
const DENOM = `factory/${OWNER}/utok`;
const ENCODED = encodeURIComponent(DENOM);
const TOKEN_PAGE = `/tokens/token?denom=${ENCODED}`;
const BURNER_HREF = `https://burner.example/coin?coin=${ENCODED}`;
const TOK = { denom: DENOM, ticker: "TOK", name: "Tok Token", decimals: 6, logo: "", supply: 1000000n };
const BZE = { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "", supply: 1000000n };

const item = (key: string, state: string) => ({ key, title: key, detail: "", state, optional: false, href: "" });

const setup = (overrides: Record<string, unknown> = {}) => ({
    items: [item("created", "done"), item("pool", "todo"), item("holderRewards", "todo"), item("brandKit", "todo")],
    doneCount: 1,
    totalCount: 4,
    isLoading: false,
    hasError: false,
    refresh: vi.fn(),
    denomReward: undefined,
    pools: [],
    hasMarket: false,
    hasStakers: false,
    ...overrides,
});

const noDenomReward = () => ({ denomReward: undefined, schedules: [], prizes: [], isLoading: false, hasError: false, refresh: vi.fn() });

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<TokenPage />, { wrapper });

/** The page once the admin query answered (the Burn item is always there; the setup chips too). */
const renderSettled = async () => {
    renderPage();
    await waitFor(() => {
        expect(screen.queryByTestId("admin-item-loading")).not.toBeInTheDocument();
        expect(screen.queryByTestId("raffle-loading")).not.toBeInTheDocument();
    });
};

const returnOf = (href: string | null) => new URLSearchParams((href ?? "").split("?").slice(1).join("?"));

beforeEach(() => {
    vi.clearAllMocks();
    m.query = { denom: DENOM };
    m.address = OWNER;
    m.assets = [TOK, BZE];
    m.assetsLoading = false;
    m.admin.mockResolvedValue(OWNER);
    m.setup.mockReturnValue(setup());
    m.denomReward.mockReturnValue(noDenomReward());
    m.stakingRewards.mockReturnValue({ rewards: [], isLoading: false, hasError: false, refresh: vi.fn() });
    m.pools = [];
    m.markets = [];
    m.raffles = [];
    m.registry = "not-listed";
    m.supplyDenoms = [];
});

/** Every state: burning is the Burner AppLink, and the Factory has no burn form (epic decision 13). */
function expectBurnOnBurner() {
    const burn = screen.getByTestId("burn-item");
    expect(within(burn).getByText("Burn tokens")).toBeInTheDocument();
    expect(within(burn).getByRole("link", { name: /Burner/ })).toHaveAttribute("href", BURNER_HREF);
    expect(within(burn).getByRole("link", { name: /Burner/ })).toHaveAttribute("data-app", "burner");
    expect(screen.queryByText(/How many to burn/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Burn/ })).not.toBeInTheDocument();
}

describe("token page: the seven admin states", () => {
    it("your token, you are admin: mint, edit, Permissions with transfer and renounce", async () => {
        await renderSettled();
        expect(screen.getByTestId("owner-badge")).toHaveTextContent("Created by you · you are admin");
        expect(screen.getByRole("button", { name: "Mint" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Edit details" })).toBeInTheDocument();
        expect(within(screen.getByTestId("permissions-section")).getByRole("region", { name: "Renounce admin" })).toBeInTheDocument();
        expect(within(screen.getByTestId("permissions-section")).getByRole("region", { name: "Transfer admin" })).toBeInTheDocument();
        expect(within(screen.getByTestId("token-stats")).getByText("You hold")).toBeInTheDocument();
        expect(screen.queryByTestId("admin-unknown")).not.toBeInTheDocument();
        expectBurnOnBurner();
    });

    it("your token, admin given up: no admin actions, details frozen, Permissions says so", async () => {
        m.admin.mockResolvedValue("");
        await renderSettled();
        expect(screen.getByTestId("owner-badge")).toHaveTextContent("Created by you · admin given up");
        expect(within(screen.getByTestId("token-header")).getByText("Fixed supply")).toBeInTheDocument();
        expect(screen.queryByTestId("mint-item")).not.toBeInTheDocument();
        expect(screen.getByText(/Frozen: the admin was given up/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();
        expect(screen.getByTestId("control-locked")).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Renounce admin" })).not.toBeInTheDocument();
        expectBurnOnBurner();
    });

    it("your token, admin transferred: badge names the admin, no admin actions", async () => {
        m.admin.mockResolvedValue(NEW_ADMIN);
        await renderSettled();
        expect(screen.getByTestId("owner-badge")).toHaveTextContent(/^Created by you · admin is bze1ne/);
        expect(screen.queryByTestId("mint-item")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();
        expect(screen.getByTestId("control-not-admin")).toHaveTextContent(NEW_ADMIN);
        expectBurnOnBurner();
    });

    it("someone else's token: no badge, only what anyone can do", async () => {
        m.address = OTHER;
        await renderSettled();
        expect(screen.queryByTestId("owner-badge")).not.toBeInTheDocument();
        expect(screen.queryByTestId("mint-item")).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Renounce admin" })).not.toBeInTheDocument();
        // Permissionless actions are offered to everyone.
        expect(screen.getByRole("link", { name: "Start raffle" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Make TOK stakable" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Submit to registry" })).toBeInTheDocument();
        expect(within(screen.getByTestId("pair-item")).getByRole("link", { name: "Create" })).toBeInTheDocument();
        expectBurnOnBurner();
    });

    it("a wallet that was handed admin: You are admin, with the admin actions", async () => {
        m.address = NEW_ADMIN;
        m.admin.mockResolvedValue(NEW_ADMIN);
        await renderSettled();
        expect(screen.getByTestId("owner-badge")).toHaveTextContent("You are admin");
        expect(screen.getByRole("button", { name: "Mint" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Renounce admin" })).toBeInTheDocument();
        expectBurnOnBurner();
    });

    it("disconnected: no You hold, no badge, no admin actions", async () => {
        m.address = undefined;
        await renderSettled();
        expect(screen.queryByText("You hold")).not.toBeInTheDocument();
        expect(within(screen.getByTestId("token-stats")).getByText("Supply")).toBeInTheDocument();
        expect(screen.queryByTestId("owner-badge")).not.toBeInTheDocument();
        expect(screen.queryByTestId("mint-item")).not.toBeInTheDocument();
        expectBurnOnBurner();
    });

    it("admin query error: the notice with Retry, never shown as not admin", async () => {
        m.admin.mockResolvedValue(undefined);
        await renderSettled();
        expect(screen.getByTestId("admin-unknown")).toHaveTextContent(
            "Unable to verify admin permissions. Actions that need admin stay hidden until we know.",
        );
        expect(screen.queryByTestId("owner-badge")).not.toBeInTheDocument();
        expect(screen.queryByTestId("mint-item")).not.toBeInTheDocument();
        expect(within(screen.getByTestId("token-header")).getByText("Admin unknown")).toBeInTheDocument();
        expectBurnOnBurner();

        m.admin.mockResolvedValue(OWNER);
        await userEvent.click(within(screen.getByTestId("admin-unknown")).getByRole("button", { name: /Retry/ }));
        expect(await screen.findByRole("button", { name: "Mint" })).toBeInTheDocument();
        expect(screen.queryByTestId("admin-unknown")).not.toBeInTheDocument();
        expect(m.admin).toHaveBeenCalledTimes(2);
        expect(m.admin).toHaveBeenCalledWith(DENOM);
    });
});

describe("token page", () => {
    it("shows shimmers for the admin-only items while the admin query runs", () => {
        m.admin.mockReturnValue(new Promise(() => undefined));
        renderPage();
        expect(screen.getAllByTestId("admin-item-loading").length).toBeGreaterThan(0);
        expect(screen.queryByTestId("mint-item")).not.toBeInTheDocument();
        expect(screen.queryByTestId("owner-badge")).not.toBeInTheDocument();
        expectBurnOnBurner();
    });

    it("opens the mint form under its item for the admin", async () => {
        await renderSettled();
        await userEvent.click(screen.getByRole("button", { name: "Mint" }));
        expect(screen.getByTestId("mint-form")).toBeInTheDocument();
        await userEvent.type(screen.getByPlaceholderText("e.g. 1000"), "6");
        expect(screen.getByTestId("mint-sentence")).toHaveTextContent("New total supply 10 TOK.");
        expect(screen.getByRole("button", { name: "Mint 6 TOK" })).toBeEnabled();
    });

    it("an unknown denom gets the not-found state and queries nothing", () => {
        m.query = { denom: `factory/${OWNER}/missing` };
        renderPage();
        expect(screen.getByText("We couldn't find this token.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /All tokens/ })).toHaveAttribute("href", "/tokens");
        expect(m.admin).not.toHaveBeenCalled();
        expect(m.supplyDenoms).toEqual([]);
    });

    it("a token not made with Factory points to its DEX page", () => {
        m.query = { denom: "ubze" };
        renderPage();
        expect(screen.getByText("Only tokens made with Factory have a page here.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /DEX/ })).toHaveAttribute("href", "https://dex.example/assets/details?denom=ubze");
        expect(m.admin).not.toHaveBeenCalled();
    });

    it("ignores ?tab= and renders every group", async () => {
        m.query = { denom: DENOM, tab: "control" };
        await renderSettled();
        for (const name of ["Supply", "Details and look", "Trading", "Rewards on TOK", "Permissions"]) {
            expect(screen.getByRole("region", { name })).toBeInTheDocument();
        }
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("header: breadcrumb, denom, and the DEX, Communities and Explorer links", async () => {
        await renderSettled();
        const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
        expect(within(crumbs).getByRole("link", { name: "Tokens" })).toHaveAttribute("href", "/tokens");
        expect(crumbs).toHaveTextContent("TOK");
        expect(screen.getByText(DENOM)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /^DEX/ })).toHaveAttribute("href", `https://dex.example/assets/details?denom=${ENCODED}`);
        expect(screen.getByRole("link", { name: /Communities/ })).toHaveAttribute("href", `https://communities.example/token?denom=${ENCODED}`);
        expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", `https://explorer.example/tokens/${ENCODED}`);
    });

    it("setup chips: progress, links to their sections, Admin only for a non-admin", async () => {
        m.address = OTHER;
        await renderSettled();
        expect(screen.getByTestId("setup-progress")).toHaveTextContent("Getting there · 1 of 4");
        expect(screen.getByTestId("setup-chip-created")).toHaveAttribute("data-state", "done");
        expect(screen.getByTestId("setup-chip-pool")).toHaveAttribute("href", "#trading");
        expect(screen.getByTestId("setup-chip-holderRewards")).toHaveTextContent("Stakable");
        expect(screen.getByTestId("setup-chip-brandKit")).toHaveTextContent("Brand kit· Admin only");
    });

    it("group links carry the way back to this page", async () => {
        m.pools = [{ id: "p1", base: DENOM, quote: "ubze", lp_denom: "ulp_tok_ubze", reserve_base: "2000000", reserve_quote: "1000000", creator: OWNER }];
        await renderSettled();
        const hrefs = [
            screen.getByRole("link", { name: "Start raffle" }),
            screen.getByRole("link", { name: "Submit to registry" }),
            screen.getByRole("link", { name: "Reward LPs" }),
            within(screen.getByTestId("pair-item")).getByRole("link", { name: "Create" }),
            screen.getByRole("link", { name: "Make TOK stakable" }),
            within(screen.getByTestId("new-simple-reward")).getByRole("link", { name: "Create" }),
        ].map(link => link.getAttribute("href"));

        for (const href of hrefs) {
            expect(returnOf(href).get("return")).toBe(TOKEN_PAGE);
            expect(returnOf(href).get("returnLabel")).toBe("TOK");
        }
        expect(hrefs[0]).toMatch(/^\/raffle\/new\?denom=/);
        expect(hrefs[1]).toMatch(/^\/official\?denom=/);
        expect(hrefs[2]).toMatch(/^\/reward\/new\?staking=ulp_tok_ubze&/);
        expect(hrefs[3]).toMatch(new RegExp(`^/create/market\\?base=${ENCODED}&`));
        expect(hrefs[4]).toMatch(new RegExp(`^/denom-reward/new\\?denom=${ENCODED}&`));
        expect(hrefs[5]).toMatch(new RegExp(`^/reward/new\\?staking=${ENCODED}&`));
    });

    it("trading: a pool with its price, You created it, DEX; a halted token gets no create buttons", async () => {
        m.pools = [{ id: "p1", base: DENOM, quote: "ubze", lp_denom: "ulp_tok_ubze", reserve_base: "2000000", reserve_quote: "1000000", creator: OWNER }];
        m.markets = [{ base: "ubze", quote: DENOM, creator: OTHER }];
        const { unmount } = render(<TokenPage />, { wrapper });
        await waitFor(() => expect(screen.queryByTestId("raffle-loading")).not.toBeInTheDocument());
        const pool = screen.getByTestId("trading-pool-p1");
        expect(pool).toHaveTextContent("TOK/BZE pool");
        expect(pool).toHaveTextContent("You created it");
        expect(pool).toHaveTextContent("1 TOK = 0.500000 BZE · 2 TOK + 1 BZE in the pool");
        expect(within(pool).getByRole("link", { name: /DEX/ })).toHaveAttribute("href", "https://dex.example/pools/details?id=p1");
        const market = screen.getByTestId(`trading-market-ubze/${DENOM}`);
        expect(market).not.toHaveTextContent("You created it");
        unmount();

        m.assets = [{ ...TOK, halted: true }, BZE];
        await renderSettled();
        expect(screen.queryByTestId("pair-item")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Reward LPs" })).not.toBeInTheDocument();
        expect(screen.queryByTestId("raffle-item")).not.toBeInTheDocument();
    });

    it("rewards: the compounded reward's daily prizes, actions and details; airdrop off while nothing is staked", async () => {
        m.denomReward.mockReturnValue({
            ...noDenomReward(),
            denomReward: { denom: DENOM, staked_amount: "0", lock: 5, min_stake: "0" },
            schedules: [{ schedule_id: "s1", prize_denom: "ubze", daily_amount: "50000000", duration: 30, payouts: 27 }],
            prizes: [{ prize_denom: "ubze", last_distribution_epoch: "9" }],
        });
        await renderSettled();
        expect(screen.getByTestId("daily-prize-line")).toHaveTextContent("50 BZE a day · ends in 3 days");
        expect(returnOf(within(screen.getByTestId("daily-prize-line")).getByRole("link", { name: "Extend prize" }).getAttribute("href")).get("return")).toBe(TOKEN_PAGE);
        expect(screen.getByRole("link", { name: "Add daily prize" })).toHaveAttribute("href", expect.stringMatching(/^\/denom-reward\/schedule\?denom=/));
        expect(screen.getByRole("button", { name: "Airdrop to stakers" })).toBeDisabled();
        expect(screen.queryByRole("link", { name: "Make TOK stakable" })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Details" }));
        expect(screen.getByTestId("holder-prize-slots")).toHaveTextContent("1 of 5");
        expect(screen.getByTestId("holder-prize")).toHaveTextContent("Last paid");
    });

    it("rewards: airdrop links to its wizard once someone stakes; simple rewards on the token have Extend", async () => {
        m.denomReward.mockReturnValue({
            ...noDenomReward(),
            denomReward: { denom: DENOM, staked_amount: "5000000", lock: 5, min_stake: "0" },
        });
        m.pools = [{ id: "p1", base: DENOM, quote: "ubze", lp_denom: "ulp_tok_ubze", reserve_base: "1", reserve_quote: "1", creator: OTHER }];
        m.stakingRewards.mockReturnValue({
            rewards: [
                { reward_id: "000000000001", staking_denom: DENOM, prize_denom: "ubze", prize_amount: "1000000", duration: 10, payouts: 4 },
                { reward_id: "000000000002", staking_denom: "ulp_tok_ubze", prize_denom: "ubze", prize_amount: "1000000", duration: 10, payouts: 10 },
                // Pays out in TOK but stakes something else: not on the page.
                { reward_id: "000000000003", staking_denom: "ubze", prize_denom: DENOM, prize_amount: "1000000", duration: 10, payouts: 1 },
            ],
            isLoading: false,
            hasError: false,
            refresh: vi.fn(),
        });
        await renderSettled();
        expect(screen.getByRole("link", { name: "Airdrop to stakers" })).toHaveAttribute("href", expect.stringMatching(/^\/denom-reward\/airdrop\?denom=/));
        const rows = screen.getAllByTestId("simple-reward-row");
        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getByRole("link", { name: "Extend" })).toHaveAttribute("href", expect.stringMatching(/^\/reward\/extend\?id=000000000001&return=/));
        expect(rows[1]).toHaveTextContent("Finished · all 10 paid");
    });

    it("a running raffle shows its figures and the Burner link instead of Start raffle", async () => {
        m.raffles = [{ denom: DENOM, pot: "5000000", ticket_price: "1000000", chances: 10, ratio: "0.5", end_at: 10n }];
        await renderSettled();
        expect(await screen.findByTestId("raffle-running")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Start raffle" })).not.toBeInTheDocument();
        expect(within(screen.getByTestId("raffle-item")).getByRole("link", { name: /Burner/ })).toHaveAttribute("href", BURNER_HREF);
    });
});
