import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

// The modal pulls wallet, tx and fee hooks from ui-kit / interchain-kit; stub
// them and keep the rest of ui-kit (prettyAmount, …) real.
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ nativeAsset: { denom: "ubze", ticker: "BZE", decimals: 6 } }),
        useSDKTx: () => ({ tx: vi.fn(), progressTrack: "" }),
        useCanAffordTx: () => ({ canAfford: true, message: "" }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
    };
});
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: "bze1me", status: WalletState.Connected, connect: vi.fn() }),
}));

import { UndelegateModal } from "./undelegate-modal";

const VALIDATOR = {
    operator_address: "bzevaloper1alice",
    description: { moniker: "Alice Node" },
} as unknown as ValidatorSDKType;

function renderModal(unbondingDays?: string) {
    return render(
        <UndelegateModal
            isOpen
            onClose={vi.fn()}
            validator={VALIDATOR}
            delegatedAmount={new BigNumber("5000000")}
            onSuccess={vi.fn()}
            unbondingDays={unbondingDays}
        />,
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
            ),
        },
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("UndelegateModal", () => {
    it("states the unbonding period length", async () => {
        renderModal("14");

        expect(await screen.findByText("14 days")).toBeInTheDocument();
        expect(screen.getByText(/the unbonding period\) and earn no rewards/)).toBeInTheDocument();
    });

    it("falls back to the generic wording when the length is not loaded", async () => {
        renderModal(undefined);

        expect(
            await screen.findByText("Unstaked tokens will be locked for the unbonding period before becoming available."),
        ).toBeInTheDocument();
        expect(screen.queryByText(/days/)).not.toBeInTheDocument();
    });
});
