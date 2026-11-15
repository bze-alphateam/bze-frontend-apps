import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";

// Valid bech32 addresses (20-byte payloads), so ui-kit's real address check runs.
const ME = "bze1qyqszqgpqyqszqgpqyqszqgpqyqszqgp0hd4lt";
const OTHER = "bze1qgpqyqszqgpqyqszqgpqyqszqgpqyqsz7nts5a";
const NEW = "bze1qvpsxqcrqvpsxqcrqvpsxqcrqvpsxqcrlr237u";
const VALOPER = "bzevaloper1qyqszqgpqyqszqgpqyqszqgpqyqszqgphnj7t5";
const COSMOS = "cosmos1qvpsxqcrqvpsxqcrqvpsxqcrqvpsxqcrz8x6vt";

const { txMock, withdrawAddressMock } = vi.hoisted(() => ({
    txMock: vi.fn(),
    withdrawAddressMock: vi.fn(),
}));

// Stub the wallet, tx, fee and chain-query hooks; keep the rest of ui-kit (address check, Notice, …) real.
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useSDKTx: () => ({ tx: txMock, progressTrack: "" }),
        useCanAffordTx: () => ({ canAfford: true, message: "" }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
        getChainAddressPrefix: () => "bze",
        getDelegatorWithdrawAddress: withdrawAddressMock,
    };
});
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: ME, status: WalletState.Connected, connect: vi.fn() }),
}));

import { WithdrawAddressModal } from "./withdraw-address-modal";

function renderModal() {
    const onSuccess = vi.fn();
    render(<WithdrawAddressModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
    return { onSuccess };
}

beforeEach(() => {
    txMock.mockReset();
    withdrawAddressMock.mockReset();
});

describe("WithdrawAddressModal", () => {
    it("explains that only rewards are redirected, never unstaked tokens", async () => {
        withdrawAddressMock.mockResolvedValue(ME);
        renderModal();

        expect(await screen.findByText("This wallet")).toBeInTheDocument();
        expect(screen.getByText(/only changes where your staking rewards are paid/)).toBeInTheDocument();
        expect(screen.getByText(/Unstaked BZE always returns to this wallet/)).toBeInTheDocument();
        expect(withdrawAddressMock).toHaveBeenCalledWith(ME);
    });

    it("sends one MsgSetWithdrawAddress for a new bze address", async () => {
        withdrawAddressMock.mockResolvedValue(ME);
        txMock.mockResolvedValue(true);
        const user = userEvent.setup();
        const { onSuccess } = renderModal();
        await screen.findByText("This wallet");

        await user.type(screen.getByLabelText("New rewards address"), NEW);
        await user.click(screen.getByRole("button", { name: "Set address" }));

        expect(txMock).toHaveBeenCalledTimes(1);
        const [messages, options] = txMock.mock.calls[0];
        expect(options).toEqual({ abortOnSimulationError: true });
        expect(messages).toHaveLength(1);
        expect(messages[0].typeUrl).toBe("/cosmos.distribution.v1beta1.MsgSetWithdrawAddress");
        expect(messages[0].value).toMatchObject({ delegatorAddress: ME, withdrawAddress: NEW });
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("refuses a validator address and another network's address", async () => {
        withdrawAddressMock.mockResolvedValue(ME);
        const user = userEvent.setup();
        renderModal();
        await screen.findByText("This wallet");
        const field = screen.getByLabelText("New rewards address");

        await user.type(field, VALOPER);
        expect(screen.getByRole("alert")).toHaveTextContent(/validator address/);
        expect(screen.getByRole("button", { name: "Set address" })).toBeDisabled();

        await user.clear(field);
        await user.type(field, COSMOS);
        expect(screen.getByRole("alert")).toHaveTextContent(/another network/);
        expect(screen.getByRole("button", { name: "Set address" })).toBeDisabled();
        expect(txMock).not.toHaveBeenCalled();
    });

    it("warns when rewards go elsewhere and resets them to the wallet", async () => {
        withdrawAddressMock.mockResolvedValue(OTHER);
        txMock.mockResolvedValue(true);
        const user = userEvent.setup();
        renderModal();

        expect(await screen.findByTestId("current-withdraw-address")).toHaveTextContent(OTHER);
        expect(screen.getByText(/not the connected wallet/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Use this wallet" }));
        expect(screen.getByLabelText("New rewards address")).toHaveValue(ME);
        await user.click(screen.getByRole("button", { name: "Set address" }));

        expect(txMock.mock.calls[0][0][0].value).toMatchObject({ delegatorAddress: ME, withdrawAddress: ME });
    });

    it("hides the reset shortcut when rewards already go to the wallet", async () => {
        withdrawAddressMock.mockResolvedValue(ME);
        renderModal();
        await screen.findByText("This wallet");

        expect(screen.queryByRole("button", { name: "Use this wallet" })).not.toBeInTheDocument();
    });
});
