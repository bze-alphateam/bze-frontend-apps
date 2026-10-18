import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, pools, balances, max spendable and
// the tx hook. The pool picker becomes a plain button per pool id; PayPanel has its own
// coverage.
const {
    queryParams, wallet, poolList, balances, maxSpendable, navigateMock, txMock, updatePoolsMock,
} = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    poolList: { current: [] as { id: string; base: string; quote: string; lp_denom: string; reserve_base: string; reserve_quote: string }[] },
    balances: { current: {} as Record<string, string> },
    maxSpendable: { current: {} as Record<string, string> },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    updatePoolsMock: vi.fn(),
}));

// 2,000 TOK + 1,000 BZE: 1 TOK = 0.5 BZE. 1,000,000 LP shares, the wallet holds 10%.
const TOK_BZE = {
    id: "utok_ubze", base: "utok", quote: "ubze", lp_denom: "ulp/tokbze",
    reserve_base: "2000000000", reserve_quote: "1000000000",
};
const OTHER = {
    id: "uoth_ubze", base: "uoth", quote: "ubze", lp_denom: "ulp/othbze",
    reserve_base: "1000000000", reserve_quote: "1000000000",
};
const HALTED = {
    id: "uhalt_ubze", base: "uhalt", quote: "ubze", lp_denom: "ulp/haltbze",
    reserve_base: "1000000", reserve_quote: "1000000",
};
const TOTAL_SHARES = "1000000";
const USER_SHARES = "100000";

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/components/guided/pay-panel", () => ({
    PayPanel: ({ rows, txKind }: { rows: { label: string; text?: string }[]; txKind?: string }) => (
        <div data-testid="pay-panel">{rows.map(r => `${r.label}: ${r.text}`).join(", ")} · {txKind}</div>
    ),
}));
vi.mock("@/components/pool-form/pool-picker", () => ({
    PoolPicker: ({ onSelect }: { onSelect: (p: { id: string }) => void }) => (
        <div>
            {poolList.current.map(p => <button key={p.id} onClick={() => onSelect(p)}>Pool: {p.id}</button>)}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
        uoth: { denom: "uoth", ticker: "OTH", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uhalt: { denom: "uhalt", ticker: "HALT", decimals: 6, logo: "", halted: true },
    };
    const { default: BN } = await import("bignumber.js");
    const toBn = (v?: string) => new BN(v ?? "0");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: toBn(balances.current[denom]) }, isLoading: false }),
        useMaxSpendable: (denom: string) => ({ amount: toBn(maxSpendable.current[denom]), isLoading: false }),
        useLiquidityPools: () => ({ pools: poolList.current, updateLiquidityPools: updatePoolsMock, isLoading: false }),
        useLiquidityPool: (poolId: string) => {
            const pool = poolList.current.find(p => p.id === poolId);
            const totalShares = toBn(TOTAL_SHARES);
            return {
                pool,
                totalShares,
                userShares: toBn(USER_SHARES),
                userSharesPercentage: "10.00",
                // The keeper's mint: the smaller of the two deposit ratios, times the shares.
                calculateSharesFromAmounts: (b: string, q: string) => {
                    if (!pool) return toBn(0);
                    const ratio = BN.minimum(toBn(b).div(pool.reserve_base), toBn(q).div(pool.reserve_quote));
                    return ratio.times(totalShares).integerValue(BN.ROUND_DOWN);
                },
            };
        },
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
    };
});

import PoolAddPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<PoolAddPage />, { wrapper });
const addButton = () => screen.getByRole("button", { name: "Add liquidity" });
const question = (title: string) => screen.getByRole("region", { name: title });
const POOL = "Which pool?";
const AMOUNTS = "How much to add?";
const PROTECTION = "Price protection";

const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));
const baseInput = () => within(question(AMOUNTS)).getByLabelText(/First token/);
const quoteInput = () => within(question(AMOUNTS)).getByLabelText(/Second token/);

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    poolList.current = [TOK_BZE, OTHER, HALTED];
    balances.current = { utok: "1000000000", uoth: "1000000000", ubze: "1000000000" };
    maxSpendable.current = { utok: "750000000", uoth: "1000000000", ubze: "999000000" };
    navigateMock.mockReset();
    updatePoolsMock.mockReset();
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: { txhash: string }) => void }) => {
        opts.onSuccess({ txhash: "HASH1" });
    });
});

describe("Make trading smoother (/pool/add)", { timeout: 20_000 }, () => {
    it("asks the three questions in order and signs MsgAddLiquidity with the min LP guard", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Make trading smoother" })).toBeInTheDocument();
        expect(screen.getByText("tradebin · add liquidity")).toBeInTheDocument();
        expect(question(POOL)).toHaveAttribute("data-state", "active");
        expect(question(AMOUNTS)).toHaveAttribute("data-state", "todo");
        expect(question(PROTECTION)).toHaveAttribute("data-state", "todo");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Factory fee: None · add-liquidity");

        await userEvent.click(screen.getByText("Pool: utok_ubze"));
        const facts = screen.getByRole("group", { name: "Pool facts" });
        expect(facts).toHaveTextContent("Pool reserves2,000 TOK + 1,000 BZE");
        expect(facts).toHaveTextContent("Pool price1 TOK = 0.500000 BZE");
        expect(facts).toHaveTextContent("Your share10.00%");
        await continueIn(POOL);
        expect(question(POOL)).toHaveAttribute("data-state", "done");
        expect(question(POOL)).toHaveTextContent("TOK/BZE");

        // Typing one side fills the other from the reserves.
        await userEvent.type(baseInput(), "100");
        expect(quoteInput()).toHaveValue("50");
        await continueIn(AMOUNTS);
        expect(question(AMOUNTS)).toHaveTextContent("100 TOK + 50 BZE");

        expect(within(question(PROTECTION)).getByRole("button", { name: "1%" })).toBeInTheDocument();
        expect(within(question(PROTECTION)).getByText(
            "If the price moves more than this before your deposit lands, it is cancelled and nothing is spent.",
        )).toBeInTheDocument();
        await userEvent.click(within(question(PROTECTION)).getByRole("button", { name: "3%" }));
        await continueIn(PROTECTION);
        expect(question(PROTECTION)).toHaveTextContent("3%");

        // 100/2000 of the pool → 50,000 shares; at least 48,500 after 3 %; (100k + 50k) / 1.05M.
        const outcome = screen.getByRole("region", { name: "What will happen" });
        expect(outcome).toHaveTextContent(/You receive about .+ LP tokens \(at least .+ after 3% price protection\)\./);
        expect(outcome).toHaveTextContent("Your share of the pool becomes 14.29%.");

        expect(addButton()).toBeEnabled();
        await userEvent.click(addButton());
        const [msgs] = txMock.mock.calls[0];
        expect(msgs).toEqual([{
            typeUrl: "/bze.tradebin.MsgAddLiquidity",
            value: {
                creator: "bze1me",
                poolId: "utok_ubze",
                baseAmount: "100000000",
                quoteAmount: "50000000",
                minLpTokens: "48500",
            },
        }]);
        expect(updatePoolsMock).toHaveBeenCalled();
        expect(screen.getByText("Liquidity added to TOK/BZE!")).toBeInTheDocument();
    });

    it("fills the base side when typing the quote side", async () => {
        queryParams.current = new URLSearchParams({ pool: "utok_ubze" });
        renderPage();
        expect(question(POOL)).toHaveAttribute("data-state", "done");
        expect(question(AMOUNTS)).toHaveAttribute("data-state", "active");
        await userEvent.type(quoteInput(), "1");
        expect(baseInput()).toHaveValue("2");
    });

    it("fills Max with the gas-aware spendable amount and balances the other side", async () => {
        queryParams.current = new URLSearchParams({ pool: "utok_ubze" });
        renderPage();
        await userEvent.click(within(question(AMOUNTS)).getByRole("button", { name: "Max TOK" }));
        expect(baseInput()).toHaveValue("750");
        expect(quoteInput()).toHaveValue("375");
        expect(within(question(AMOUNTS)).getByText("of 1,000 TOK")).toBeInTheDocument();
    });

    it("shows the balance error after blur and keeps Continue disabled", async () => {
        queryParams.current = new URLSearchParams({ pool: "utok_ubze" });
        balances.current = { utok: "1000000000", ubze: "10000000" };
        renderPage();
        await userEvent.type(baseInput(), "100");
        // The auto-filled BZE side (50) is over the 10 BZE balance; its error shows once it is left.
        await userEvent.click(quoteInput());
        await userEvent.tab();
        expect(within(question(AMOUNTS)).getByText("Amount exceeds your balance.")).toBeInTheDocument();
        expect(within(question(AMOUNTS)).getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("resets the amounts when another pool is picked", async () => {
        queryParams.current = new URLSearchParams({ pool: "utok_ubze" });
        renderPage();
        await userEvent.type(baseInput(), "100");
        await userEvent.click(within(question(POOL)).getByRole("button", { name: `Change ${POOL}` }));
        await userEvent.click(screen.getByText("Pool: uoth_ubze"));
        await continueIn(POOL);
        expect(baseInput()).toHaveValue("");
        expect(quoteInput()).toHaveValue("");
        expect(question(AMOUNTS)).toHaveAttribute("data-state", "active");
    });

    it("hides the form behind the halted notice for a halted pool deep link", () => {
        queryParams.current = new URLSearchParams({ pool: "uhalt_ubze" });
        renderPage();
        expect(screen.getByText(
            "New liquidity cannot be added to this pool. Remove your existing position from the DEX pool page.",
        )).toBeInTheDocument();
        expect(question(POOL)).toHaveAttribute("data-state", "active");
        expect(screen.queryByRole("region", { name: AMOUNTS })).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: PROTECTION })).not.toBeInTheDocument();
        expect(screen.queryByRole("group", { name: "Pool facts" })).not.toBeInTheDocument();
        expect(addButton()).toBeDisabled();
    });

    it("offers to create the first pool when there are none, carrying the return path", async () => {
        poolList.current = [];
        queryParams.current = new URLSearchParams({ return: "/manage/token?denom=utok", returnLabel: "TOK" });
        renderPage();
        expect(screen.getByText("No pools yet — create the first one.")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Create a pool" }));
        expect(navigateMock).toHaveBeenCalledWith(
            `/pool/new?${new URLSearchParams({ return: "/manage/token?denom=utok", returnLabel: "TOK" })}`,
        );
    });

    it("asks for a wallet before signing", async () => {
        wallet.address = undefined;
        queryParams.current = new URLSearchParams({ pool: "utok_ubze" });
        renderPage();
        await userEvent.type(baseInput(), "100");
        await continueIn(AMOUNTS);
        await continueIn(PROTECTION);
        expect(screen.getByText("Connect your wallet to add liquidity.")).toBeInTheDocument();
        expect(addButton()).toBeDisabled();
    });

    it("links the success panel onwards and keeps the pool for Add more liquidity", async () => {
        queryParams.current = new URLSearchParams({ pool: "utok_ubze", return: "/manage/token?denom=utok", returnLabel: "TOK" });
        renderPage();
        await userEvent.type(baseInput(), "100");
        await continueIn(AMOUNTS);
        await continueIn(PROTECTION);
        await userEvent.click(addButton());
        expect(screen.getByRole("link", { name: "DEX" })).toHaveAttribute("href", "https://dex.test/pools/details?id=utok_ubze");
        expect(screen.getByRole("link", { name: "DEX" })).toHaveAttribute("data-app", "dex");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
        expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute("data-app", "explorer");
        await userEvent.click(screen.getByRole("button", { name: /Reward liquidity providers/ }));
        expect(navigateMock).toHaveBeenCalledWith(
            `/reward/new?staking=ulp%2Ftokbze&${new URLSearchParams({ return: "/manage/token?denom=utok", returnLabel: "TOK" })}`,
        );

        await userEvent.click(screen.getByRole("button", { name: /Add more liquidity/ }));
        expect(question(POOL)).toHaveAttribute("data-state", "done");
        expect(question(POOL)).toHaveTextContent("TOK/BZE");
        expect(question(AMOUNTS)).toHaveAttribute("data-state", "active");
        expect(baseInput()).toHaveValue("");
        expect(quoteInput()).toHaveValue("");
    });
});
