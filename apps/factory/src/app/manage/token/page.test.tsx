import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The workspace shell off its data hooks: the tab contents that sign txs are stubbed, the
// checklist hook is mocked (it has its own tests), so this asserts routing, header and states.
const m = vi.hoisted(() => ({
    navigate: vi.fn(),
    replace: vi.fn(),
    query: {} as Record<string, string | undefined>,
    tokens: vi.fn(),
    refreshAdmins: vi.fn(),
    setup: vi.fn(),
    address: "bze1owner" as string | undefined,
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
vi.mock("@/hooks/useMyTokens", () => ({
    useMyTokens: () => ({ tokens: m.tokens(), isLoading: false, refreshAdmins: m.refreshAdmins }),
}));
vi.mock("@/hooks/useTokenSupply", () => ({
    useTokenSupply: (denom: string) => {
        m.supplyDenoms.push(denom);
        return { supply: "4000000", isLoading: false, refresh: vi.fn() };
    },
}));
vi.mock("@/hooks/useTokenSetup", () => ({ useTokenSetup: () => m.setup() }));
vi.mock("@/hooks/useTokenMetadata", () => ({ useTokenMetadata: () => ({ metadata: undefined, isLoading: false, refresh: vi.fn() }) }));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: m.address }) }));
vi.mock("@/components/manage/denom-reward-card", () => ({ DenomRewardCard: () => <div>denom reward card</div> }));
vi.mock("@/components/rewards/staking-programs-list", () => ({
    StakingProgramsList: ({ involving, newProgramHref }: { involving?: string; newProgramHref?: string }) => (
        <div data-testid="staking-programs" data-involving={involving} data-new-href={newProgramHref} />
    ),
}));
vi.mock("@/components/manage/brand-kit-card", () => ({ BrandKitCard: ({ access }: { access: string }) => <div>brand kit {access}</div> }));
vi.mock("@/components/manage/metadata-card", () => ({ MetadataCard: () => <div>metadata card</div> }));
vi.mock("@/components/manage/admin-card", () => ({ AdminActions: () => <div>admin actions</div> }));
vi.mock("@/components/workspace/supply-action-card", () => ({
    SupplyActionCard: ({ mode }: { mode: string }) => <div>supply {mode}</div>,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BigNumber } = await import("bignumber.js");
    return {
        ...actual,
        TokenLogo: () => null,
        useBalance: () => ({ balance: { amount: new BigNumber(1000000) } }),
        useToast: () => ({ toast: { success: vi.fn() } }),
        getCommunitiesApp: () => ({ href: "https://communities.example" }),
        getDexApp: () => ({ href: "https://dex.example" }),
        getBurnerApp: () => ({ href: "https://burner.example" }),
    };
});

const DENOM = "factory/bze1owner/utok";
const ENCODED = "factory%2Fbze1owner%2Futok";

import ManageTokenPage from "./page";

const token = (admin: string | undefined) => ({
    asset: { denom: DENOM, ticker: "TOK", name: "Tok Token", decimals: 6, logo: "", supply: 1000000n },
    admin,
});

const setup = (overrides: Record<string, unknown> = {}) => ({
    items: [
        { key: "created", title: "Token created", detail: "4 TOK", state: "done", optional: false, href: "" },
        {
            key: "pool", title: "Liquidity pool", detail: "", state: "todo", optional: false, href: "/pool/new",
            action: { label: "Create", href: "/pool/new?base=x" },
        },
        {
            key: "description", title: "Description", detail: "", state: "todo", optional: false, href: "",
            action: { label: "Add", href: `/manage/token?denom=${ENCODED}&tab=profile` },
        },
    ],
    doneCount: 1,
    totalCount: 3,
    isLoading: false,
    hasError: false,
    refresh: vi.fn(),
    denomReward: undefined,
    pools: [],
    hasMarket: false,
    hasStakers: false,
    ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<ManageTokenPage />, { wrapper });

beforeEach(() => {
    vi.clearAllMocks();
    m.query = { denom: DENOM };
    m.address = "bze1owner";
    m.supplyDenoms = [];
    m.tokens.mockReturnValue([token("bze1owner")]);
    m.setup.mockReturnValue(setup());
});

describe("token workspace", () => {
    it("shows the not-found state for a token that isn't the wallet's", () => {
        m.tokens.mockReturnValue([]);
        renderPage();
        expect(screen.getByText("Token not found")).toBeInTheDocument();
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
        // No chain query for a denom that is never shown.
        expect(m.supplyDenoms.every(d => d === "")).toBe(true);
    });

    it("reads the live supply of the wallet's own token", () => {
        renderPage();
        expect(m.supplyDenoms).toContain(DENOM);
    });

    it.each([undefined, "bogus"])("opens the Overview for ?tab=%s", async (tab) => {
        m.query.tab = tab;
        renderPage();
        expect(await screen.findByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument();
        expect(screen.getByTestId("setup-progress")).toHaveTextContent("1 of 3 done. Read from the chain, so it stays current.");
    });

    it("opens the tab in ?tab= and switches tabs with replace", async () => {
        m.query.tab = "control";
        renderPage();
        expect(await screen.findByText("admin actions")).toBeInTheDocument();
        expect(screen.queryByTestId("setup-progress")).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("tab", { name: "Supply" }));
        expect(m.replace).toHaveBeenCalledWith(`/manage/token?denom=${ENCODED}&tab=supply`);
        expect(m.navigate).not.toHaveBeenCalled();
    });

    it("links the header to the Communities page and the DEX with the denom encoded", () => {
        renderPage();
        expect(screen.getByRole("link", { name: "Communities page" })).toHaveAttribute(
            "href", `https://communities.example/token?denom=${ENCODED}`,
        );
        expect(screen.getByRole("link", { name: "DEX" })).toHaveAttribute(
            "href", `https://dex.example/assets/details?denom=${ENCODED}`,
        );
    });

    it.each([
        ["bze1owner", "You are admin", "Mintable"],
        ["bze1newadmin000000000000000000000", "Control was handed to", "Mintable"],
        ["", "Locked forever", "Fixed supply"],
        [undefined, "Couldn't load the admin", "Admin unknown"],
    ])("shows the status line for admin %s", (admin, status, badge) => {
        m.tokens.mockReturnValue([token(admin)]);
        renderPage();
        expect(screen.getByTestId("workspace-status")).toHaveTextContent(status);
        expect(screen.getByText(badge)).toBeInTheDocument();
    });

    it("checklist actions: a workspace link switches the tab, any other link navigates", async () => {
        renderPage();
        await userEvent.click(within(screen.getByTestId("setup-item-description")).getByRole("button", { name: "Add" }));
        expect(m.replace).toHaveBeenCalledWith(`/manage/token?denom=${ENCODED}&tab=profile`);
        await userEvent.click(within(screen.getByTestId("setup-item-pool")).getByRole("button", { name: "Create" }));
        expect(m.navigate).toHaveBeenCalledWith("/pool/new?base=x");
    });

    describe("quick actions", () => {
        it("the admin can mint; no airdrop without stakers", () => {
            renderPage();
            expect(screen.getByRole("button", { name: "Mint more TOK" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Burn TOK" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Start a staking program" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Airdrop to stakers" })).not.toBeInTheDocument();
        });

        it("someone else's admin: no mint", () => {
            m.tokens.mockReturnValue([token("bze1other")]);
            renderPage();
            expect(screen.queryByRole("button", { name: "Mint more TOK" })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Burn TOK" })).toBeInTheDocument();
        });

        it("airdrop with stakers, opened with a way back to the Rewards tab", async () => {
            m.setup.mockReturnValue(setup({ hasStakers: true, denomReward: { staked_amount: "10" } }));
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Airdrop to stakers" }));
            expect(m.navigate).toHaveBeenCalledWith(
                `/denom-reward/airdrop?denom=${ENCODED}&return=%2Fmanage%2Ftoken%3Fdenom%3D${encodeURIComponent(ENCODED)}%26tab%3Drewards&returnLabel=TOK`,
            );
        });

        it("starts a staking program for the token", async () => {
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Start a staking program" }));
            expect(m.navigate.mock.calls[0][0]).toMatch(new RegExp(`^/reward/new\\?staking=${ENCODED}&return=`));
        });
    });

    describe("control callout", () => {
        it("admin: explains the lock and opens Control", async () => {
            renderPage();
            const callout = screen.getByTestId("control-callout");
            expect(callout).toHaveTextContent("Buyers see TOK as Mintable. You can still mint more.");
            expect(callout).toHaveTextContent("It can't be undone.");
            await userEvent.click(within(callout).getByRole("button", { name: "Open Control →" }));
            expect(m.replace).toHaveBeenCalledWith(`/manage/token?denom=${ENCODED}&tab=control`);
        });

        it("locked: supply provably fixed", () => {
            m.tokens.mockReturnValue([token("")]);
            renderPage();
            expect(screen.getByTestId("control-callout")).toHaveTextContent("Supply provably fixed");
        });

        it("not admin: no callout", () => {
            m.tokens.mockReturnValue([token("bze1other")]);
            renderPage();
            expect(screen.queryByTestId("control-callout")).not.toBeInTheDocument();
        });
    });

    describe("today's cards in their tabs", () => {
        it("supply: mint and burn for the admin, burner link for everyone", () => {
            m.query.tab = "supply";
            renderPage();
            expect(screen.getByText("supply mint")).toBeInTheDocument();
            expect(screen.getByText("supply burn")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /Burn in Burner dApp/ })).toBeInTheDocument();
        });

        it("supply: no mint or burn when locked", () => {
            m.query.tab = "supply";
            m.tokens.mockReturnValue([token("")]);
            renderPage();
            expect(screen.queryByText("supply mint")).not.toBeInTheDocument();
            expect(screen.getByText("Nobody — renounced")).toBeInTheDocument();
        });

        it.each([
            ["bze1owner", ["metadata card", "brand kit admin"]],
            ["", ["brand kit renounced"]],
            ["bze1other", ["brand kit not-admin"]],
        ])("profile for admin %s", (admin, shown) => {
            m.query.tab = "profile";
            m.tokens.mockReturnValue([token(admin)]);
            renderPage();
            shown.forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
            if (admin !== "bze1owner") expect(screen.queryByText("metadata card")).not.toBeInTheDocument();
        });

        it("rewards: the denom reward card in every state", () => {
            m.query.tab = "rewards";
            m.tokens.mockReturnValue([token("bze1other")]);
            renderPage();
            expect(screen.getByText("denom reward card")).toBeInTheDocument();
        });

        it("rewards: the staking programs with the token, whose New program comes back here", () => {
            m.query.tab = "rewards";
            m.tokens.mockReturnValue([token("bze1other")]);
            renderPage();
            const section = screen.getByRole("region", { name: "Staking programs with TOK" });
            expect(within(section).getByText("Programs where people stake TOK or a TOK LP token, or earn TOK.")).toBeInTheDocument();
            const list = within(section).getByTestId("staking-programs");
            expect(list).toHaveAttribute("data-involving", DENOM);
            expect(list).toHaveAttribute(
                "data-new-href",
                `/reward/new?staking=${ENCODED}&return=%2Fmanage%2Ftoken%3Fdenom%3D${encodeURIComponent(ENCODED)}%26tab%3Drewards&returnLabel=TOK`,
            );
        });

        it.each([
            ["", "Supply provably fixed"],
            ["bze1other", "its admin is now bze1other"],
            [undefined, "The chain query for this token.s admin failed"],
        ])("control for admin %s", async (admin, text) => {
            m.query.tab = "control";
            m.tokens.mockReturnValue([token(admin)]);
            renderPage();
            expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
            expect(screen.queryByText("admin actions")).not.toBeInTheDocument();
            if (admin === undefined) {
                await userEvent.click(screen.getByRole("button", { name: "Retry" }));
                expect(m.refreshAdmins).toHaveBeenCalled();
            }
        });

        it("trading: create a pool or a market for the token", async () => {
            m.query.tab = "trading";
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Create a liquidity pool" }));
            expect(m.navigate.mock.calls[0][0]).toMatch(new RegExp(`^/pool/new\\?base=${ENCODED}&return=`));
            await userEvent.click(screen.getByRole("button", { name: "Create an order-book market" }));
            expect(m.navigate.mock.calls[1][0]).toMatch(new RegExp(`^/market/new\\?base=${ENCODED}&return=`));
        });
    });
});
