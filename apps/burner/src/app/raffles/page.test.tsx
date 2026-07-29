import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { RaffleSDKType } from "@bze/bzejs/bze/burner/raffle";

// The raffles page reads useRaffles (app hook) for the list; each card resolves
// its asset + current epoch via ui-kit hooks and navigation is next/navigation.
// Mock those to feed state directly — no wallet/chain providers.
const { useRafflesMock, useAssetMock, useEpochsMock, pushMock } = vi.hoisted(() => ({
    useRafflesMock: vi.fn(),
    useAssetMock: vi.fn(),
    useEpochsMock: vi.fn(),
    pushMock: vi.fn(),
}));

vi.mock("@/hooks/useRaffles", () => ({ useRaffles: () => useRafflesMock() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
// Static info panel + logo aren't under test; stub them to keep the tree small.
vi.mock("@/components/raffle-info", () => ({ RaffleInfo: () => null }));
vi.mock("@/components/ui/asset_logo", () => ({ AssetLogo: () => null }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAsset: (denom: string) => useAssetMock(denom),
        useEpochs: () => useEpochsMock(),
    };
});

import RafflesPage from "./page";

const TICKERS: Record<string, string> = {
    "factory/x/uhoney": "HONEY",
    "factory/x/umilk": "MILK",
};

function raffle(denom: string, overrides: Partial<RaffleSDKType> = {}): RaffleSDKType {
    return {
        denom,
        pot: "1000000",
        ratio: "0.5",
        chances: "1000",
        ticket_price: "100000",
        end_at: 200,
        duration: 0,
        winners: 0,
        total_won: "0",
        ...overrides,
    } as unknown as RaffleSDKType;
}

function renderPage() {
    return render(<RafflesPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useRafflesMock.mockReset();
    useAssetMock.mockReset();
    useEpochsMock.mockReset();
    pushMock.mockReset();
    useEpochsMock.mockReturnValue({ hourEpochInfo: { current_epoch: 100 } });
    useAssetMock.mockImplementation((denom: string) => ({
        asset: {
            denom,
            ticker: TICKERS[denom] ?? denom,
            name: `${TICKERS[denom] ?? denom} Token`,
            decimals: 6,
            logo: "",
            type: "factory",
            verified: false,
            stable: false,
            supply: 0n,
        },
    }));
});

describe("Raffles page", () => {
    it("shows the loading state while raffles load", () => {
        useRafflesMock.mockReturnValue({ raffles: [], isLoading: true });
        renderPage();

        expect(screen.getByText("Loading raffles...")).toBeInTheDocument();
        expect(screen.queryByText("No Active Raffles")).not.toBeInTheDocument();
    });

    it("shows the empty state when there are no active raffles", () => {
        useRafflesMock.mockReturnValue({ raffles: [], isLoading: false });
        renderPage();

        expect(screen.getByText("No Active Raffles")).toBeInTheDocument();
        expect(screen.queryByText("Loading raffles...")).not.toBeInTheDocument();
    });

    it("renders a card per active raffle", () => {
        useRafflesMock.mockReturnValue({
            raffles: [raffle("factory/x/uhoney"), raffle("factory/x/umilk")],
            isLoading: false,
        });
        renderPage();

        expect(screen.getByText("HONEY Raffle")).toBeInTheDocument();
        expect(screen.getByText("MILK Raffle")).toBeInTheDocument();
        expect(screen.queryByText("No Active Raffles")).not.toBeInTheDocument();
    });

    it("navigates to the coin page when a raffle card is clicked", async () => {
        const user = userEvent.setup();
        useRafflesMock.mockReturnValue({
            raffles: [raffle("factory/x/uhoney")],
            isLoading: false,
        });
        renderPage();

        // Clicking anywhere in the card bubbles to the card's onClick.
        await user.click(screen.getByText("HONEY Raffle"));
        expect(pushMock).toHaveBeenCalledWith("/coin?coin=factory/x/uhoney");
    });
});
