import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, markets, pools, fees, the fee engine and
// the wallet side of the tx (useFactoryTx). The wizard's tx hook, the pending-tx store, the Review
// step and the Done screen are real. The asset picker becomes a plain button per denom; PayPanel
// has its own coverage.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};
const {
    queryParams, wallet, existingMarkets, existingPools, feeState, payment,
    navigateMock, txMock, updateMarketsMock,
} = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    existingMarkets: { current: new Set<string>() },
    existingPools: { current: new Map<string, { id: string; base: string; quote: string }>() },
    feeState: { fee: { denom: "ubze", amount: "25000000" } as { denom: string; amount: string } | undefined, isLoading: false },
    payment: { canPayFee: true, gasAmount: "0" },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    updateMarketsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/market/new",
    useSearchParams: () => queryParams.current,
}));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({
        paysWithAlt: false,
        canPayFee: payment.canPayFee,
        isLoading: false,
        method: payment.canPayFee ? "native" : "insufficient",
        gasFee: {
            denom: "ubze",
            amount: new BigNumber(payment.gasAmount),
            displayAmount: new BigNumber(payment.gasAmount).div(1e6),
            ticker: "BZE",
            isLoading: false,
        },
    }),
}));
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, feeUnknown }: { rows: { label: string; coin?: { amount: string } }[]; feeUnknown?: boolean }) => (
        <div data-testid="pay-panel">{feeUnknown ? "fee unknown" : rows.map(r => `${r.label}: ${r.coin?.amount}`).join(", ")}</div>
    ),
}));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ label, onSelect }: { label: string; onSelect: (a: { denom: string }) => void }) => (
        <div>
            <span>{label}</span>
            {["utok", "ubze", "uhalt"].map(d => <button key={d} onClick={() => onSelect({ denom: d })}>{label}: {d}</button>)}
        </div>
    ),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uhalt: { denom: "uhalt", ticker: "HALT", decimals: 6, logo: "", halted: true },
    };
    const { default: BN } = await import("bignumber.js");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: new BN("1000000000") }, isLoading: false }),
        useAssetPrice: () => ({
            hasPrice: false,
            totalUsdValue: () => new BN(0),
            uAmountUsdValue: () => new BN(0),
        }),
        useMarkets: () => ({
            marketExists: (id: string) => existingMarkets.current.has(id),
            updateMarkets: updateMarketsMock,
            isLoading: false,
        }),
        useLiquidityPools: () => ({
            getDenomsPool: (a: string, b: string) => existingPools.current.get(actual.createPoolId(a, b)),
            isLoading: false,
        }),
        useCreationFees: () => ({ fees: { createMarketFee: feeState.fee }, isLoading: feeState.isLoading }),
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import MarketNewPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<MarketNewPage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const createButton = () => button(step("Review"), "Create market");
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];
const marketUrl = (id: string) => `https://dex.test/exchange/market?id=${encodeURIComponent(id)}`;

async function answerPair(base = "utok", quote = "ubze") {
    await userEvent.click(within(step("Pair")).getByText(`Base token: ${base}`));
    await userEvent.click(within(step("Pair")).getByText(`Quote token: ${quote}`));
    await userEvent.click(button(step("Pair"), "Continue"));
}

/** The wallet signs and the chain includes the tx. */
function txSucceeds() {
    txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
        opts.onBroadcast?.("HASH1");
        opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
        return true;
    });
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    existingMarkets.current = new Set();
    existingPools.current = new Map();
    feeState.fee = { denom: "ubze", amount: "25000000" };
    feeState.isLoading = false;
    payment.canPayFee = true;
    payment.gasAmount = "0";
    navigateMock.mockReset();
    updateMarketsMock.mockReset();
    txMock.mockReset();
    txSucceeds();
    // A pending hash is looked up on the chain's REST: never reach the network.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

describe("Create an order-book market (/market/new)", { timeout: 20_000 }, () => {
    it("shows the two steps with Pair open, and the market fee", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Create an order-book market" })).toBeInTheDocument();
        expect(screen.queryByText("tradebin · order-book market")).not.toBeInTheDocument();
        expect(step("Pair")).toHaveAttribute("data-state", "active");
        expect(within(step("Pair")).getByText("Step 1 of 2 ·", { exact: false })).toBeInTheDocument();
        expect(within(step("Pair")).getByRole("heading", { name: "Which pair?" })).toBeInTheDocument();
        expect(within(step("Pair")).queryByText("Orders are priced in the quote token, e.g. HONEY priced in BZE.")).not.toBeInTheDocument();
        expect(step("Review")).toHaveAttribute("data-state", "todo");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Creation fee: 25000000");
        expect(screen.queryByRole("region", { name: "What will happen" })).not.toBeInTheDocument();
        expect(screen.queryByText("Creating a market doesn't make you its owner. Anyone can trade on it.")).not.toBeInTheDocument();
    });

    describe("Pair", () => {
        it("waits for Continue, then summarises the pair as base priced in quote", async () => {
            renderPage();
            await userEvent.click(within(step("Pair")).getByText("Base token: utok"));
            await userEvent.click(within(step("Pair")).getByText("Quote token: ubze"));
            expect(step("Pair")).toHaveAttribute("data-state", "active");
            await userEvent.click(button(step("Pair"), "Continue"));
            expect(step("Pair")).toHaveAttribute("data-state", "done");
            expect(step("Pair")).toHaveTextContent("TOK priced in BZE");
            expect(step("Review")).toHaveAttribute("data-state", "active");
            expect(screen.queryByTestId("outcome")).not.toBeInTheDocument();
        });

        it("rejects the same token on both sides of a deep link and keeps the step open", () => {
            queryParams.current = new URLSearchParams({ base: "ubze", quote: "ubze" });
            renderPage();
            expect(step("Pair")).toHaveAttribute("data-state", "active");
            expect(screen.getByRole("alert")).toHaveTextContent("Pick two different tokens.");
            expect(button(step("Pair"), "Continue")).toBeDisabled();
        });

        it("rejects a halted token", () => {
            queryParams.current = new URLSearchParams({ base: "uhalt", quote: "ubze" });
            renderPage();
            expect(screen.getByRole("alert")).toHaveTextContent(/HALT is no longer tradeable on BZE/);
            expect(button(step("Pair"), "Continue")).toBeDisabled();
        });

        it.each([
            ["A/B, as picked", "utok/ubze"],
            ["B/A, the other way round", "ubze/utok"],
        ])("blocks a pair whose market exists (%s) with a DEX link in the market's real direction", (_name, existingId) => {
            existingMarkets.current = new Set([existingId]);
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            expect(step("Pair")).toHaveAttribute("data-state", "active");
            expect(screen.getByRole("alert")).toHaveTextContent("This pair already has a market.");
            const link = screen.getByRole("link", { name: /Open it on the DEX/ });
            expect(link).toHaveAttribute("href", marketUrl(existingId));
            expect(link).toHaveAttribute("data-app", "dex");
            expect(button(step("Pair"), "Continue")).toBeDisabled();
        });

        it("lands on Review when the deep link names a valid pair", () => {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            expect(step("Pair")).toHaveAttribute("data-state", "done");
            expect(step("Review")).toHaveAttribute("data-state", "active");
        });

        it("reopens the pair with Edit, and a halted pick keeps it open", async () => {
            renderPage();
            await answerPair();
            await userEvent.click(screen.getByRole("button", { name: "Edit Pair" }));
            expect(step("Pair")).toHaveAttribute("data-state", "active");
            await userEvent.click(within(step("Pair")).getByText("Base token: uhalt"));
            expect(button(step("Pair"), "Continue")).toBeDisabled();
        });
    });

    describe("Review", () => {
        it("lists the fee and the network fee, the order book and what is permanent, then signs the pair in the user's order", async () => {
            payment.gasAmount = "4000";
            renderPage();
            // ubze < utok alphabetically: the message must keep the user's order, not sort it.
            await answerPair("utok", "ubze");

            const review = step("Review");
            const leaves = within(review).getByRole("region", { name: "You pay" });
            expect(leaves).toHaveTextContent(/Creation fee\s*BZE\s*25 BZE/);
            expect(leaves).toHaveTextContent("Network fee≈ 0.004000 BZE");
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("Order-book marketTOK/BZE");
            expect(within(review).getByRole("region", { name: "Permanent" })).toHaveTextContent("This action can't be undone");
            expect(within(review).queryByText("A new market is empty. Nothing trades until people place orders. Pairs with a pool usually fill faster.")).not.toBeInTheDocument();

            await userEvent.click(createButton());
            expect(sentMsgs()).toEqual([{
                typeUrl: "/bze.tradebin.MsgCreateMarket",
                value: { creator: "bze1me", base: "utok", quote: "ubze" },
            }]);
        });

        it("explains a missing wallet", () => {
            wallet.address = undefined;
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            expect(createButton()).toBeDisabled();
            expect(screen.getByText("Connect your wallet.")).toBeInTheDocument();
        });

        it("blocks when the fee can't be paid", () => {
            payment.canPayFee = false;
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            expect(screen.getByText("Not enough BZE: you hold 1,000 BZE.")).toBeInTheDocument();
            expect(createButton()).toBeDisabled();
        });

        it("blocks when the fee could not be loaded", () => {
            feeState.fee = undefined;
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("fee unknown");
            expect(within(step("Review")).getByText("Could not load the current fee from the chain. Please refresh and try again.")).toBeInTheDocument();
            expect(createButton()).toBeDisabled();
        });

        it("keeps the answers when the wallet declines", async () => {
            txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
                opts.onFailure?.("Request rejected", { stage: "sign" });
                return false;
            });
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "You declined in the wallet" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Edit answers" }));
            expect(step("Pair")).toHaveTextContent("TOK priced in BZE");
            expect(createButton()).toBeEnabled();
        });
    });

    describe("Done", () => {
        async function createMarket() {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        }

        it("shows the open market, its links and only opening it on the DEX next", async () => {
            await createMarket();

            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The TOK/BZE market is open.");
            expect(screen.queryByText("Anyone can place buy and sell orders for TOK priced in BZE.")).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Copy market link" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
            expect(updateMarketsMock).toHaveBeenCalled();

            const recommended = screen.getByTestId("done-recommended");
            expect(recommended).toHaveTextContent("Open the market on DEX");
            expect(within(recommended).getByRole("link", { name: /Open market on DEX/ })).toHaveAttribute("href", marketUrl("utok/ubze"));
            expect(screen.queryByTestId("done-more")).not.toBeInTheDocument();
        });

        it("offers the way back to the token it was opened from", async () => {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze", return: "/tokens/token?denom=utok&tab=trading", returnLabel: "TOK" });
            renderPage();
            await userEvent.click(createButton());
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The TOK/BZE market is open.");
            await userEvent.click(screen.getByRole("button", { name: "Back to TOK" }));
            expect(navigateMock).toHaveBeenLastCalledWith("/tokens/token?denom=utok&tab=trading");
        });
    });
});
