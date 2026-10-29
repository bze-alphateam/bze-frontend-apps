import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

// Wallet, balance, fee and tx hooks are stubbed; the rest of ui-kit stays real. useCanAffordTx runs
// ui-kit's real canAffordTx against `gas` (the network fee in the Settings fee token) and `wallet`.
const { gas, wallet } = vi.hoisted(() => ({
    gas: { denom: "ubze", amount: "100000" },
    wallet: { current: {} as Record<string, string> },
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const { default: BN } = await import("bignumber.js");
    const tickers: Record<string, string> = { ubze: "BZE", uusdc: "USDC" };
    return {
        ...actual,
        useCanAffordTx: ({ spec, spend }: { spec?: unknown; spend?: { denom: string; amount: string } }) => {
            if (spec === undefined) return { canAfford: true, shortfalls: [], shortOnFees: false, message: "", isLoading: false };
            const result = actual.canAffordTx({
                spend,
                gasFee: { denom: gas.denom, amount: new BN(gas.amount) },
                balanceOf: (denom: string) => new BN(wallet.current[denom] ?? "0"),
            });
            const short = result.shortfalls[0];
            return {
                ...result,
                message: short ? `Not enough ${tickers[short.denom]} left for the network fee` : "",
                isLoading: false,
            };
        },
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
const { chainMock } = vi.hoisted(() => ({ chainMock: { current: {} as Record<string, unknown> } }));
vi.mock("@interchain-kit/react", () => ({
    useChain: () => chainMock.current,
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

beforeEach(() => {
    chainMock.current = { address: "bze1me", status: WalletState.Connected, connect: vi.fn() };
    gas.denom = "ubze";
    gas.amount = "100000";
    wallet.current = { ubze: "10000000" };
});

function renderModal(v: ValidatorSDKType, props: Partial<Parameters<typeof DelegateModal>[0]> = {}) {
    return render(<DelegateModal isOpen onClose={vi.fn()} validator={v} onSuccess={vi.fn()} {...props} />, {
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

        expect(await screen.findByText("Stake with Alice Node")).toBeInTheDocument();
        expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
    });

    it("offers the copy stake link as an icon only", async () => {
        renderModal(validator({}));

        expect(await screen.findByRole("button", { name: /Copy stake link/ })).toBeInTheDocument();
        expect(screen.queryByText(/Copy stake link/)).not.toBeInTheDocument();
    });

    it("without a wallet, hands Connect Wallet to the page instead of closing", async () => {
        const connect = vi.fn();
        chainMock.current = { address: undefined, status: WalletState.Disconnected, connect };
        const onClose = vi.fn();
        const onConnectWallet = vi.fn();
        const user = userEvent.setup();
        renderModal(validator({}), { onClose, onConnectWallet });

        await user.click(await screen.findByRole("button", { name: /Connect Wallet/ }));

        expect(onConnectWallet).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
        expect(connect).not.toHaveBeenCalled();
    });
});

// sanitizeNumberInput lets a lone "." through. BigNumber reads it as NaN, which is not lte(0),
// so the button used to enable as "Stake . BZE" and send amount "NaN".
describe("DelegateModal amount validation", () => {
    it("keeps Stake disabled for a lone decimal point", async () => {
        const user = userEvent.setup();
        renderModal(validator({}));

        await user.type(await screen.findByPlaceholderText("0.00"), ".");

        expect(screen.getByRole("button", { name: /^Stake/ })).toBeDisabled();
        expect(screen.queryByText(/leaves less than the network fee/)).not.toBeInTheDocument();
    });

    it("enables Stake for a positive amount", async () => {
        const user = userEvent.setup();
        renderModal(validator({}));

        await user.type(await screen.findByPlaceholderText("0.00"), "1");

        expect(screen.getByRole("button", { name: "Stake 1 BZE" })).toBeEnabled();
    });

    // regression: typed decimals past BZE's 6 became fractional micro-units in MsgDelegate
    it("drops typed digits past the asset decimals", async () => {
        const user = userEvent.setup();
        renderModal(validator({}));

        await user.type(await screen.findByPlaceholderText("0.00"), "1.12345678");

        expect(screen.getByPlaceholderText("0.00")).toHaveValue("1.123456");
    });
});

// Regression: with a non-BZE fee token picked in Settings and none of it in the wallet, the modal
// only checked BZE. Stake stayed enabled, the fee simulation failed, and the tx silently paid a
// default fee in BZE (or, at MAX, failed on chain after paying it).
describe("DelegateModal fee token", () => {
    beforeEach(() => {
        gas.denom = "uusdc";
        gas.amount = "30000";
    });

    it("blocks Stake and says why when the wallet holds none of the fee token", async () => {
        const user = userEvent.setup();
        renderModal(validator({}));

        await user.type(await screen.findByPlaceholderText("0.00"), "1");

        expect(screen.getByRole("button", { name: "Stake 1 BZE" })).toBeDisabled();
        expect(screen.getByText("Not enough USDC left for the network fee")).toBeInTheDocument();
    });

    it("enables Stake when the fee token covers the network fee", async () => {
        wallet.current = { ubze: "10000000", uusdc: "30000" };
        const user = userEvent.setup();
        renderModal(validator({}));

        await user.type(await screen.findByPlaceholderText("0.00"), "1");

        expect(screen.getByRole("button", { name: "Stake 1 BZE" })).toBeEnabled();
        expect(screen.queryByText(/left for the network fee/)).not.toBeInTheDocument();
    });
});

// The dialog used to focus its first tabbable element, the copy-link icon in the title, and a
// form opened from a stake link (no click before it) then showed the focus ring around it.
describe("DelegateModal initial focus", () => {
    // jsdom has no layout, so the dialog's focus logic would see every element as hidden and
    // never pick the icon. Give elements a box, as a browser does.
    let rects: { mockRestore: () => void };
    beforeEach(() => {
        rects = vi
            .spyOn(HTMLElement.prototype, "getClientRects")
            .mockReturnValue([new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList);
    });
    afterEach(() => rects.mockRestore());

    it("focuses the amount field, not the copy-link icon", async () => {
        renderModal(validator({}));

        const amount = await screen.findByPlaceholderText("0.00");
        await waitFor(() => expect(amount).toHaveFocus());
        expect(screen.getByRole("button", { name: /Copy stake link/ })).not.toHaveFocus();
    });

    it("without a wallet, focuses the dialog itself, not the copy-link icon", async () => {
        chainMock.current = { address: undefined, status: WalletState.Disconnected, connect: vi.fn() };
        renderModal(validator({}));

        const dialog = await screen.findByRole("dialog");
        await waitFor(() => expect(dialog).toHaveFocus());
        expect(screen.getByRole("button", { name: /Copy stake link/ })).not.toHaveFocus();
    });
});
