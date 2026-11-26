import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// Real PayPanel + real useFeePayment. The ui-kit's fee hook is replaced by a thin harness that runs
// the engine's real pure functions (pool math, transfer fee, balance decision) on fixed inputs.
const { wallet, tok } = vi.hoisted(() => ({
    wallet: { address: "bze1me" as string | undefined },
    tok: { transferFee: "0", balance: "0" },
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const TOK = "factory/bze1creator/utok";
    const assets: Record<string, { denom: string; ticker: string; decimals: number }> = {
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6 },
        [TOK]: { denom: TOK, ticker: "TOK", decimals: 6 },
    };
    // 1:1 pool, 1e12 reserves, no swap fee: a 1,000,000 ubze fee costs 1,000,002 TOK.
    const pool = { base: TOK, quote: "ubze", fee: "0", reserve_base: "1000000000000", reserve_quote: "1000000000000" };
    return {
        ...actual,
        useFeeEstimate: (fee: { denom: string; amount: string }) => {
            const estimate = actual.estimateFeeInPreferredDenom({
                fee, nativeDenom: "ubze", preferredDenom: TOK, pool: pool as never, minNativeLiquidity: 0, transferFee: tok.transferFee,
            });
            const method = actual.resolveFeePayment(estimate, tok.balance, "5000000");
            const total = actual.preferredTotal(estimate);
            return {
                estimate, method, isPreferredSelected: true, isLoading: false,
                nativeAsset: assets.ubze, preferredAsset: assets[TOK],
                preferredDisplayAmount: total ? total.shiftedBy(-6) : undefined,
                nativeBalanceDisplay: new BigNumber(5), preferredBalanceDisplay: new BigNumber(tok.balance).shiftedBy(-6),
                resolvedFee: undefined, maxSpendReserve: () => undefined,
            };
        },
        useGasFeeEstimate: () => ({ estimate: undefined, denom: "ubze", amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE", isLoading: false }),
        useBalances: () => ({ getBalanceByDenom: () => ({ amount: new BigNumber(0) }) }),
        useAssets: () => ({ denomTicker: (d: string) => assets[d]?.ticker ?? d, denomDecimals: () => 6 }),
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssetPrice: () => ({ hasPrice: false, uAmountUsdValue: () => new BigNumber(0) }),
        useBalance: () => ({ balance: { denom: "ubze", amount: new BigNumber("5000000") }, isLoading: false }),
        TokenLogo: () => <span />,
        Sidebar: ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => <div>{trigger}{children}</div>,
        SettingsSidebarContent: () => <div>settings</div>,
    };
});

import { PayPanel } from "./pay-panel";

const FEE = { denom: "ubze", amount: "1000000" };
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
const renderPanel = () => render(<PayPanel rows={[{ label: "Market creation fee", coin: FEE }]} moduleFee={FEE} />, { wrapper });

beforeEach(() => {
    wallet.address = "bze1me";
    tok.transferFee = "0";
    tok.balance = "2000000";
});

describe("PayPanel with a fee token that has a transfer fee", () => {
    it("without a transfer fee shows the converted fee only", () => {
        const { container } = renderPanel();
        expect(screen.getByText(/1\.000002 TOK/)).toBeInTheDocument();
        expect(screen.getByText("You hold enough TOK")).toBeInTheDocument();
        expect(container.textContent).not.toMatch(/transfer/i);
    });

    it("shows fee + transfer fee in the ≈ amount, with no extra row or wording", () => {
        tok.transferFee = "0.05";
        const { container } = renderPanel();
        // 1,000,002 + ceil(1,000,002 x 0.05) = 1,050,003
        expect(screen.getByText(/1\.050003 TOK/)).toBeInTheDocument();
        expect(screen.getByText("You hold enough TOK")).toBeInTheDocument();
        expect(container.textContent).not.toMatch(/transfer/i);
    });

    it("follows the full amount for the balance line", () => {
        tok.transferFee = "0.05";
        tok.balance = "1050002"; // covers the fee (1,000,002), not the full 1,050,003
        renderPanel();
        expect(screen.getByText("Not enough TOK · paid in BZE")).toBeInTheDocument();
        expect(screen.queryByText("You hold enough TOK")).not.toBeInTheDocument();
    });
});
