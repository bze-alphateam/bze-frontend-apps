import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

// The fee engine (useFeePayment) and the ui-kit hooks are mocked: each test sets the
// payment outcome and the panel must word it the way FeeDisclosure does.
const { wallet, payment, prices } = vi.hoisted(() => ({
    wallet: { address: "bze1me" as string | undefined },
    payment: { current: {} as Record<string, unknown> },
    prices: { current: {} as Record<string, number> },
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: wallet.address }) }));
vi.mock("@/hooks/useFeePayment", () => ({ useFeePayment: () => payment.current }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, { denom: string; ticker: string; decimals: number; logo: string }> = {
        ubze: { denom: "ubze", ticker: "BZE", decimals: 6, logo: "" },
        uatom: { denom: "uatom", ticker: "ATOM", decimals: 6, logo: "" },
        utok: { denom: "utok", ticker: "TOK", decimals: 6, logo: "" },
    };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        useAssetPrice: (denom: string) => ({
            hasPrice: prices.current[denom] !== undefined,
            uAmountUsdValue: (amount: BigNumber, decimals: number) =>
                amount.shiftedBy(-decimals).multipliedBy(prices.current[denom] ?? 0),
        }),
        useBalance: () => ({ balance: { denom: "ubze", amount: new BigNumber("3000000") }, isLoading: false }),
        TokenLogo: () => <span />,
        Sidebar: ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
            <div>{trigger}<div data-testid="settings-sidebar">{children}</div></div>
        ),
        SettingsSidebarContent: () => <div>settings</div>,
    };
});

import { PayPanel } from "./pay-panel";

const FEE = { denom: "ubze", amount: "25000000000" };
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;

const pay = (overrides: Record<string, unknown> = {}) => ({
    isLoading: false,
    isAltSelected: false,
    altAmount: undefined,
    altBalanceDisplay: new BigNumber(0),
    altAsset: { ticker: "BZE" },
    method: "native",
    canPayFee: true,
    gasFee: { amount: new BigNumber(0), displayAmount: new BigNumber(0), ticker: "BZE", isLoading: false },
    ...overrides,
});

const renderPanel = (props: Partial<Parameters<typeof PayPanel>[0]> = {}) =>
    render(<PayPanel rows={[{ label: "Market creation fee", coin: FEE }]} moduleFee={FEE} {...props} />, { wrapper });

beforeEach(() => {
    wallet.address = "bze1me";
    payment.current = pay();
    prices.current = {};
});

describe("PayPanel", () => {
    it("shows the fee with logo, amount, ticker and ≈ USD", () => {
        prices.current = { ubze: 0.002 };
        renderPanel();
        expect(screen.getByRole("region", { name: "You will pay" })).toBeInTheDocument();
        expect(screen.getByText("Market creation fee")).toBeInTheDocument();
        expect(screen.getAllByText("25,000 BZE")).toHaveLength(2);
        expect(screen.getByText("≈ $50")).toBeInTheDocument();
    });

    it("explains each cost in a tooltip next to its label", () => {
        payment.current = pay({ gasFee: { denom: "ubze", amount: new BigNumber(5000), displayAmount: new BigNumber("0.005"), ticker: "BZE" } });
        render(<PayPanel rows={[{ label: "Creation fee", coin: FEE }, { label: "Rewards", coin: { denom: "utok", amount: "1000000" } }]} moduleFee={FEE} txKind="create-market" />, { wrapper });
        expect(screen.getByRole("button", { name: "About Creation fee" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About Rewards" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About Network fee" })).toBeInTheDocument();
    });

    it("sums every cost per token in a separate Total, the network fee included", () => {
        payment.current = pay({ gasFee: { denom: "ubze", amount: new BigNumber(5000), displayAmount: new BigNumber("0.005"), ticker: "BZE" } });
        render(<PayPanel rows={[{ label: "Creation fee", coin: FEE }, { label: "Rewards", coin: { denom: "utok", amount: "1000000" } }]} moduleFee={FEE} txKind="create-market" />, { wrapper });
        const total = within(screen.getByTestId("pay-total"));
        expect(total.getByText("Total")).toBeInTheDocument();
        expect(total.getByText(/^≈ 25,000\.005\d* BZE$/)).toBeInTheDocument();
        expect(total.getByText("1 TOK")).toBeInTheDocument();
    });

    it("shows a skeleton while fees load", () => {
        renderPanel({ isLoading: true });
        expect(screen.queryByText("Market creation fee")).not.toBeInTheDocument();
    });

    it("shows only the could-not-load message when the fee is unknown", () => {
        renderPanel({ feeUnknown: true });
        expect(screen.getByText(/Could not load the current fee from the chain/)).toBeInTheDocument();
        expect(screen.queryByText("Market creation fee")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Fee token/ })).not.toBeInTheDocument();
    });

    it("adds the network fee row when a txKind is given", () => {
        payment.current = pay({ gasFee: { amount: new BigNumber(5000), displayAmount: new BigNumber("0.005"), ticker: "BZE" } });
        renderPanel({ txKind: "create-market" });
        expect(screen.getByText("Network fee")).toBeInTheDocument();
        expect(screen.getByText("≈ 0.005000 BZE")).toBeInTheDocument();
        expect(screen.queryByText("Taken first, from the same balance.")).not.toBeInTheDocument();
        expect(screen.getByText("You hold enough BZE")).toBeInTheDocument();
    });

    it("hides the Fee token button while the fee token is BZE", () => {
        renderPanel();
        expect(screen.queryByRole("button", { name: /Fee token/ })).not.toBeInTheDocument();
    });

    it("offers the Fee token button that opens the Settings sidebar when another fee token is picked", () => {
        payment.current = pay({ isAltSelected: true, altAsset: { ticker: "ATOM" } });
        renderPanel();
        expect(screen.getByRole("button", { name: /Fee token: ATOM/ })).toBeInTheDocument();
        expect(screen.getByTestId("settings-sidebar")).toHaveTextContent("settings");
    });

    it("asks to connect a wallet to check the balance", () => {
        wallet.address = undefined;
        renderPanel();
        expect(screen.getByText("Connect your wallet to check your balance.")).toBeInTheDocument();
    });

    it("shows a skeleton while the balance loads", () => {
        payment.current = pay({ isLoading: true });
        renderPanel();
        expect(screen.getByTestId("balance-loading")).toBeInTheDocument();
    });

    it("alt fee token: the ≈ ALT amount on the module fee row and the green enough-ALT line", () => {
        payment.current = pay({ method: "alt", isAltSelected: true, altAsset: { ticker: "ATOM" }, altAmount: new BigNumber("12.5") });
        renderPanel();
        expect(screen.getByText("(≈ 12.5 ATOM)")).toBeInTheDocument();
        expect(screen.getByText("You hold enough ATOM")).toBeInTheDocument();
    });

    it("alt fee token short: orange fallback to the native denom", () => {
        payment.current = pay({
            method: "fallback", isAltSelected: true, altAsset: { ticker: "ATOM" },
            altAmount: new BigNumber("12.5"), altBalanceDisplay: new BigNumber(2),
        });
        renderPanel();
        expect(screen.getByText("Not enough ATOM · paid in BZE")).toBeInTheDocument();
    });

    it("native: green enough line", () => {
        renderPanel();
        expect(screen.getByText("You hold enough BZE")).toBeInTheDocument();
    });

    it("insufficient with an alt token: red line with both balances", () => {
        payment.current = pay({
            method: "insufficient", isAltSelected: true, canPayFee: false, altAsset: { ticker: "ATOM" },
            altBalanceDisplay: new BigNumber(2),
        });
        renderPanel();
        expect(screen.getByText("Not enough ATOM or BZE: you hold 2 ATOM and 3 BZE.")).toBeInTheDocument();
    });

    it("insufficient native: red line with the balance", () => {
        payment.current = pay({ method: "insufficient", canPayFee: false });
        renderPanel();
        expect(screen.getByText("Not enough BZE: you hold 3 BZE.")).toBeInTheDocument();
    });

    it("several fee denoms: one row per denom, the ≈ ALT estimate only on the module fee row", () => {
        payment.current = pay({ method: "alt", isAltSelected: true, altAsset: { ticker: "ATOM" }, altAmount: new BigNumber("12.5") });
        render(
            <PayPanel
                rows={[
                    { label: "Schedule fee", coin: FEE },
                    { label: "Also charged", coin: { denom: "utok", amount: "1000000" } },
                    { label: "Factory fee", text: "None" },
                ]}
                moduleFee={FEE}
                footer={<span>Left in your wallet: plenty</span>}
            />,
            { wrapper },
        );
        expect(screen.getAllByText("25,000 BZE")).toHaveLength(2);
        expect(screen.getAllByText("1 TOK")).toHaveLength(2);
        expect(screen.getByText("None")).toBeInTheDocument();
        expect(screen.getAllByText(/≈ 12.5 ATOM/)).toHaveLength(1);
        expect(screen.getByText("Left in your wallet: plenty")).toBeInTheDocument();
    });
});
