import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
// The hero holds the page's Connect Wallet to Stake sidebar, so the stub renders its actions.
vi.mock("@/components/staking/overview", () => ({
    StakingOverview: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/components/staking/validators-list", () => ({
    ValidatorsList: () => null,
}));
vi.mock("@/components/staking/delegate-modal", () => ({
    DelegateModal: ({ isOpen, validator, onConnectWallet }: {
        isOpen: boolean;
        validator: { operator_address: string } | null;
        onConnectWallet?: () => void;
    }) =>
        isOpen ? (
            <div data-testid="delegate-form">
                {validator?.operator_address}
                <button onClick={onConnectWallet}>Form Connect Wallet</button>
            </div>
        ) : null,
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

function renderPage() {
    return render(<StakingPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

describe("Staking page, stake link without a wallet", () => {
    it("opens the delegate form and leaves the connect-wallet sidebar closed", async () => {
        renderPage();

        expect(await screen.findByTestId("delegate-form")).toHaveTextContent(ALICE);
        expect(screen.queryByTestId("wallet-sidebar")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Connect Wallet to Stake/ })).toBeInTheDocument();
    });

    it("brings the form back once the wallet connects from the form's sidebar", async () => {
        const user = userEvent.setup();
        const { rerender } = renderPage();

        await user.click(await screen.findByRole("button", { name: "Form Connect Wallet" }));

        expect(screen.queryByTestId("delegate-form")).not.toBeInTheDocument();
        expect(screen.getByTestId("wallet-sidebar")).toBeInTheDocument();

        useChainMock.mockReturnValue({ status: WalletState.Connected });
        rerender(<StakingPage />);

        expect(await screen.findByTestId("delegate-form")).toHaveTextContent(ALICE);
        expect(screen.queryByTestId("wallet-sidebar")).not.toBeInTheDocument();
    });

    it("brings the form back when that sidebar is closed without connecting", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("button", { name: "Form Connect Wallet" }));
        await user.click(screen.getByRole("button", { name: "Close sidebar" }));

        expect(await screen.findByTestId("delegate-form")).toHaveTextContent(ALICE);
        expect(screen.queryByTestId("wallet-sidebar")).not.toBeInTheDocument();
    });
});
