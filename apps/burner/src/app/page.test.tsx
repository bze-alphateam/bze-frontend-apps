import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import { prettyAmount } from "@bze/bze-ui-kit";

// The home page reads the burn history, the next burn and the locked balances from app hooks,
// and coin data from ui-kit hooks. Mock those to feed state directly; no chain or wallet.
const { historyMock, nextBurnMock, pausedMock } = vi.hoisted(() => ({
    historyMock: vi.fn(),
    nextBurnMock: vi.fn(),
    pausedMock: vi.fn(),
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
vi.mock("@/hooks/useAutomationPaused", () => ({ useAutomationPaused: () => pausedMock() }));
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

import { rulesFor } from "@/test-support/css-rules";
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
    pausedMock.mockReturnValue(false);
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

describe("Burner home, countdown", () => {
    it("keeps days, hours, minutes and seconds on one row, sized so four fit a phone", () => {
        nextBurnMock.mockReturnValue({
            nextBurn: { date: new Date(Date.now() + 5 * 86_400_000), coins: [] },
            isLoading: false,
        });
        renderPage();

        const timer = screen.getByRole("timer");
        const boxes = within(timer).getAllByTestId("timer-box");
        expect(boxes).toHaveLength(4);
        expect(rulesFor(timer)).toMatch(/flex-wrap:\s*nowrap/);
        expect(rulesFor(boxes[0].firstElementChild as HTMLElement)).toMatch(/width:\s*56px/);
    });
});

describe("Burner home, automation pause", () => {
    it("shows the countdown while the automation runs", () => {
        renderPage();

        expect(screen.getByRole("timer")).toBeInTheDocument();
        expect(screen.queryByText("Burning is paused for now")).not.toBeInTheDocument();
    });

    it("shows the pause notice instead of the countdown while paused", () => {
        pausedMock.mockReturnValue(true);
        renderPage();

        expect(screen.getByText("Burning is paused for now")).toBeInTheDocument();
        expect(screen.getByText(/Coins wait in the burner and are burned right after it resumes\. Raffles keep running\./)).toBeInTheDocument();
        expect(screen.queryByRole("timer")).not.toBeInTheDocument();
        // Burning and raffles stay available.
        expect(screen.getByRole("button", { name: /Burn coins/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Join a raffle" })).toBeInTheDocument();
    });
});

describe("Burner home, the pot", () => {
    it("labels IBC coins and LP shares as locked and counts only the burning coins in the pot", () => {
        ASSETS["ibc/ABC"] = { denom: "ibc/ABC", ticker: "ATOM", name: "Atom", decimals: 6 };
        nextBurnMock.mockReturnValue({
            nextBurn: {
                date: new Date(Date.now() + 3_600_000),
                coins: [{ denom: "ubze", amount: "1000000" }, { denom: "ibc/ABC", amount: "2000000" }],
            },
            isLoading: false,
        });
        renderPage();

        const [, , pot] = screen.getAllByTestId("burn-stat");
        expect(pot).toHaveTextContent("1");
        expect(screen.getByText("Will Be Locked")).toBeInTheDocument();
        expect(screen.getAllByText("Will be locked")).toHaveLength(1);
        expect(screen.getAllByText("Ready to burn")).toHaveLength(1);
        delete ASSETS["ibc/ABC"];
    });

    it("has no locked section when only burning coins wait", () => {
        renderPage();

        expect(screen.queryByText("Will Be Locked")).not.toBeInTheDocument();
    });
});
