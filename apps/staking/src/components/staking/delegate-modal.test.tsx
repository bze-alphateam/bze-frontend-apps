import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

// Wallet, balance, fee and tx hooks are stubbed; the rest of ui-kit stays real.
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ nativeAsset: { denom: "ubze", ticker: "BZE", decimals: 6 } }),
        useBalance: () => ({ balance: { amount: new BigNumber("10000000"), denom: "ubze" } }),
        useMaxSpendable: () => ({
            amount: new BigNumber("9000000"),
            displayAmount: new BigNumber("9"),
            inputValue: "9",
            gasFee: { displayAmount: new BigNumber("0.1"), ticker: "BZE" },
        }),
        useSDKTx: () => ({ tx: vi.fn(), progressTrack: "" }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
    };
});
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: "bze1me", status: WalletState.Connected, connect: vi.fn() }),
}));

import { DelegateModal } from "./delegate-modal";

function validator(overrides: Record<string, unknown>): ValidatorSDKType {
    return {
        operator_address: "bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu",
        description: { moniker: "Alice Node" },
        commission: { commission_rates: { rate: "0.05" } },
        jailed: false,
        status: "BOND_STATUS_BONDED",
        ...overrides,
    } as unknown as ValidatorSDKType;
}

function renderModal(v: ValidatorSDKType) {
    return render(<DelegateModal isOpen onClose={vi.fn()} validator={v} onSuccess={vi.fn()} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

const WARNING = /does not earn rewards while jailed or outside the active set/;

describe("DelegateModal", () => {
    it("warns that a jailed validator earns no rewards", async () => {
        renderModal(validator({ jailed: true, status: "BOND_STATUS_UNBONDING" }));

        expect(await screen.findByText(WARNING)).toBeInTheDocument();
        expect(screen.getByText(/This validator is jailed/)).toBeInTheDocument();
    });

    it("warns for a validator outside the active set", async () => {
        renderModal(validator({ status: "BOND_STATUS_UNBONDED" }));

        expect(await screen.findByText(/outside the active set\. It does not/)).toBeInTheDocument();
    });

    it("shows no warning for an active validator", async () => {
        renderModal(validator({}));

        expect(await screen.findByText("Delegate to Alice Node")).toBeInTheDocument();
        expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
    });

    it("offers the copy stake link action", async () => {
        renderModal(validator({}));

        expect(await screen.findByRole("button", { name: /Copy stake link/ })).toBeInTheDocument();
    });
});
