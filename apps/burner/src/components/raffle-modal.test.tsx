import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// The modal reads the wallet, balance, asset and affordability from hooks. Mock them to feed
// state directly; no chain or wallet. Affordability always passes, as it does when the fee coin
// differs: the modal's own balance check against the ticket cost is what is under test.
const { balanceMock, assetMock, affordMock } = vi.hoisted(() => ({
    balanceMock: vi.fn(),
    assetMock: vi.fn(),
    affordMock: vi.fn(),
}));

vi.mock("@interchain-kit/react", () => ({ useChain: () => ({ address: "bze1user" }) }));
vi.mock("@/hooks/useRaffles", () => ({ useRaffleContributions: () => ({ addPendingRaffleContribution: vi.fn() }) }));
vi.mock("@/components/ui/burner/dialog", async () => {
    const actual = await vi.importActual<typeof import("@/components/ui/burner/dialog")>("@/components/ui/burner/dialog");
    return {
        ...actual,
        BurnerDialog: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div>{children}{footer}</div>,
    };
});
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        getChainName: () => "beezee",
        useToast: () => ({ toast: { error: vi.fn() } }),
        useBZETx: () => ({ tx: vi.fn() }),
        useBalance: () => balanceMock(),
        useAsset: () => assetMock(),
        useCanAffordTx: (input: unknown) => affordMock(input),
    };
});

import { RaffleModal } from "./raffle-modal";

function renderModal(ticketPrice: string) {
    return render(
        <RaffleModal
            isOpen
            onClose={vi.fn()}
            raffleName="HONEY Raffle"
            contributionPrice="1,500"
            ticketPrice={ticketPrice}
            currentPrize="10,000"
            winChance="1 in 10"
            ticker="HONEY"
            denom="factory/x/uhoney"
        />,
        { wrapper: ({ children }: { children: ReactNode }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider> },
    );
}

describe("RaffleModal", () => {
    beforeEach(() => {
        assetMock.mockReturnValue({ asset: { denom: "factory/x/uhoney", ticker: "HONEY", decimals: 6 } });
        affordMock.mockReturnValue({ canAfford: true, shortOnFees: false, message: "" });
    });

    it("prices tickets of 1,000+ units exactly and disables Join when the balance is short", () => {
        // 1500 HONEY per ticket, wallet holds 1000.
        balanceMock.mockReturnValue({ balance: { denom: "factory/x/uhoney", amount: "1000000000" } });
        renderModal("1500000000");

        expect(screen.getByText("1500.00 HONEY")).toBeTruthy();
        expect(screen.getByRole("button", { name: /Join raffle/ }).hasAttribute("disabled")).toBe(true);
        expect(affordMock).toHaveBeenLastCalledWith({
            spec: "join-raffle",
            spend: { denom: "factory/x/uhoney", amount: "1500000000" },
        });
    });

    it("enables Join when the balance covers the ticket cost", () => {
        balanceMock.mockReturnValue({ balance: { denom: "factory/x/uhoney", amount: "2000000000" } });
        renderModal("1500000000");

        expect(screen.getByRole("button", { name: /Join raffle/ }).hasAttribute("disabled")).toBe(false);
    });
});
