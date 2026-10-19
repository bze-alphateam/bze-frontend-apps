import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import { prettyAmount } from "@bze/bze-ui-kit";

// The home page reads the burn history, the next burn and the locked balances from app hooks,
// and coin data from ui-kit hooks. Mock those to feed state directly; no chain or wallet.
const { historyMock, nextBurnMock } = vi.hoisted(() => ({
    historyMock: vi.fn(),
    nextBurnMock: vi.fn(),
}));

const ASSETS: Record<string, { denom: string; ticker: string; name: string; decimals: number }> = {
    ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6 },
    "factory/x/uhoney": { denom: "factory/x/uhoney", ticker: "HONEY", name: "Honey", decimals: 6 },
    ulocked: { denom: "ulocked", ticker: "LOCK", name: "Locked Coin", decimals: 6 },
};

// Every coin is worth 2 USD a unit.
const usd = (items: { amount: BigNumber }[]) => items.reduce((t, i) => t.plus(i.amount.multipliedBy(2)), new BigNumber(0));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useBurningHistory", () => ({ useBurningHistory: () => historyMock() }));
vi.mock("@/hooks/useNextBurning", () => ({ useNextBurning: () => nextBurnMock() }));
vi.mock("@/hooks/useBurnerContext", () => ({
    useBurnerContext: () => ({ lockBalance: new Map([["ulocked", { denom: "ulocked", amount: "3000000" }]]) }),
}));
vi.mock("@/components/burn-modal", () => ({ BurnModal: () => null }));
vi.mock("@/components/ui/asset_logo", () => ({ AssetLogo: () => null }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({
            getAsset: (denom: string) => ASSETS[denom],
            nativeAsset: ASSETS.ubze,
            denomDecimals: () => 6,
        }),
        useAsset: (denom: string) => ({ asset: ASSETS[denom] }),
        useAssetsValue: () => ({ totalUsdValue: usd }),
    };
});

import BurnerHomePage from "./page";

function burn(denom: string, amount: number) {
    return { denom, amount: new BigNumber(amount), usdValue: new BigNumber(amount * 2), blockHeight: 10, timestamp: "today" };
}

function renderPage() {
    return render(<BurnerHomePage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    historyMock.mockReturnValue({
        burnHistory: [burn("ubze", 1000), burn("factory/x/uhoney", 70), burn("ubze", 500)],
        isLoading: false,
    });
    nextBurnMock.mockReturnValue({
        nextBurn: {
            date: new Date(Date.now() + 3_600_000),
            coins: [{ denom: "ubze", amount: "1000000" }, { denom: "factory/x/uhoney", amount: "5000000" }],
        },
        isLoading: false,
    });
});

describe("Burner home, stat tiles", () => {
    it("shows the three values the old Total BZE Incinerated card showed", () => {
        renderPage();

        const [burned, locked, pot] = screen.getAllByTestId("burn-stat");

        // Total BZE burned: only the native coin's burns, with its USD value.
        expect(within(burned).getByText("Total BZE incinerated")).toBeInTheDocument();
        expect(burned).toHaveTextContent(`${prettyAmount(new BigNumber(1500))} BZE`);
        expect(burned).toHaveTextContent(`≈ $${prettyAmount(new BigNumber(3000))}`);

        // Value locked forever: the USD value of every locked coin, and how many coins.
        expect(within(locked).getByText("Total value locked forever")).toBeInTheDocument();
        expect(locked).toHaveTextContent(`$${prettyAmount(new BigNumber(6))}`);
        expect(locked).toHaveTextContent("1 coin");

        // Coins in the pot: the coins of the next burn.
        expect(within(pot).getByText("Coins in the pot")).toBeInTheDocument();
        expect(pot).toHaveTextContent("2");
    });

    it("says Loading... in the burned tile while the history loads", () => {
        historyMock.mockReturnValue({ burnHistory: [], isLoading: true });
        renderPage();

        expect(screen.getAllByTestId("burn-stat")[0]).toHaveTextContent("Loading...");
    });

    it("keeps the countdown copy: Next burn in, or No burning scheduled", () => {
        nextBurnMock.mockReturnValue({ nextBurn: undefined, isLoading: false });
        renderPage();

        expect(screen.getByRole("heading", { name: "Next burn in" })).toBeInTheDocument();
        expect(screen.getByText("No burning scheduled")).toBeInTheDocument();
    });
});
