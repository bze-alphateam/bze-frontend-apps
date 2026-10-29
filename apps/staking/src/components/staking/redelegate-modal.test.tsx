import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { RedelegateModal } from "./redelegate-modal";

function validator(operator: string, moniker: string): ValidatorSDKType {
    return {
        operator_address: operator,
        description: { moniker },
        commission: { commission_rates: { rate: "0.05" } },
        tokens: "1000000",
    } as unknown as ValidatorSDKType;
}

const SOURCE = validator("bzevaloper1alice", "Alice Node");
const DEST = validator("bzevaloper1bob", "Bob Node");

function renderModal() {
    return render(
        <RedelegateModal
            isOpen
            onClose={vi.fn()}
            sourceValidator={SOURCE}
            allValidators={[SOURCE, DEST]}
            delegatedAmount={new BigNumber("5000000")}
            onSuccess={vi.fn()}
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

// sanitizeNumberInput lets a lone "." through. BigNumber reads it as NaN, which is not lte(0),
// so the button used to enable as "Move . BZE" and send amount "NaN".
describe("RedelegateModal amount validation", () => {
    it("keeps Move disabled for a lone decimal point", async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(await screen.findByRole("button", { name: /Bob Node/ }));
        await user.type(screen.getByPlaceholderText("0.00"), ".");

        expect(screen.getByRole("button", { name: /^Move/ })).toBeDisabled();
    });

    it("enables Move for a positive amount and a destination", async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(await screen.findByRole("button", { name: /Bob Node/ }));
        await user.type(screen.getByPlaceholderText("0.00"), "1");

        expect(screen.getByRole("button", { name: "Move 1 BZE" })).toBeEnabled();
    });
});
