import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";

const { coinParam, pausedMock, lockBalance } = vi.hoisted(() => ({
    coinParam: { current: "ubze" },
    pausedMock: vi.fn(),
    lockBalance: new Map<string, { denom: string; amount: string }>(),
}));

const ASSETS: Record<string, { denom: string; ticker: string; name: string; decimals: number; verified?: boolean }> = {
    ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6 },
    "factory/x/uhoney": { denom: "factory/x/uhoney", ticker: "HONEY", name: "Honey", decimals: 6 },
    "ibc/ABC": { denom: "ibc/ABC", ticker: "ATOM", name: "Atom", decimals: 6 },
    "ulp_1": { denom: "ulp_1", ticker: "LP1", name: "LP One", decimals: 6 },
};

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
    useSearchParams: () => ({ get: () => coinParam.current }),
}));
vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: undefined }) }));
vi.mock("@/hooks/useBurnerContext", () => ({ useBurnerContext: () => ({ lockBalance }) }));
vi.mock("@/hooks/useBurningHistory", () => ({ useBurningHistory: () => ({ burnHistory: [], isLoading: false }) }));
vi.mock("@/hooks/useNextBurning", () => ({
    useNextBurning: () => ({
        nextBurn: { date: new Date(Date.now() + 3_600_000), coins: Object.keys(ASSETS).map(denom => ({ denom, amount: "1000000" })) },
        isLoading: false,
    }),
}));
vi.mock("@/hooks/useAutomationPaused", () => ({ useAutomationPaused: () => pausedMock() }));
vi.mock("@/hooks/useRaffles", () => ({
    useRaffle: () => ({ winners: [], raffle: undefined, isLoading: false }),
    useRaffleContributions: () => ({ getPendingContribution: vi.fn(), removePendingContribution: vi.fn(), markAsClosed: vi.fn() }),
}));
vi.mock("@/components/burn-modal", () => ({ BurnModal: () => null }));
vi.mock("@/components/raffle-modal", () => ({ RaffleModal: () => null }));
vi.mock("@/components/raffle-info-modal", () => ({ RaffleInfoModal: () => null }));
vi.mock("@/components/raffle-result-animation", () => ({ RaffleResultAnimation: () => null }));
vi.mock("@/components/ui/asset_logo", () => ({ AssetLogo: () => null }));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ getAsset: (d: string) => ASSETS[d], denomDecimals: () => 6, isLoading: false }),
        useAssetsValue: () => ({ totalUsdValue: () => new BigNumber(0) }),
        useEpochs: () => ({ hourEpochInfo: undefined }),
    };
});

import CoinDetailPage from "./page";

function renderPage(denom: string) {
    coinParam.current = denom;
    return render(<CoinDetailPage />, {
        wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>,
    });
}

beforeEach(() => {
    pausedMock.mockReturnValue(false);
    lockBalance.clear();
    lockBalance.set("ibc/ABC", { denom: "ibc/ABC", amount: "5000000" });
});

describe("Burner coin page, IBC coins", () => {
    it("explains that IBC coins are locked forever, not burned or exchanged", () => {
        renderPage("ibc/ABC");

        expect(screen.getByText("About IBC coins")).toBeInTheDocument();
        expect(screen.getByText(/BeeZee cannot burn them\. Coins you send here are locked forever/)).toBeInTheDocument();
        expect(screen.queryByText(/exchange these coins to BZE/)).not.toBeInTheDocument();
    });

    it("shows the Forever locked stat, Lock wording and Next locking", () => {
        renderPage("ibc/ABC");

        expect(screen.getByText("Forever locked")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Lock ATOM/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Burn ATOM/ })).not.toBeInTheDocument();
        expect(screen.getByText("Next locking")).toBeInTheDocument();
        expect(screen.queryByText("Total ATOM burned")).not.toBeInTheDocument();
    });
});

describe("Burner coin page, other coins", () => {
    it("keeps the native coin page: burn wording, burned stat, no lock notices", () => {
        renderPage("ubze");

        expect(screen.getByRole("button", { name: /Burn BZE/ })).toBeInTheDocument();
        expect(screen.getByText("Total BZE burned")).toBeInTheDocument();
        expect(screen.getByText("Next burning")).toBeInTheDocument();
        expect(screen.queryByText("Forever locked")).not.toBeInTheDocument();
        expect(screen.queryByText("About IBC coins")).not.toBeInTheDocument();
    });

    it("keeps the factory coin page: burn wording", () => {
        renderPage("factory/x/uhoney");

        expect(screen.getByRole("button", { name: /Burn HONEY/ })).toBeInTheDocument();
        expect(screen.getByText("Total HONEY burned")).toBeInTheDocument();
        expect(screen.queryByText("About IBC coins")).not.toBeInTheDocument();
    });

    it("keeps the LP page: its own notice, Lock wording, Forever locked", () => {
        renderPage("ulp_1");

        expect(screen.getByText("About locking LP coins")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Lock LP1/ })).toBeInTheDocument();
        expect(screen.getByText("Forever locked")).toBeInTheDocument();
        expect(screen.getByText("Next locking")).toBeInTheDocument();
        expect(screen.queryByText("About IBC coins")).not.toBeInTheDocument();
    });
});

describe("Burner coin page, automation pause", () => {
    it("says Paused with the tooltip instead of the next burn date", () => {
        pausedMock.mockReturnValue(true);
        renderPage("ubze");

        const paused = screen.getByText("Paused");
        expect(paused.closest("[title]")).toHaveAttribute("title", expect.stringContaining("Burning is paused for now"));
        expect(screen.getByRole("button", { name: /Burn BZE/ })).toBeInTheDocument();
    });

    it("shows the date while running", () => {
        renderPage("ubze");

        expect(screen.queryByText("Paused")).not.toBeInTheDocument();
    });
});
