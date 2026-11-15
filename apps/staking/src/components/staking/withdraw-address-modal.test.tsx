import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";

// Valid bech32 addresses (20-byte payloads), so ui-kit's real address check runs.
const ME = "bze1qyqszqgpqyqszqgpqyqszqgpqyqszqgp0hd4lt";
const OTHER = "bze1qgpqyqszqgpqyqszqgpqyqszqgpqyqsz7nts5a";
const NEW = "bze1qvpsxqcrqvpsxqcrqvpsxqcrqvpsxqcrlr237u";
const VALOPER = "bzevaloper1qyqszqgpqyqszqgpqyqszqgpqyqszqgphnj7t5";
const COSMOS = "cosmos1qvpsxqcrqvpsxqcrqvpsxqcrqvpsxqcrz8x6vt";

const { txMock, withdrawAddressMock, toastErrorMock, chainState } = vi.hoisted(() => ({
    txMock: vi.fn(),
    withdrawAddressMock: vi.fn(),
    toastErrorMock: vi.fn(),
    // The connected account; a test switches it to mimic an account change in the wallet.
    chainState: { address: "" },
}));

// Stub the wallet, tx, fee and chain-query hooks; keep the rest of ui-kit (address check, Notice, …) real.
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useSDKTx: () => ({ tx: txMock, progressTrack: "" }),
        useCanAffordTx: () => ({ canAfford: true, message: "" }),
        useToast: () => ({ toast: { success: vi.fn(), error: toastErrorMock } }),
        getChainAddressPrefix: () => "bze",
        getDelegatorWithdrawAddress: withdrawAddressMock,
    };
});
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: chainState.address, status: WalletState.Connected, connect: vi.fn() }),
}));

import { WithdrawAddressModal } from "./withdraw-address-modal";

function renderModal() {
    const onSuccess = vi.fn();
    const ui = () => <WithdrawAddressModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />;
    const { rerender } = render(ui(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
    return { onSuccess, rerender: () => rerender(ui()) };
}

beforeEach(() => {
    txMock.mockReset();
    withdrawAddressMock.mockReset();
    toastErrorMock.mockReset();
    chainState.address = ME;
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

    it("still allows setting an address when the current one could not be loaded", async () => {
        withdrawAddressMock.mockResolvedValue(undefined);
        txMock.mockResolvedValue(true);
        const user = userEvent.setup();
        const { onSuccess } = renderModal();

        expect(await screen.findByText(/Could not load the current address/)).toBeInTheDocument();
        await user.type(screen.getByLabelText("New rewards address"), NEW);
        await user.click(screen.getByRole("button", { name: "Set address" }));

        expect(txMock.mock.calls[0][0][0].value).toMatchObject({ delegatorAddress: ME, withdrawAddress: NEW });
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("stays open and usable when the transaction does not go through", async () => {
        withdrawAddressMock.mockResolvedValue(ME);
        txMock.mockResolvedValue(false);
        const user = userEvent.setup();
        const { onSuccess } = renderModal();
        await screen.findByText("This wallet");

        await user.type(screen.getByLabelText("New rewards address"), NEW);
        await user.click(screen.getByRole("button", { name: "Set address" }));

        expect(txMock).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.getByRole("button", { name: "Set address" })).toBeEnabled());
        expect(screen.getByLabelText("New rewards address")).toHaveValue(NEW);
    });

    it("shows an error and recovers when the transaction throws", async () => {
        withdrawAddressMock.mockResolvedValue(ME);
        txMock.mockRejectedValue(new Error("simulation failed"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const user = userEvent.setup();
        const { onSuccess } = renderModal();
        await screen.findByText("This wallet");

        await user.type(screen.getByLabelText("New rewards address"), NEW);
        await user.click(screen.getByRole("button", { name: "Set address" }));

        expect(toastErrorMock).toHaveBeenCalledWith("Could not update the rewards address", expect.any(String));
        expect(onSuccess).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.getByRole("button", { name: "Set address" })).toBeEnabled());
        consoleError.mockRestore();
    });

    it("drops the previous account's address and draft when the wallet switches accounts", async () => {
        withdrawAddressMock.mockResolvedValueOnce(ME);
        const user = userEvent.setup();
        const { rerender } = renderModal();
        await screen.findByText("This wallet");
        await user.type(screen.getByLabelText("New rewards address"), NEW);
        expect(screen.getByRole("button", { name: "Set address" })).toBeEnabled();

        // The new account's lookup has not answered yet.
        let answer: (value: string) => void = () => {};
        withdrawAddressMock.mockReturnValueOnce(new Promise<string>(resolve => { answer = resolve; }));
        chainState.address = OTHER;
        rerender();

        expect(withdrawAddressMock).toHaveBeenLastCalledWith(OTHER);
        expect(screen.getByLabelText("New rewards address")).toHaveValue("");
        expect(screen.getByText("Loading…")).toBeInTheDocument();
        expect(screen.queryByText("This wallet")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Set address" })).toBeDisabled();

        answer(OTHER);
        expect(await screen.findByText("This wallet")).toBeInTheDocument();
    });
});
