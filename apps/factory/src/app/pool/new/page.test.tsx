import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, pools, fees, balances, ui-kit's fee engine
// (useFeeEstimate, a fake that follows the chain's rule: fee token first, BZE fallback) and the
// wallet side of the tx (useFactoryTx). useFeePayment, the wizard's tx hook, the pending-tx store,
// the Review step and the Done screen are real. The asset picker becomes a plain button per denom; PayPanel
// and the fee split slider have their own coverage.
type TxOpts = {
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (reason: string, details?: { stage: string }) => void;
};
const {
    queryParams, wallet, existingPools, feeState, balances, maxSpendable, payment,
    navigateMock, txMock, updatePoolsMock, getLiquidityPoolMock,
} = vi.hoisted(() => ({
    queryParams: { current: new URLSearchParams() },
    wallet: { address: "bze1me" as string | undefined },
    existingPools: { current: new Map<string, { id: string }>() },
    feeState: { fee: { denom: "ubze", amount: "25000000" } as { denom: string; amount: string } | undefined, isLoading: false },
    balances: { current: {} as Record<string, string> },
    maxSpendable: { current: {} as Record<string, string> },
    // altDenom: the Settings fee token (gas is paid in it too), altAmount: the fee converted to it
    payment: { altDenom: undefined as string | undefined, altAmount: "0", gasAmount: "0" },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    updatePoolsMock: vi.fn(),
    getLiquidityPoolMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/pool/new",
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
vi.mock("@/components/guided/pay-panel", async (importActual) => ({
    ...await importActual<typeof import("@/components/guided/pay-panel")>(),
    PayPanel: ({ rows, footer }: { rows: { label: string; coin?: { amount: string } }[]; footer?: ReactNode }) => (
        <div data-testid="pay-panel">
            {rows.map(r => `${r.label}: ${r.coin?.amount}`).join(", ")}
            {footer}
        </div>
    ),
}));
vi.mock("@/components/pool-form/fee-split-slider", async (importActual) => ({
    ...(await importActual<typeof import("@/components/pool-form/fee-split-slider")>()),
    FeeSplitSlider: ({ onChange }: { onChange: (s: { providers: number; burner: number; treasury: number }) => void }) => (
        <button onClick={() => onChange({ providers: 50, burner: 25, treasury: 25 })}>split 50/25/25</button>
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
    const toBn = (v?: string) => new BN(v ?? "0");
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useBalance: (denom: string) => ({ balance: { denom, amount: toBn(balances.current[denom]) }, isLoading: false }),
        useMaxSpendable: (denom: string) => ({ amount: toBn(maxSpendable.current[denom]), isLoading: false }),
        useBalances: () => ({
            getBalanceByDenom: (denom: string) => ({ denom, amount: toBn(balances.current[denom]) }),
            isLoading: false,
        }),
        useAssets: () => ({
            denomTicker: (denom: string) => assets[denom]?.ticker ?? denom,
            denomDecimals: (denom: string) => assets[denom]?.decimals ?? 6,
        }),
        useGasFeeEstimate: (spec?: unknown) => {
            const denom = payment.altDenom ?? "ubze";
            const amount = spec === undefined ? new BN(0) : toBn(payment.gasAmount);
            return {
                denom,
                amount,
                displayAmount: amount.div(1e6),
                ticker: assets[denom]?.ticker ?? denom,
                estimate: spec === undefined ? undefined : { denom, amount, gas: new BN(200000), nativeAmount: amount, isNative: denom === "ubze" },
                isNative: denom === "ubze",
                isLoading: false,
            };
        },
        // The chain's CaptureAndSwapUserFee: the fee token when what is left of it covers the
        // converted fee, else the native fee, else nothing.
        useFeeEstimate: (fee?: { denom: string; amount: string }, opts: { gasFee?: { denom: string; amount: BigNumber }; reserved?: { denom: string; amount: string }[] } = {}) => {
            const taken = [...(opts.reserved ?? []), ...(opts.gasFee ? [opts.gasFee] : [])];
            const left = (denom: string) => taken
                .filter(c => c.denom === denom)
                .reduce((b, c) => b.minus(c.amount), toBn(balances.current[denom]));
            const alt = payment.altDenom;
            let method: string | undefined;
            let resolvedFee: { denom: string; amount: string } | undefined;
            if (fee) {
                if (alt && left(alt).gte(payment.altAmount)) {
                    method = "preferred";
                    resolvedFee = { denom: alt, amount: payment.altAmount };
                } else {
                    method = left(fee.denom).gte(fee.amount) ? (alt ? "fallback" : "native") : "insufficient";
                    resolvedFee = fee;
                }
            }
            return { method, resolvedFee, isPreferredSelected: Boolean(alt), isLoading: false, preferredBalanceDisplay: new BN(0) };
        },
        useAssetPrice: (denom: string) => ({
            hasPrice: denom === "ubze",
            totalUsdValue: (x: BigNumber) => x.times(2),
            uAmountUsdValue: () => new BN(0),
        }),
        useLiquidityPools: () => ({
            getDenomsPool: (a: string, b: string) => existingPools.current.get(actual.createPoolId(a, b)),
            updateLiquidityPools: updatePoolsMock,
            isLoading: false,
        }),
        useCreationFees: () => ({ fees: { createMarketFee: feeState.fee }, isLoading: feeState.isLoading }),
        getLiquidityPool: getLiquidityPoolMock,
        getDexApp: () => ({ href: "https://dex.test" }),
        getExplorerTxURL: (hash: string) => `https://explorer.test/txs/${hash}`,
        useToast: () => ({ toast: { success: vi.fn() } }),
        TokenLogo: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
    };
});

import PoolNewPage from "./page";
import { PendingTxProvider, createPendingTxStore } from "@/contexts/pending-tx";

const renderPage = () => {
    let value: string | null = null;
    const store = createPendingTxStore({ read: () => value, write: (v) => { value = v; } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ChakraProvider value={defaultSystem}>
            <PendingTxProvider store={store}>{children}</PendingTxProvider>
        </ChakraProvider>
    );
    return render(<PoolNewPage />, { wrapper });
};
const step = (title: string) => screen.getByRole("region", { name: title });
const button = (region: HTMLElement, name: string | RegExp) => within(region).getByRole("button", { name });
const createButton = () => button(step("Review"), "Create pool");
const sentMsgs = () => txMock.mock.calls[0][0] as { typeUrl: string; value: Record<string, unknown> }[];

async function answerPair(base = "utok", quote = "ubze") {
    await userEvent.click(within(step("Pair")).getByText(`Base token: ${base}`));
    await userEvent.click(within(step("Pair")).getByText(`Quote token: ${quote}`));
    await userEvent.click(button(step("Pair"), "Continue"));
}

async function answerAmounts(base: string, quote: string, baseTicker = "TOK", quoteTicker = "BZE") {
    const q = step("Starting amounts");
    await userEvent.type(within(q).getByLabelText(baseTicker), base);
    await userEvent.type(within(q).getByLabelText(quoteTicker), quote);
    await userEvent.click(button(q, "Continue"));
}

const answerFees = () => userEvent.click(button(step("Fees"), "Review pool"));

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
    existingPools.current = new Map();
    feeState.fee = { denom: "ubze", amount: "25000000" };
    feeState.isLoading = false;
    balances.current = { utok: "1000000000", ubze: "1000000000" };
    maxSpendable.current = { utok: "1000000000", ubze: "999000000" };
    payment.altDenom = undefined;
    payment.altAmount = "0";
    payment.gasAmount = "0";
    navigateMock.mockReset();
    updatePoolsMock.mockReset();
    getLiquidityPoolMock.mockReset().mockResolvedValue({ lp_denom: "ulp/abc" });
    txMock.mockReset();
    txSucceeds();
    // A pending hash is looked up on the chain's REST: never reach the network.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});

afterEach(() => vi.unstubAllGlobals());

// Each test types through several steps; CI runners need more than the 5 s default.
describe("Create a liquidity pool (/pool/new)", { timeout: 20_000 }, () => {
    it("shows the four steps with Pair open, and the pool fee", () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Create a liquidity pool" })).toBeInTheDocument();
        expect(screen.queryByText("tradebin · liquidity pool")).not.toBeInTheDocument();
        expect(step("Pair")).toHaveAttribute("data-state", "active");
        expect(within(step("Pair")).getByText("Step 1 of 4 ·", { exact: false })).toBeInTheDocument();
        expect(within(step("Pair")).getByRole("heading", { name: "Which pair?" })).toBeInTheDocument();
        expect(step("Starting amounts")).toHaveAttribute("data-state", "todo");
        expect(step("Fees")).toHaveAttribute("data-state", "todo");
        expect(step("Review")).toHaveAttribute("data-state", "todo");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Creation fee: 25000000");
        expect(screen.queryByRole("region", { name: "What will happen" })).not.toBeInTheDocument();
    });

    describe("Pair", () => {
        it("summarises the pair in the order picked", async () => {
            renderPage();
            await userEvent.click(within(step("Pair")).getByText("Base token: utok"));
            await userEvent.click(within(step("Pair")).getByText("Quote token: ubze"));
            expect(within(step("Pair")).queryByText(/Stored on chain as/)).not.toBeInTheDocument();
            await userEvent.click(button(step("Pair"), "Continue"));
            expect(step("Pair")).toHaveAttribute("data-state", "done");
            expect(step("Pair")).toHaveTextContent("TOK / BZE");
            expect(step("Starting amounts")).toHaveAttribute("data-state", "active");
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

        it("blocks an existing pair with a DEX link to add liquidity to it", () => {
            existingPools.current = new Map([["ubze_utok", { id: "ubze_utok" }]]);
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            expect(step("Pair")).toHaveAttribute("data-state", "active");
            expect(screen.getByRole("alert")).toHaveTextContent("This pair already has a pool.");
            const link = screen.getByRole("link", { name: /Add liquidity to it on the DEX/ });
            expect(link).toHaveAttribute("href", "https://dex.test/pools/details?id=ubze_utok");
            expect(link).toHaveAttribute("data-app", "dex");
            expect(button(step("Pair"), "Continue")).toBeDisabled();
        });

        it("lands on Starting amounts when the deep link names a valid pair", () => {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            expect(step("Pair")).toHaveAttribute("data-state", "done");
            expect(step("Starting amounts")).toHaveAttribute("data-state", "active");
        });
    });

    describe("Starting amounts", () => {
        beforeEach(() => {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        });

        it("shows the live starting price, the amber permanent-deposit note and the summary", async () => {
            renderPage();
            const q = step("Starting amounts");
            expect(within(q).getByRole("heading", { name: "How much goes in first?" })).toBeInTheDocument();
            expect(within(q).getByText("This first deposit stays in the pool forever.")).toBeInTheDocument();
            expect(within(q).queryByText(/You get no withdrawable share for it/)).not.toBeInTheDocument();
            expect(within(q).getByText("You hold 1,000 TOK")).toBeInTheDocument();
            await userEvent.type(within(q).getByLabelText("TOK"), "100");
            await userEvent.type(within(q).getByLabelText("BZE"), "50");
            // 1 TOK = 0.5 BZE, 1 BZE = $2 in the mock.
            expect(within(q).getByTestId("starting-price")).toHaveTextContent(/Starting price\s*1 TOK = 0\.500000 BZE ≈ \$1/);
            await userEvent.click(button(q, "Continue"));
            expect(step("Starting amounts")).toHaveTextContent("100 TOK + 50 BZE · 0.500000 BZE per TOK");
        });

        it("Max leaves the creation fee when the amount is in the fee denom", async () => {
            renderPage();
            await userEvent.click(screen.getByRole("button", { name: "Max TOK" }));
            await userEvent.click(screen.getByRole("button", { name: "Max BZE" }));
            const q = step("Starting amounts");
            expect(within(q).getByLabelText("TOK")).toHaveValue("1000");
            // 999 BZE spendable after gas, minus the 25 BZE creation fee.
            expect(within(q).getByLabelText("BZE")).toHaveValue("974");
        });

        it("rejects an amount above the balance after blur", async () => {
            renderPage();
            const input = within(step("Starting amounts")).getByLabelText("TOK");
            await userEvent.type(input, "5000");
            await userEvent.tab();
            expect(within(step("Starting amounts")).getByText("Not enough TOK: you hold 1,000 TOK.")).toBeInTheDocument();
            expect(button(step("Starting amounts"), "Continue")).toBeDisabled();
        });

        it("without a wallet, takes any amount and leaves Max and the balance out", async () => {
            wallet.address = undefined;
            balances.current = {};
            renderPage();
            const q = step("Starting amounts");
            expect(within(q).queryByRole("button", { name: "Max TOK" })).not.toBeInTheDocument();
            await userEvent.type(within(q).getByLabelText("TOK"), "5000");
            await userEvent.type(within(q).getByLabelText("BZE"), "10");
            expect(button(q, "Continue")).toBeEnabled();
        });
    });

    describe("Fees", () => {
        beforeEach(() => {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        });

        it("summarises the swap fee and the split", async () => {
            renderPage();
            await answerAmounts("10", "10");
            const q = step("Fees");
            expect(within(q).getByRole("heading", { name: "What do swappers pay?" })).toBeInTheDocument();
            await userEvent.click(button(q, "0.3%"));
            await userEvent.click(within(q).getByText("split 50/25/25"));
            await answerFees();
            expect(step("Fees")).toHaveTextContent("0.3% · 50% to providers, 25% burned, 25% treasury");
        });

        it.each([
            ["0.09", "Swap fee must be between 0.1% and 5%."],
            ["0.1", ""],
            ["5", ""],
            ["5.01", "Swap fee must be between 0.1% and 5%."],
            ["0.123", "At most 2 decimal places."],
            ["", "Swap fee is required."],
            ["abc", "Enter a valid percentage."],
        ])("validates a custom swap fee of %j", async (value, error) => {
            renderPage();
            await answerAmounts("10", "10");
            const input = within(step("Fees")).getByRole("textbox", { name: "Custom swap fee (%)" });
            await userEvent.clear(input);
            if (value) await userEvent.type(input, value);
            const cont = button(step("Fees"), "Review pool");
            if (error) {
                expect(within(step("Fees")).getByText(error)).toBeInTheDocument();
                expect(cont).toBeDisabled();
            } else {
                expect(cont).toBeEnabled();
            }
        });
    });

    describe("Review", () => {
        it("lists what leaves the wallet, the pool, the swap fee and what is permanent, then signs the sorted pair", async () => {
            payment.gasAmount = "4000";
            renderPage();
            await answerPair("utok", "ubze");
            await answerAmounts("1000", "50");
            await userEvent.click(within(step("Fees")).getByText("split 50/25/25"));
            await answerFees();

            const review = step("Review");
            const leaves = within(review).getByRole("region", { name: "You pay" });
            // Each coin row: label, logo (the mock prints the ticker), amount.
            expect(leaves).toHaveTextContent(/Creation fee\s*BZE\s*25 BZE/);
            expect(leaves).toHaveTextContent(/Starting TOK\s*TOK\s*1,000 TOK/);
            expect(leaves).toHaveTextContent(/Starting BZE\s*BZE\s*50 BZE/);
            expect(leaves).toHaveTextContent("Network fee≈ 0.004000 BZE");
            expect(within(review).getByRole("region", { name: "You get" })).toHaveTextContent("Liquidity poolTOK/BZE");
            expect(review).toHaveTextContent("Swap fee0.2% · 50% to providers, 25% burned, 25% treasury");
            const permanent = within(review).getByRole("region", { name: "Permanent" });
            expect(permanent).toHaveTextContent("This action can't be undone");

            // The pay panel lists the same rows as Review.
            expect(screen.getByTestId("pay-panel")).toHaveTextContent("Creation fee: 25000000, Starting TOK: 1000000000, Starting BZE: 50000000");
            expect(screen.queryByTestId("outcome")).not.toBeInTheDocument();

            await userEvent.click(createButton());
            // ubze < utok: the chain stores BZE/TOK and the amounts swap with it.
            expect(sentMsgs()).toEqual([{
                typeUrl: "/bze.tradebin.MsgCreateLiquidityPool",
                value: {
                    creator: "bze1me",
                    base: "ubze",
                    quote: "utok",
                    initialBase: "50000000",
                    initialQuote: "1000000000",
                    fee: "0.002",
                    feeDest: JSON.stringify({ providers: "0.50", burner: "0.25", treasury: "0.25" }),
                    stable: false,
                },
            }]);
        });

        it("keeps an alphabetical pair as it is", async () => {
            renderPage();
            await answerPair("ubze", "utok");
            await answerAmounts("10", "200", "BZE", "TOK");
            await answerFees();
            await userEvent.click(createButton());
            expect(sentMsgs()[0].value).toMatchObject({
                base: "ubze", quote: "utok", initialBase: "10000000", initialQuote: "200000000", fee: "0.002",
                feeDest: JSON.stringify({ providers: "1.00", burner: "0.00", treasury: "0.00" }),
            });
        });

        it("needs the fee on top of a starting amount in the fee denom, unless the fee token pays it", async () => {
            balances.current = { utok: "1000000000", ubze: "100000000", uusdc: "100000000" };
            payment.gasAmount = "1000000";
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            const { unmount } = renderPage();
            // 80 BZE + 25 BZE fee + 1 BZE gas > 100 BZE.
            await answerAmounts("10", "80");
            await answerFees();
            expect(screen.getByTestId("pay-panel")).not.toHaveTextContent("needed in total");
            expect(createButton()).toBeDisabled();
            expect(screen.getByText("Not enough BZE: 6 BZE short.")).toBeInTheDocument();
            unmount();

            // A fee token outside the pair pays the fee and the gas, BZE keeps the 80 for the pool.
            payment.altDenom = "uusdc";
            payment.altAmount = "5000000";
            renderPage();
            await answerAmounts("10", "80");
            await answerFees();
            expect(createButton()).toBeEnabled();
        });

        // Regression: the chain takes the creation fee before the starting amounts. With the fee
        // token one of the pair, holding enough of it for the fee (after gas) made the chain take
        // the fee in it, and the reserve transfer then failed. The page used to enable Create as
        // soon as the fee token could pay the fee.
        it("refuses a fee-token reserve that the fee taken first would leave short", async () => {
            balances.current = { utok: "100000000", ubze: "1000000000" };
            payment.altDenom = "utok";
            payment.altAmount = "10000000";
            payment.gasAmount = "1000000";
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            // 1 TOK gas, then 10 TOK fee (99 TOK left covers it), then 95 TOK reserve: 106 > 100.
            await answerAmounts("95", "10");
            await answerFees();
            expect(createButton()).toBeDisabled();
            expect(screen.getByText("Not enough TOK: 6 TOK short.")).toBeInTheDocument();
        });

        it("lets the same pool through once the fee-token reserve leaves room for the fee and gas", async () => {
            balances.current = { utok: "100000000", ubze: "1000000000" };
            payment.altDenom = "utok";
            payment.altAmount = "10000000";
            payment.gasAmount = "1000000";
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            await answerAmounts("89", "10");
            await answerFees();
            expect(createButton()).toBeEnabled();
        });

        it("explains a missing wallet", async () => {
            wallet.address = undefined;
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            await answerAmounts("10", "10");
            await answerFees();
            expect(createButton()).toBeDisabled();
            expect(screen.getByText("Connect your wallet.")).toBeInTheDocument();
        });

        it("keeps the answers when the wallet declines", async () => {
            txMock.mockImplementation(async (_msgs: unknown, opts: TxOpts) => {
                opts.onFailure?.("Request rejected", { stage: "sign" });
                return false;
            });
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            await answerAmounts("10", "20");
            await answerFees();
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "You declined in the wallet" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Edit answers" }));
            expect(step("Starting amounts")).toHaveTextContent("10 TOK + 20 BZE");
            expect(createButton()).toBeEnabled();
        });
    });

    describe("Done", () => {
        async function createPool() {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            renderPage();
            await answerAmounts("1000", "2");
            await answerFees();
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        }

        it("keeps every step answered under Confirmed while the chain changes under the form", async () => {
            queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
            const { rerender } = renderPage();
            await answerAmounts("1000", "2");
            await answerFees();
            await userEvent.click(createButton());
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();

            // The chain spent the starting amounts and now holds the pool.
            balances.current = { utok: "0", ubze: "0" };
            existingPools.current = new Map([["ubze_utok", { id: "ubze_utok" }]]);
            rerender(<PoolNewPage />);

            expect(step("Pair")).toHaveAttribute("data-state", "done");
            expect(step("Starting amounts")).toHaveAttribute("data-state", "done");
            expect(step("Fees")).toHaveAttribute("data-state", "done");
            expect(screen.getByRole("heading", { name: "Confirmed" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
        });

        it("shows the open pool, its links and only adding liquidity on the DEX next", async () => {
            let resolvePool: (p: { lp_denom: string }) => void = () => {};
            getLiquidityPoolMock.mockReturnValue(new Promise(r => { resolvePool = r; }));
            await createPool();

            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The TOK/BZE pool is open.");
            expect(screen.getByText("People can swap TOK for BZE right now, starting at 0.002000 BZE per TOK.")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Copy pool link" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /Explorer/ })).toHaveAttribute("href", "https://explorer.test/txs/HASH1");
            expect(getLiquidityPoolMock).toHaveBeenCalledWith("ubze_utok");
            expect(updatePoolsMock).toHaveBeenCalled();

            const recommended = screen.getByTestId("done-recommended");
            expect(recommended).toHaveTextContent("Add liquidity on DEX");
            expect(within(recommended).getByRole("link", { name: /Add liquidity on DEX/ }))
                .toHaveAttribute("href", "https://dex.test/pools/details?id=ubze_utok");
            expect(screen.queryByTestId("done-more")).not.toBeInTheDocument();

            // The code skeleton stands in for the LP denom until the pool is read.
            expect(screen.getByTestId("code-loading")).toBeInTheDocument();
            resolvePool({ lp_denom: "ulp/abc" });
            expect(await screen.findByText("ulp/abc")).toBeInTheDocument();
        });
    });
});
