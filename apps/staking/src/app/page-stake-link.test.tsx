import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";

// A ?stake=<operator> link opened without a wallet: the real link handler drives the page, and
// only the delegate form may open — never the connect-wallet sidebar next to it.
const { useStakingDataMock, useChainMock, searchParamsMock } = vi.hoisted(() => ({
    useStakingDataMock: vi.fn(),
    useChainMock: vi.fn(),
    searchParamsMock: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: vi.fn() }),
    usePathname: () => "/",
    useSearchParams: () => searchParamsMock.current,
}));
vi.mock("@/hooks/useNativeStakingData", () => ({
    useNativeStakingData: () => useStakingDataMock(),
}));
vi.mock("@interchain-kit/react", () => ({
    useChain: () => useChainMock(),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useValidatorLogos: () => ({ logos: {} }),
        WalletSidebarContent: () => <div data-testid="wallet-sidebar" />,
    };
});
vi.mock("@/components/staking/overview", () => ({
    StakingOverview: () => null,
}));
vi.mock("@/components/staking/validators-list", () => ({
    ValidatorsList: () => null,
}));
vi.mock("@/components/staking/delegate-modal", () => ({
    DelegateModal: ({ isOpen, validator }: { isOpen: boolean; validator: { operator_address: string } | null }) =>
        isOpen ? <div data-testid="delegate-form">{validator?.operator_address}</div> : null,
}));

import StakingPage from "./page";

const ALICE = "bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu";

beforeEach(() => {
    searchParamsMock.current = new URLSearchParams(`stake=${ALICE}`);
    useChainMock.mockReturnValue({ status: WalletState.Disconnected });
    useStakingDataMock.mockReturnValue({
        isLoading: false,
        reload: vi.fn(),
        fullData: {
            stakingData: { averageApr: "10", unlockDuration: 14 },
            allValidators: [{ operator_address: ALICE, description: { moniker: "Alice Node" } }],
            myValidators: [],
            unbondingDelegations: [],
            validatorRewards: [],
        },
    });
});

describe("Staking page, stake link without a wallet", () => {
    it("opens the delegate form and leaves the connect-wallet sidebar closed", async () => {
        render(<StakingPage />, {
            wrapper: ({ children }: { children: ReactNode }) => (
                <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
            ),
        });

        expect(await screen.findByTestId("delegate-form")).toHaveTextContent(ALICE);
        expect(screen.queryByTestId("wallet-sidebar")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Connect Wallet to Stake/ })).toBeInTheDocument();
    });
});
