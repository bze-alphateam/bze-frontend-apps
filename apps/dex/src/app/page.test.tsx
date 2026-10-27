import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";
import type { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";
import { createAmmRouter, setInLocalStorage } from "@bze/bze-ui-kit";
import { quoteExactInput } from "@/lib/swap-quote";
import { rulesFor } from "@/test-support/css-rules";

// The swap page reads its assets, balances and the shared gas engine through ui-kit hooks.
// We mock those to feed state directly (no wallet / chain providers) and keep the rest of
// ui-kit real. vi.hoisted guarantees the mock state exists before the factories run.
const mocks = vi.hoisted(() => ({
    useMaxSpendable: vi.fn(),
    tx: vi.fn(),
    liquidAssets: [] as unknown[],
    pools: [] as unknown[],
    markets: [] as unknown[],
    halted: new Set<string>(),
    balances: new Map<string, BigNumber>(),
    usdPrices: new Map<string, BigNumber>(),
    // A plain number: BigNumber is not imported yet when vi.hoisted runs.
    bzePrice: 0,
}));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: "bze1test" }),
}));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const zeroGas = {
        denom: "ubze",
        amount: new BigNumber(0),
        displayAmount: new BigNumber(0),
        ticker: "BZE",
        isNative: true,
        isLoading: false,
    };
    return {
        ...actual,
        useAssets: () => ({
            denomTicker: (denom: string) => denom,
            denomDecimals: () => 6,
            getAsset: (denom: string) => (mocks.liquidAssets as Asset[]).find(a => a.denom === denom),
            nativeAsset: undefined,
            isVerifiedAsset: () => true,
            isLoading: false,
        }),
        useBalances: () => ({
            getBalanceByDenom: (denom: string) => ({ denom, amount: mocks.balances.get(denom) ?? new BigNumber(0) }),
            balances: [],
            assetsBalances: [],
            isLoading: false,
        }),
        useLiquidityPools: () => ({ pools: mocks.pools, liquidAssets: mocks.liquidAssets, isLoading: false }),
        useHaltedDenoms: () => ({
            haltedDenoms: mocks.halted,
            isDenomHalted: (denom: string) => mocks.halted.has(denom),
            isPoolHalted: (pool: { base: string; quote: string }) => mocks.halted.has(pool.base) || mocks.halted.has(pool.quote),
            isMarketHalted: () => false,
            isLoading: false,
        }),
        useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
        useBZETx: () => ({ tx: mocks.tx, progressTrack: "" }),
        // Same contract as the real hook: USD price per whole token, amount in base (micro) units.
        useAssetsValue: () => ({
            denomUsdValue: (denom: string, uAmount: BigNumber) =>
                (mocks.usdPrices.get(denom) ?? new BigNumber(0)).multipliedBy(uAmount.shiftedBy(-6)),
        }),
        useTradingFees: () => ({ fees: {}, isLoading: false }),
        useMaxSpendable: (denom: string, spec: unknown) => mocks.useMaxSpendable(denom, spec),
        useGasFeeEstimate: () => zeroGas,
        useFeeEstimate: () => ({
            isPreferredSelected: false,
            nativeBalanceDisplay: new BigNumber(0),
            preferredBalanceDisplay: new BigNumber(0),
            isLoading: false,
        }),
        useCanAffordTx: () => ({ canAfford: true, shortfalls: [], shortOnFees: false, message: "", gasFee: zeroGas, isLoading: false }),
        getAddressSwapHistory: async () => [],
        // The home page's market list and BZE price; empty here, the swap card is under test.
        useMarkets: () => ({ markets: mocks.markets, getMarketData: () => undefined, isLoading: false }),
        useAssetPrice: () => ({ price: new BigNumber(mocks.bzePrice), hasPrice: mocks.bzePrice > 0, isLoading: false }),
        FeeEstimateRow: () => null,
    };
});

import SwapPage from "./page";

function makeAsset(ticker: string, denom: string): Asset {
    return {
        type: "factory",
        denom,
        decimals: 6,
        name: `${ticker} Token`,
        ticker,
        logo: "",
        stable: false,
        verified: true,
        supply: 1_000_000n,
    };
}

/** What useMaxSpendable returns for a balance of `balance` display units and `reserved` held back. */
function spendable(balance: string, reserved: string) {
    const displayAmount = new BigNumber(balance).minus(reserved);
    return {
        amount: displayAmount.shiftedBy(6),
        displayAmount,
        inputValue: displayAmount.toFixed(),
        balance: new BigNumber(balance).shiftedBy(6),
        reserved: new BigNumber(reserved).shiftedBy(6),
        isReserving: new BigNumber(reserved).gt(0),
        gasFee: {
            denom: "ubze",
            amount: new BigNumber(reserved).shiftedBy(6),
            displayAmount: new BigNumber(reserved),
            ticker: "BZE",
            isNative: true,
            isLoading: false,
        },
        isLoading: false,
    };
}

// No storage mock: the slippage round-trips through jsdom's localStorage exactly as in the app.
function renderSwap() {
    return render(<SwapPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const fromInput = () => screen.getAllByPlaceholderText("0.0")[0] as HTMLInputElement;
const toInput = () => screen.getAllByPlaceholderText("0.0")[1] as HTMLInputElement;

function pool(id: string, base: string, quote: string, reserveBase: string, reserveQuote: string): LiquidityPoolSDKType {
    return {
        id,
        base,
        quote,
        lp_denom: `ulp${id}`,
        creator: "bze1creator",
        fee: "0.003",
        reserve_base: reserveBase,
        reserve_quote: reserveQuote,
        stable: false,
    };
}

/** 5,000,000 BZE against 1,000 USDC: ~0.0002 USDC per BZE, 0.3 % fee. */
function bzeUsdcPool(reserveBase = "5000000000000", reserveQuote = "1000000000"): LiquidityPoolSDKType {
    return pool("1", "ubze", "uusdc", reserveBase, reserveQuote);
}

/** Both assets funded, BZE first ("from") and USDC second ("to"), one pool between them. */
function setupBzeUsdc(pools: LiquidityPoolSDKType[] = [bzeUsdcPool()]) {
    mocks.liquidAssets = [makeAsset("BZE", "ubze"), makeAsset("USDC", "uusdc")];
    mocks.pools = pools;
    mocks.balances.set("ubze", new BigNumber(10_000).shiftedBy(6));
    mocks.balances.set("uusdc", new BigNumber(5).shiftedBy(6));
    mocks.useMaxSpendable.mockImplementation((denom: string) =>
        denom === "ubze" ? spendable("10000", "0.0045") : spendable("5", "0"),
    );
}

beforeEach(() => {
    mocks.useMaxSpendable.mockReset();
    mocks.tx.mockReset();
    mocks.balances.clear();
    mocks.usdPrices.clear();
    mocks.pools = [];
    mocks.markets = [];
    mocks.halted = new Set();
    mocks.bzePrice = 0;
    localStorage.clear();
});

describe("Swap page Max button", () => {
    it("fills the spendable amount (balance minus gas) when selling the fee token", () => {
        // Both assets have a balance, so the list is alphabetical by ticker: BZE is "from".
        mocks.liquidAssets = [makeAsset("BZE", "ubze"), makeAsset("USDC", "uusdc")];
        mocks.balances.set("ubze", new BigNumber(10).shiftedBy(6));
        mocks.balances.set("uusdc", new BigNumber(5).shiftedBy(6));
        mocks.useMaxSpendable.mockImplementation((denom: string) =>
            denom === "ubze" ? spendable("10", "0.0045") : spendable("5", "0"),
        );
        renderSwap();

        fireEvent.click(screen.getByRole("button", { name: "Max" }));

        expect(fromInput().value).toBe("9.9955");
        // The reserve is sized for the worst case: a 3-hop route.
        expect(mocks.useMaxSpendable).toHaveBeenCalledWith("ubze", { kind: "swap", count: 3 });
    });

    it("fills the full balance when the sold asset is not the fee token", () => {
        // ATOM sorts before BZE, so ATOM is "from" and BZE is "to".
        mocks.liquidAssets = [makeAsset("ATOM", "uatom"), makeAsset("BZE", "ubze")];
        mocks.balances.set("uatom", new BigNumber(10).shiftedBy(6));
        mocks.balances.set("ubze", new BigNumber(10).shiftedBy(6));
        mocks.useMaxSpendable.mockImplementation((denom: string) =>
            denom === "ubze" ? spendable("10", "0.0045") : spendable("10", "0"),
        );
        renderSwap();

        fireEvent.click(screen.getByRole("button", { name: "Max" }));

        expect(fromInput().value).toBe("10");
        expect(mocks.useMaxSpendable).toHaveBeenCalledWith("uatom", { kind: "swap", count: 3 });
    });

    it("takes the percentage presets from the spendable balance, the same one Max fills", () => {
        mocks.liquidAssets = [makeAsset("BZE", "ubze"), makeAsset("USDC", "uusdc")];
        mocks.balances.set("ubze", new BigNumber(10).shiftedBy(6));
        mocks.balances.set("uusdc", new BigNumber(5).shiftedBy(6));
        mocks.useMaxSpendable.mockImplementation((denom: string) =>
            denom === "ubze" ? spendable("10", "0.0045") : spendable("5", "0"),
        );
        renderSwap();

        fireEvent.click(screen.getByRole("button", { name: "75%" }));
        expect(fromInput().value).toBe("7.496625");

        fireEvent.click(screen.getByRole("button", { name: "Max" }));
        expect(fromInput().value).toBe("9.9955");
    });
});

describe("Swap page with a governance-halted denom", () => {
    const HALTED = "factory/bze1creator/uhalt";

    // ATOM reaches BZE only through the halted denom: ATOM -> HALTED -> BZE.
    beforeEach(() => {
        mocks.useMaxSpendable.mockImplementation(() => spendable("10", "0"));
        mocks.liquidAssets = [makeAsset("AAA", HALTED), makeAsset("ATOM", "uatom"), makeAsset("BZE", "ubze")];
        mocks.pools = [
            pool("1", "uatom", HALTED, "1000000000", "1000000000"),
            pool("2", HALTED, "ubze", "1000000000", "1000000000"),
        ];
        mocks.balances.set("uatom", new BigNumber(10).shiftedBy(6));
        mocks.balances.set("ubze", new BigNumber(10).shiftedBy(6));
    });

    it("never offers the halted denom, even when it would sort first", () => {
        // AAA (halted) holds the only balance, so without the halt it would be the default "from".
        mocks.balances.clear();
        mocks.balances.set(HALTED, new BigNumber(10).shiftedBy(6));
        mocks.halted = new Set([HALTED]);
        renderSwap();

        expect(screen.queryByText("AAA")).toBeNull();
        expect(screen.getAllByText("ATOM").length).toBeGreaterThan(0);
        expect(screen.getAllByText("BZE").length).toBeGreaterThan(0);
    });

    it("never routes through a halted pool", () => {
        mocks.halted = new Set([HALTED]);
        renderSwap();

        // ATOM is "from" and BZE "to"; the only path crosses the halted denom, so there is no route.
        fireEvent.change(fromInput(), { target: { value: "1" } });

        expect(toInput().value).toBe("");
        expect(screen.getByText("No Route Found")).toBeInTheDocument();
    });

    it("changes nothing when nothing is halted", () => {
        renderSwap();

        expect(screen.getAllByText("AAA").length).toBeGreaterThan(0);
        // AAA sorts first and becomes "from"; its pool with ATOM gives a route.
        fireEvent.change(fromInput(), { target: { value: "1" } });
        expect(toInput().value).not.toBe("");
        expect(screen.getByRole("button", { name: "Swap" })).toBeEnabled();
    });
});

describe("Swap page quoting", () => {
    it("quotes the bought amount from the typed sold amount", () => {
        setupBzeUsdc();
        renderSwap();

        fireEvent.change(fromInput(), { target: { value: "1000" } });

        const expected = quoteExactInput(createAmmRouter([bzeUsdcPool()]), "ubze", "uusdc", new BigNumber(1000).shiftedBy(6))!;
        expect(toInput().value).toBe(expected.amountOut.shiftedBy(-6).toFixed(6));
        expect(screen.getByRole("button", { name: "Swap" })).toBeEnabled();
    });

    it("keeps a typed bought amount as typed and derives the sold amount from it", () => {
        setupBzeUsdc();
        renderSwap();

        fireEvent.change(toInput(), { target: { value: "0.1" } });

        // The field the user is typing in is never rewritten by the quote.
        expect(toInput().value).toBe("0.1");
        const soldMicro = new BigNumber(fromInput().value).shiftedBy(6);
        expect(soldMicro.isInteger()).toBe(true);
        expect(soldMicro.gt(0)).toBe(true);
        // ...and the sold amount is the smallest one that really buys 0.1 USDC.
        const router = createAmmRouter([bzeUsdcPool()]);
        expect(quoteExactInput(router, "ubze", "uusdc", soldMicro)!.amountOut.gte("100000")).toBe(true);
        expect(quoteExactInput(router, "ubze", "uusdc", soldMicro.minus(1))!.amountOut.lt("100000")).toBe(true);
        expect(screen.getByRole("button", { name: "Swap" })).toBeEnabled();
    });

    it("flips the pair with the typed amount staying on its asset, re-quoted for the new direction", () => {
        setupBzeUsdc();
        renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        const usdcForThousandBze = toInput().value;

        fireEvent.click(screen.getByRole("button", { name: "Switch assets" }));

        // BZE moved to the "to" side with its typed 1000; USDC is now sold, priced for the new
        // direction — not the dust the old flip produced by pricing the USDC amount as BZE.
        expect(toInput().value).toBe("1000");
        const soldUsdcMicro = new BigNumber(fromInput().value).shiftedBy(6);
        const router = createAmmRouter([bzeUsdcPool()]);
        expect(quoteExactInput(router, "uusdc", "ubze", soldUsdcMicro)!.amountOut.gte(new BigNumber(1000).shiftedBy(6))).toBe(true);
        expect(quoteExactInput(router, "uusdc", "ubze", soldUsdcMicro.minus(1))!.amountOut.lt(new BigNumber(1000).shiftedBy(6))).toBe(true);
        // Buying back the same 1000 BZE costs about what selling them paid out (fee aside).
        expect(soldUsdcMicro.shiftedBy(-6).minus(usdcForThousandBze).abs().lt(0.002)).toBe(true);
        expect(screen.getByRole("button", { name: "Swap" })).toBeEnabled();

        // Flipping back restores the original form exactly.
        fireEvent.click(screen.getByRole("button", { name: "Switch assets" }));
        expect(fromInput().value).toBe("1000");
        expect(toInput().value).toBe(usdcForThousandBze);
    });

    it("re-quotes when the pools change", () => {
        setupBzeUsdc();
        const { rerender } = renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        const before = toInput().value;

        // Half the USDC reserve: the same 1000 BZE now buys about half as much.
        mocks.pools = [bzeUsdcPool("5000000000000", "500000000")];
        rerender(<SwapPage />);

        const after = toInput().value;
        expect(after).not.toBe(before);
        expect(new BigNumber(after).dividedBy(before).toNumber()).toBeCloseTo(0.5, 2);
    });

    it("shows no route and disables the swap when the pools cannot serve the pair", () => {
        setupBzeUsdc([]);
        renderSwap();

        fireEvent.change(fromInput(), { target: { value: "1000" } });

        expect(toInput().value).toBe("");
        expect(screen.getByText("No Route Found")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "No Route Available" })).toBeDisabled();
    });

    it("submits the quote's exact amounts and clears the form once the swap lands", async () => {
        setupBzeUsdc();
        mocks.tx.mockImplementation(async (_msgs: unknown[], opts: { onSuccess?: () => void }) => opts.onSuccess?.());
        renderSwap();
        fireEvent.change(toInput(), { target: { value: "0.1" } });
        const soldMicro = new BigNumber(fromInput().value).shiftedBy(6);

        fireEvent.click(screen.getByRole("button", { name: "Swap" }));
        await screen.findByRole("button", { name: "Enter Amount" });

        expect(mocks.tx).toHaveBeenCalledTimes(1);
        const [msg] = mocks.tx.mock.calls[0][0] as { value: { input: { denom: string; amount: string }; minOutput: { denom: string; amount: string }; routes: string[] } }[];
        expect(msg.value.routes).toEqual(["1"]);
        expect(msg.value.input).toEqual({ denom: "ubze", amount: soldMicro.toFixed(0) });
        expect(msg.value.minOutput.denom).toBe("uusdc");
        // Default slippage is 0.5 % under the quoted output, which is at least the 0.1 USDC typed.
        expect(new BigNumber(msg.value.minOutput.amount).gte(new BigNumber(100000).multipliedBy(0.995).integerValue(BigNumber.ROUND_FLOOR))).toBe(true);
        expect(fromInput().value).toBe("");
        expect(toInput().value).toBe("");
    });
});

describe("Swap page slippage", () => {
    const presetButton = (name: string) => screen.getByRole("button", { name });
    const customInput = () => screen.getByLabelText("Custom slippage percent") as HTMLInputElement;
    // The editor lives in the summary, so it needs a quote first; "Change" opens it in place.
    const openEditor = () => fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const submittedMinOutput = () => {
        const [msg] = mocks.tx.mock.calls[0][0] as { value: { minOutput: { amount: string } } }[];
        return new BigNumber(msg.value.minOutput.amount);
    };

    it("has no settings panel at the top of the form any more", () => {
        setupBzeUsdc();
        renderSwap();
        expect(screen.queryByRole("button", { name: "Swap settings" })).toBeNull();
        expect(screen.queryByLabelText("Custom slippage percent")).toBeNull();
    });

    it("offers 0.1% as a preset in the summary, applies it to the minimum output and closes the editor", async () => {
        setupBzeUsdc();
        renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        openEditor();

        fireEvent.click(presetButton("0.1%"));
        expect(screen.getByText(/0\.1% max slippage/)).toBeInTheDocument();
        expect(screen.queryByLabelText("Custom slippage percent")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Swap" }));
        await vi.waitFor(() => expect(mocks.tx).toHaveBeenCalledTimes(1));
        const expected = quoteExactInput(createAmmRouter([bzeUsdcPool()]), "ubze", "uusdc", new BigNumber(1000).shiftedBy(6))!;
        expect(submittedMinOutput().toFixed()).toBe(expected.amountOut.multipliedBy(0.999).toFixed(0));
    });

    it("remembers a chosen preset after the page is opened again", () => {
        setupBzeUsdc();
        const first = renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        openEditor();
        fireEvent.click(presetButton("2%"));
        const storedKeys = Object.keys(localStorage);
        expect(storedKeys).toHaveLength(1);
        expect(storedKeys[0].endsWith(":amm:slippage")).toBe(true);
        first.unmount();

        renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        expect(screen.getByText(/2% max slippage/)).toBeInTheDocument();
        openEditor();

        expect(presetButton("2%")).toHaveAttribute("aria-pressed", "true");
        expect(presetButton("0.5%")).toHaveAttribute("aria-pressed", "false");
        expect(customInput().value).toBe("");
    });

    it("remembers a custom value and shows it back in the custom field", () => {
        setupBzeUsdc();
        const first = renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        openEditor();
        fireEvent.change(customInput(), { target: { value: "0.3" } });
        expect(presetButton("0.5%")).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(screen.queryByLabelText("Custom slippage percent")).toBeNull();
        first.unmount();

        renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        expect(screen.getByText(/0\.3% max slippage/)).toBeInTheDocument();
        openEditor();

        expect(customInput().value).toBe("0.3");
        expect(presetButton("0.5%")).toHaveAttribute("aria-pressed", "false");
    });

    it("keeps the last valid slippage while the custom field holds something unusable", () => {
        setupBzeUsdc();
        renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });
        openEditor();

        fireEvent.change(customInput(), { target: { value: "0.3" } });
        fireEvent.change(customInput(), { target: { value: "99" } });

        expect(customInput().value).toBe("99");
        expect(screen.getByText(/0\.3% max slippage/)).toBeInTheDocument();
    });

    it("falls back to the default when the stored value is unusable", () => {
        setupBzeUsdc();
        setInLocalStorage("amm:slippage", "999", 0);
        renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });

        expect(screen.getByText(/0\.5% max slippage/)).toBeInTheDocument();
    });

    it("toggles the editor from the summary line", () => {
        setupBzeUsdc();
        renderSwap();
        fireEvent.change(fromInput(), { target: { value: "1000" } });

        openEditor();
        expect(screen.getByRole("group", { name: "Max slippage" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByRole("group", { name: "Max slippage" })).toBeNull();
    });
});

describe("Swap home order-book markets list", () => {
    it("draws each market with both of its pair's logos, like the pools list beside it", () => {
        setupBzeUsdc();
        mocks.markets = [{ base: "ubze", quote: "uusdc" }];
        renderSwap();

        const logo = screen.getByTestId("market-pair-logo");
        expect(logo.children).toHaveLength(2);
        const token = logo.firstElementChild!.firstElementChild as HTMLElement;
        expect(rulesFor(token)).toMatch(/width:\s*var\(--chakra-sizes-6\)/);
    });
});

describe("Swap page BZE price tile", () => {
    it("shows the full price from md and 4 significant digits on a phone, so it fits one line", () => {
        mocks.bzePrice = 0.764577;
        renderSwap();
        const value = screen.getAllByTestId("stat-value")[0];
        expect(value.textContent).toBe("$0.764577$0.7646");
    });
});

describe("Swap page USD values", () => {
    const usdLines = () => screen.queryAllByText((_, el) => el?.tagName === "SPAN" && /^≈ \$.* USD$/.test(el.textContent ?? ""));

    it("prices the typed amounts as whole tokens, not as base units", () => {
        setupBzeUsdc();
        mocks.usdPrices.set("ubze", new BigNumber("0.0002"));
        mocks.usdPrices.set("uusdc", new BigNumber(1));
        renderSwap();

        fireEvent.change(fromInput(), { target: { value: "847" } });

        // 847 BZE at $0.0002 is $0.1694; the bug priced it as 0.000847 BZE ($0.000000).
        const [fromUsd, toUsd] = usdLines();
        expect(fromUsd.textContent).toBe("≈ $0.169400 USD");
        // At $1 per USDC the bought side is worth exactly its displayed amount.
        expect(toUsd.textContent).toBe(`≈ $${new BigNumber(toInput().value).toFixed(6)} USD`);
    });

    it("shows no USD value for an asset without a price", () => {
        setupBzeUsdc();
        renderSwap();

        fireEvent.change(fromInput(), { target: { value: "847" } });

        expect(usdLines()).toHaveLength(0);
    });
});

/** Chakra's rules for `el`, one per line (each ends where its declarations end). */
const ruleLines = (el: HTMLElement) => rulesFor(el).split("\n").map((rule) => rule.trim()).filter(Boolean);

/** The declarations Chakra emitted for `el` while `layout` is on <html>, inside the lg media query. */
function lgRulesIn(el: HTMLElement, layout: string): string {
    const pattern = new RegExp(String.raw`@media[^{]*min-width:\s*64rem[^{]*\{[^{]*html\[data-swap-layout="?${layout}"?\][^{]*\{(.*)$`);
    return ruleLines(el).map((rule) => pattern.exec(rule)?.[1]).filter(Boolean).join(";");
}

/** The element's own rules outside any media query or <html> attribute: what B and phones get. */
const defaultRules = (el: HTMLElement) =>
    ruleLines(el).filter((rule) => !rule.includes("@media") && !rule.includes("data-swap-layout")).join(";");

describe("Swap page top layouts", () => {
    afterEach(() => {
        delete document.documentElement.dataset.swapLayout;
    });

    it("is B by default: one column, and no lg column rule without the <html> attribute", () => {
        setupBzeUsdc();
        renderSwap();
        const top = screen.getByTestId("swap-top");
        expect(defaultRules(top)).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
        expect(defaultRules(top)).toMatch(/align-items:\s*start/);
        const unconditionalLg = ruleLines(top).filter((rule) => rule.includes("@media") && !rule.includes("data-swap-layout") && rule.includes("grid-template-columns"));
        expect(unconditionalLg).toEqual([]);
    });

    it("lays A out as two stretched columns, the card on the right, from lg up only", () => {
        setupBzeUsdc();
        renderSwap();
        const css = lgRulesIn(screen.getByTestId("swap-top"), "aligned");
        expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) 460px/);
        expect(css).toMatch(/grid-template-areas:\s*"hero card" "stats card" "history history"/);
        expect(css).toMatch(/align-items:\s*stretch/);
    });

    it("lays C-3 out as the card on the left and the activity on the right, from lg up only", () => {
        setupBzeUsdc();
        renderSwap();
        const css = lgRulesIn(screen.getByTestId("swap-top"), "split");
        expect(css).toMatch(/grid-template-columns:\s*460px minmax\(0,\s*1fr\)/);
        expect(css).toMatch(/grid-template-areas:\s*"hero hero" "card stats" "card history"/);
        expect(css).toMatch(/align-items:\s*stretch/);
    });

    it("frames the swap card with the featured edge, 1.5 px wide in C-3", () => {
        setupBzeUsdc();
        renderSwap();
        const edge = screen.getByTestId("swap-card-edge");
        expect(defaultRules(edge)).toMatch(/background-image:[^;]*featured-?edge/i);
        expect(defaultRules(edge)).toMatch(/padding:\s*1px/);
        const split = lgRulesIn(edge, "split");
        expect(split).toMatch(/padding:\s*1\.5px/);
        expect(split).toMatch(/border-radius:\s*22px/);
        expect(lgRulesIn(edge, "aligned")).toBe("");
    });

    it("renders the swap card once and keeps the typed amount across layout switches", () => {
        setupBzeUsdc();
        renderSwap();
        expect(screen.getAllByPlaceholderText("0.0")).toHaveLength(2);

        fireEvent.change(fromInput(), { target: { value: "12" } });
        fireEvent.click(screen.getByRole("radio", { name: "Layout: swap left, activity right" }));
        expect(document.documentElement.getAttribute("data-swap-layout")).toBe("split");
        expect(localStorage.getItem("dex:swap-layout")).toBe("split");
        fireEvent.click(screen.getByRole("radio", { name: "Layout: swap centre stage" }));
        expect(document.documentElement.hasAttribute("data-swap-layout")).toBe(false);

        expect(screen.getAllByPlaceholderText("0.0")).toHaveLength(2);
        expect(fromInput().value).toBe("12");
    });

    it("shows B's stats as one figure box with the phone price, beside the stat cards", () => {
        mocks.bzePrice = 0.764577;
        renderSwap();
        expect(screen.getAllByTestId("stat-card")).toHaveLength(3);
        const figures = screen.getAllByTestId("figure-value");
        expect(figures).toHaveLength(3);
        expect(figures[0].textContent).toBe("$0.764577$0.7646");
    });
});

