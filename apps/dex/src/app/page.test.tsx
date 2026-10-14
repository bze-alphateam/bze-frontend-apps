import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";
import type { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";
import { createAmmRouter } from "@bze/bze-ui-kit";
import { quoteExactInput } from "@/lib/swap-quote";

// The swap page reads its assets, balances and the shared gas engine through ui-kit hooks.
// We mock those to feed state directly (no wallet / chain providers) and keep the rest of
// ui-kit real. vi.hoisted guarantees the mock state exists before the factories run.
const mocks = vi.hoisted(() => ({
    useMaxSpendable: vi.fn(),
    tx: vi.fn(),
    liquidAssets: [] as unknown[],
    pools: [] as unknown[],
    balances: new Map<string, BigNumber>(),
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
            isLoading: false,
        }),
        useBalances: () => ({
            getBalanceByDenom: (denom: string) => ({ denom, amount: mocks.balances.get(denom) ?? new BigNumber(0) }),
            balances: [],
            assetsBalances: [],
            isLoading: false,
        }),
        useLiquidityPools: () => ({ pools: mocks.pools, liquidAssets: mocks.liquidAssets, isLoading: false }),
        useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
        useBZETx: () => ({ tx: mocks.tx, progressTrack: "" }),
        useAssetsValue: () => ({ denomUsdValue: () => new BigNumber(0) }),
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

function renderSwap() {
    return render(<SwapPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const fromInput = () => screen.getAllByPlaceholderText("0.0")[0] as HTMLInputElement;
const toInput = () => screen.getAllByPlaceholderText("0.0")[1] as HTMLInputElement;

/** 5,000,000 BZE against 1,000 USDC: ~0.0002 USDC per BZE, 0.3 % fee. */
function bzeUsdcPool(reserveBase = "5000000000000", reserveQuote = "1000000000"): LiquidityPoolSDKType {
    return {
        id: "1",
        base: "ubze",
        quote: "uusdc",
        lp_denom: "ulp1",
        creator: "bze1creator",
        fee: "0.003",
        reserve_base: reserveBase,
        reserve_quote: reserveQuote,
        stable: false,
    };
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
    mocks.pools = [];
});

describe("Swap page MAX button", () => {
    it("fills the spendable amount (balance minus gas) when selling the fee token", () => {
        // Both assets have a balance, so the list is alphabetical by ticker: BZE is "from".
        mocks.liquidAssets = [makeAsset("BZE", "ubze"), makeAsset("USDC", "uusdc")];
        mocks.balances.set("ubze", new BigNumber(10).shiftedBy(6));
        mocks.balances.set("uusdc", new BigNumber(5).shiftedBy(6));
        mocks.useMaxSpendable.mockImplementation((denom: string) =>
            denom === "ubze" ? spendable("10", "0.0045") : spendable("5", "0"),
        );
        renderSwap();

        fireEvent.click(screen.getByRole("button", { name: "MAX" }));

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

        fireEvent.click(screen.getByRole("button", { name: "MAX" }));

        expect(fromInput().value).toBe("10");
        expect(mocks.useMaxSpendable).toHaveBeenCalledWith("uatom", { kind: "swap", count: 3 });
    });

    it("takes the percentage presets from the spendable balance, so 100 % equals MAX", () => {
        mocks.liquidAssets = [makeAsset("BZE", "ubze"), makeAsset("USDC", "uusdc")];
        mocks.balances.set("ubze", new BigNumber(10).shiftedBy(6));
        mocks.balances.set("uusdc", new BigNumber(5).shiftedBy(6));
        mocks.useMaxSpendable.mockImplementation((denom: string) =>
            denom === "ubze" ? spendable("10", "0.0045") : spendable("5", "0"),
        );
        renderSwap();

        fireEvent.click(screen.getByRole("button", { name: "75%" }));
        expect(fromInput().value).toBe("7.496625");

        fireEvent.click(screen.getByRole("button", { name: "100%" }));
        expect(fromInput().value).toBe("9.9955");
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
