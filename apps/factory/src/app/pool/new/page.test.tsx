import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The page runs on mocked hooks: query params, wallet, pools, fees, balances, the fee
// engine and the tx hook. The asset picker becomes a plain button per denom; PayPanel and
// the fee split slider have their own coverage.
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
    payment: { paysWithAlt: false, gasDenom: "ubze", gasAmount: "0" },
    navigateMock: vi.fn(),
    txMock: vi.fn(),
    updatePoolsMock: vi.fn(),
    getLiquidityPoolMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => queryParams.current }));
vi.mock("@/hooks/useNavigation", () => ({
    useNavigation: () => ({ navigate: navigateMock }),
    useNavigationWithParams: () => ({
        getQueryParam: (p: string) => queryParams.current.get(p),
        navigate: navigateMock,
    }),
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock }) }));
vi.mock("@/hooks/useFeePayment", () => ({
    useFeePayment: () => ({
        paysWithAlt: payment.paysWithAlt,
        isLoading: false,
        gasFee: { denom: payment.gasDenom, amount: new BigNumber(payment.gasAmount) },
    }),
}));
vi.mock("@/components/guided/pay-panel", () => ({
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
        <button onClick={() => onChange({ providers: 50, burner: 30, treasury: 20 })}>split 50/30/20</button>
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
        useAssetPrice: (denom: string) => ({
            hasPrice: denom === "ubze",
            totalUsdValue: (x: BigNumber) => x.times(2),
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
    };
});

import PoolNewPage from "./page";

const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPage = () => render(<PoolNewPage />, { wrapper });
const createButton = () => screen.getByRole("button", { name: "Create pool" });
const question = (title: string) => screen.getByRole("region", { name: title });
const PAIR = "Which pair?";
const DEPOSIT = "How much to put in?";
const FEE = "Swap fee and where it goes";

const continueIn = (title: string) => userEvent.click(within(question(title)).getByRole("button", { name: "Continue" }));

async function answerPair(base = "utok", quote = "ubze") {
    await userEvent.click(within(question(PAIR)).getByText(`Your token: ${base}`));
    await userEvent.click(within(question(PAIR)).getByText(`Paired with: ${quote}`));
    await continueIn(PAIR);
}

async function answerDeposit(base: string, quote: string) {
    const q = question(DEPOSIT);
    await userEvent.type(within(q).getByLabelText(/Your token/), base);
    await userEvent.type(within(q).getByLabelText(/Paired with/), quote);
    await continueIn(DEPOSIT);
}

beforeEach(() => {
    queryParams.current = new URLSearchParams();
    wallet.address = "bze1me";
    existingPools.current = new Map();
    feeState.fee = { denom: "ubze", amount: "25000000" };
    feeState.isLoading = false;
    balances.current = { utok: "1000000000", ubze: "1000000000" };
    maxSpendable.current = { utok: "1000000000", ubze: "999000000" };
    payment.paysWithAlt = false;
    payment.gasDenom = "ubze";
    payment.gasAmount = "0";
    navigateMock.mockReset();
    updatePoolsMock.mockReset();
    getLiquidityPoolMock.mockReset().mockResolvedValue({ lp_denom: "ulp/abc" });
    txMock.mockReset().mockImplementation(async (_msgs: unknown, opts: { onSuccess: (r: { txhash: string }) => void }) => {
        opts.onSuccess({ txhash: "HASH1" });
    });
});

describe("Let people buy and sell it (/pool/new)", { timeout: 20_000 }, () => {
    it("asks the three questions in order and signs the pre-sorted pair with swapped amounts", async () => {
        queryParams.current = new URLSearchParams({ base: "utok" });
        renderPage();
        expect(screen.getByRole("heading", { name: "Let people buy and sell TOK" })).toBeInTheDocument();
        expect(screen.getByText("tradebin · liquidity pool")).toBeInTheDocument();
        expect(question(PAIR)).toHaveAttribute("data-state", "active");
        expect(question(DEPOSIT)).toHaveAttribute("data-state", "todo");
        expect(question(FEE)).toHaveAttribute("data-state", "todo");
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("Pool creation fee: 25000000");

        await userEvent.click(within(question(PAIR)).getByText("Paired with: ubze"));
        // ubze < utok: the chain stores BZE/TOK.
        expect(within(question(PAIR)).getByText(/Stored on-chain as/)).toHaveTextContent(
            "Stored on-chain as BZE/TOK — the chain orders every pair alphabetically.",
        );
        await continueIn(PAIR);
        expect(question(PAIR)).toHaveAttribute("data-state", "done");
        expect(question(PAIR)).toHaveTextContent("TOK / BZE");

        await answerDeposit("1000", "50");
        expect(question(DEPOSIT)).toHaveTextContent("1,000 TOK + 50 BZE · 1 TOK = 0.050000 BZE");

        expect(within(question(FEE)).getByRole("button", { name: "0.2%" })).toBeInTheDocument();
        await userEvent.click(within(question(FEE)).getByRole("button", { name: "0.3%" }));
        await userEvent.click(within(question(FEE)).getByText("split 50/30/20"));
        expect(within(question(FEE)).getByText(/No market needed/)).toBeInTheDocument();
        await continueIn(FEE);
        expect(question(FEE)).toHaveTextContent("0.3% · providers 50% · burner 30% · treasury 20%");

        const outcome = screen.getByRole("region", { name: "What will happen" });
        expect(outcome).toHaveTextContent("BZE/TOK");
        expect(outcome).toHaveTextContent("1 TOK = 0.050000 BZE");
        expect(outcome).toHaveTextContent("0.3%");
        expect(outcome).toHaveTextContent("BZE/TOK opens for swaps. Your deposit becomes its permanent floor.");

        expect(createButton()).toBeEnabled();
        await userEvent.click(createButton());

        const [msgs] = txMock.mock.calls[0];
        expect(msgs).toEqual([{
            typeUrl: "/bze.tradebin.MsgCreateLiquidityPool",
            value: {
                creator: "bze1me",
                base: "ubze",
                quote: "utok",
                initialBase: "50000000",
                initialQuote: "1000000000",
                fee: "0.003",
                feeDest: JSON.stringify({ providers: "0.50", burner: "0.30", treasury: "0.20" }),
                stable: false,
            },
        }]);
        expect(updatePoolsMock).toHaveBeenCalled();
        expect(getLiquidityPoolMock).toHaveBeenCalledWith("ubze_utok");
    });

    it("keeps the canonical order unswapped", async () => {
        renderPage();
        expect(screen.getByRole("heading", { name: "Let people buy and sell your token" })).toBeInTheDocument();
        await answerPair("ubze", "utok");
        expect(screen.getByRole("region", { name: "What will happen" })).toHaveTextContent("BZE/TOK");
        await answerDeposit("10", "200");
        await continueIn(FEE);
        await userEvent.click(createButton());
        expect(txMock.mock.calls[0][0][0].value).toMatchObject({
            base: "ubze", quote: "utok", initialBase: "10000000", initialQuote: "200000000", fee: "0.002",
        });
    });

    it("rejects the same asset on both sides of a deep link and keeps question 1 open", () => {
        queryParams.current = new URLSearchParams({ base: "ubze", quote: "ubze" });
        renderPage();
        expect(question(PAIR)).toHaveAttribute("data-state", "active");
        expect(screen.getByRole("alert")).toHaveTextContent("Base and quote must be different assets.");
        expect(within(question(PAIR)).getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("rejects a halted asset", () => {
        queryParams.current = new URLSearchParams({ base: "uhalt", quote: "ubze" });
        renderPage();
        expect(screen.getByRole("alert")).toHaveTextContent(/HALT is no longer tradeable on BZE/);
        expect(createButton()).toBeDisabled();
    });

    it("sends an existing pair to Add liquidity, carrying the return path", async () => {
        existingPools.current = new Map([["ubze_utok", { id: "ubze_utok" }]]);
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze", return: "/manage/token?denom=utok", returnLabel: "TOK" });
        renderPage();
        expect(question(PAIR)).toHaveAttribute("data-state", "active");
        expect(screen.getByRole("alert")).toHaveTextContent(
            "A pool for this pair already exists — add liquidity to it instead of creating a new one.",
        );
        await userEvent.click(screen.getByRole("button", { name: "Add liquidity to it" }));
        expect(navigateMock).toHaveBeenCalledWith(
            `/pool/add?pool=ubze_utok&${new URLSearchParams({ return: "/manage/token?denom=utok", returnLabel: "TOK" })}`,
        );
    });

    it("lands on question 2 when the deep link names a valid pair, and always shows the permanent-floor warning", () => {
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        expect(question(PAIR)).toHaveAttribute("data-state", "done");
        expect(question(DEPOSIT)).toHaveAttribute("data-state", "active");
        const q = question(DEPOSIT);
        expect(within(q).getByText("This first deposit stays in the pool for good.")).toBeInTheDocument();
        expect(within(q).getByText(/nobody can withdraw it, you included. You get no LP tokens for it./)).toBeInTheDocument();
        expect(within(q).getByText("The ratio of the two amounts sets TOK's starting price.")).toBeInTheDocument();
    });

    it("shows the starting price in USD from the quote's price", async () => {
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        const q = question(DEPOSIT);
        await userEvent.type(within(q).getByLabelText(/Your token/), "100");
        await userEvent.type(within(q).getByLabelText(/Paired with/), "50");
        // 1 TOK = 0.5 BZE, 1 BZE = $2 in the mock.
        expect(within(q).getByText(/Starting price/)).toHaveTextContent("Starting price 1 TOK = 0.500000 BZE ≈ $1");
    });

    it("Max leaves the creation fee when the reserve is in the fee denom", async () => {
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "Max TOK" }));
        await userEvent.click(screen.getByRole("button", { name: "Max BZE" }));
        const q = question(DEPOSIT);
        expect(within(q).getByLabelText(/Your token/)).toHaveValue("1000");
        // 999 BZE spendable after gas, minus the 25 BZE creation fee.
        expect(within(q).getByLabelText(/Paired with/)).toHaveValue("974");
    });

    it("rejects a reserve above the balance after blur", async () => {
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        const input = within(question(DEPOSIT)).getByLabelText(/Your token/);
        await userEvent.type(input, "5000");
        await userEvent.tab();
        expect(within(question(DEPOSIT)).getByText("Amount exceeds your balance.")).toBeInTheDocument();
        expect(within(question(DEPOSIT)).getByRole("button", { name: "Continue" })).toBeDisabled();
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
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        await answerDeposit("10", "10");
        const input = within(question(FEE)).getByRole("textbox", { name: "Custom swap fee (%)" });
        await userEvent.clear(input);
        if (value) await userEvent.type(input, value);
        const cont = within(question(FEE)).getByRole("button", { name: "Continue" });
        if (error) {
            expect(within(question(FEE)).getByText(error)).toBeInTheDocument();
            expect(cont).toBeDisabled();
        } else {
            expect(cont).toBeEnabled();
        }
    });

    it("needs the fee on top of a reserve in the fee denom, unless the fee token pays it", async () => {
        balances.current = { utok: "1000000000", ubze: "100000000" };
        payment.gasAmount = "1000000";
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        const { unmount } = renderPage();
        // 80 BZE reserve + 25 BZE fee + 1 BZE gas > 100 BZE.
        await answerDeposit("10", "80");
        await continueIn(FEE);
        expect(screen.getByTestId("pay-panel")).toHaveTextContent("BZE needed in total: 105 BZE");
        expect(createButton()).toBeDisabled();
        expect(screen.getByText("Not enough balance to cover the creation fee on top of the reserves.")).toBeInTheDocument();
        unmount();

        payment.paysWithAlt = true;
        renderPage();
        await answerDeposit("10", "80");
        await continueIn(FEE);
        expect(createButton()).toBeEnabled();
    });

    it("explains a missing wallet", async () => {
        wallet.address = undefined;
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        await answerDeposit("10", "10");
        await continueIn(FEE);
        expect(createButton()).toBeDisabled();
        expect(screen.getByText("Connect your wallet to create this pool.")).toBeInTheDocument();
    });

    it("waits for the LP denom before offering to reward its holders", async () => {
        let resolvePool: (p: { lp_denom: string }) => void = () => {};
        getLiquidityPoolMock.mockReturnValue(new Promise(r => { resolvePool = r; }));
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        await answerDeposit("10", "10");
        await continueIn(FEE);
        await userEvent.click(createButton());

        expect(screen.getByRole("heading", { name: "The BZE/TOK pool is live!" })).toBeInTheDocument();
        expect(screen.getByTestId("code-loading")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reward liquidity providers" })).toBeDisabled();

        resolvePool({ lp_denom: "ulp/abc" });
        expect(await screen.findByText("ulp/abc")).toBeInTheDocument();
        const reward = screen.getByRole("button", { name: "Reward liquidity providers" });
        expect(reward).toBeEnabled();
        await userEvent.click(reward);
        expect(navigateMock).toHaveBeenCalledWith("/reward/new?staking=ulp%2Fabc");
    });

    it("starts over with Create another pool", async () => {
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        await answerDeposit("10", "10");
        await userEvent.click(within(question(FEE)).getByRole("button", { name: "1%" }));
        await continueIn(FEE);
        await userEvent.click(createButton());
        await screen.findByText("ulp/abc");

        await userEvent.click(screen.getByRole("button", { name: "Create another pool" }));
        expect(question(PAIR)).toHaveAttribute("data-state", "active");
        expect(question(DEPOSIT)).toHaveAttribute("data-state", "todo");
        expect(screen.getByRole("heading", { name: "Let people buy and sell your token" })).toBeInTheDocument();
    });

    it("keeps the answers when the tx fails", async () => {
        txMock.mockImplementation(async () => {});
        queryParams.current = new URLSearchParams({ base: "utok", quote: "ubze" });
        renderPage();
        await answerDeposit("10", "20");
        await continueIn(FEE);
        await userEvent.click(createButton());
        expect(question(DEPOSIT)).toHaveTextContent("10 TOK + 20 BZE");
        expect(createButton()).toBeEnabled();
    });
});
