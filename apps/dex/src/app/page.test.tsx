import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";

// The swap page reads its assets, balances and the shared gas engine through ui-kit hooks.
// We mock those to feed state directly (no wallet / chain providers) and keep the rest of
// ui-kit real. vi.hoisted guarantees the mock state exists before the factories run.
const mocks = vi.hoisted(() => ({
    useMaxSpendable: vi.fn(),
    liquidAssets: [] as unknown[],
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
        useLiquidityPools: () => ({ pools: [], liquidAssets: mocks.liquidAssets, isLoading: false }),
        useToast: () => ({ toast: { error: vi.fn(), success: vi.fn() } }),
        useBZETx: () => ({ tx: vi.fn(), progressTrack: "" }),
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

beforeEach(() => {
    mocks.useMaxSpendable.mockReset();
    mocks.balances.clear();
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
