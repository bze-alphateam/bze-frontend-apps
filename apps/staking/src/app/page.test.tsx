import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";

// Drive the page purely off its data hook + wallet status; the child sections
// pull in price/wallet hooks of their own, so we stub them to markers and assert
// the page's compose-by-state logic (which sections show for which data).
const { useStakingDataMock, useChainMock } = vi.hoisted(() => ({
    useStakingDataMock: vi.fn(),
    useChainMock: vi.fn(),
}));

vi.mock("@/hooks/useNativeStakingData", () => ({
    useNativeStakingData: () => useStakingDataMock(),
}));
vi.mock("@interchain-kit/react", () => ({
    useChain: () => useChainMock(),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return { ...actual, useValidatorLogos: () => ({ logos: {} }) };
});

vi.mock("@/components/staking/overview", () => ({
    StakingOverview: () => <div data-testid="overview" />,
}));
vi.mock("@/components/staking/validators-list", () => ({
    ValidatorsList: () => <div data-testid="validators-list" />,
}));
vi.mock("@/components/staking/my-validators", () => ({
    MyValidators: () => <div data-testid="my-validators" />,
}));
vi.mock("@/components/staking/unbonding-delegations", () => ({
    UnbondingDelegations: () => <div data-testid="unbonding" />,
}));

import StakingPage from "./page";

function renderPage() {
    return render(<StakingPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

function fullData(overrides: Record<string, unknown> = {}) {
    return {
        stakingData: { averageApr: "10", unlockDuration: 14 },
        allValidators: [],
        myValidators: [],
        unbondingDelegations: [],
        validatorRewards: [],
        ...overrides,
    };
}

beforeEach(() => {
    useStakingDataMock.mockReset();
    useChainMock.mockReset();
    // Connected by default; the loading test doesn't depend on wallet status.
    useChainMock.mockReturnValue({ status: WalletState.Connected });
});

describe("Staking page", () => {
    it("shows the loading state until the first data load resolves", () => {
        useStakingDataMock.mockReturnValue({
            isLoading: true,
            fullData: undefined,
            reload: vi.fn(),
        });
        renderPage();

        expect(screen.getByText("Loading staking data...")).toBeInTheDocument();
        expect(screen.queryByTestId("overview")).not.toBeInTheDocument();
    });

    it("renders the overview, my-validators and the list once data has loaded", () => {
        useStakingDataMock.mockReturnValue({
            isLoading: false,
            reload: vi.fn(),
            fullData: fullData({
                allValidators: [{ operator_address: "v1" }],
                myValidators: [{ validator: { operator_address: "v1" } }],
            }),
        });
        renderPage();

        expect(screen.getByTestId("overview")).toBeInTheDocument();
        expect(screen.getByTestId("validators-list")).toBeInTheDocument();
        expect(screen.getByTestId("my-validators")).toBeInTheDocument();
    });

    it("hides the list and my-validators sections when there is no data for them", () => {
        useStakingDataMock.mockReturnValue({
            isLoading: false,
            reload: vi.fn(),
            fullData: fullData(),
        });
        renderPage();

        expect(screen.getByTestId("overview")).toBeInTheDocument();
        expect(screen.queryByTestId("validators-list")).not.toBeInTheDocument();
        expect(screen.queryByTestId("my-validators")).not.toBeInTheDocument();
    });
});
