import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import type { UnbondingDelegationSDKType, ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

const { txMock } = vi.hoisted(() => ({ txMock: vi.fn() }));

// Stub the wallet, tx and fee hooks; keep the rest of ui-kit (prettyAmount, StatusPill, …) real.
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => ({ nativeAsset: { denom: "ubze", ticker: "BZE", decimals: 6 } }),
        useSDKTx: () => ({ tx: txMock, progressTrack: "" }),
        useCanAffordTx: () => ({ canAfford: true, message: "" }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
        getChainNativeAssetDenom: () => "ubze",
    };
});
vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: "bze1me", status: WalletState.Connected, connect: vi.fn() }),
}));

import { UnbondingDelegations } from "./unbonding-delegations";

const DAY = 24 * 60 * 60 * 1000;

const ubd = (validator: string, height: string, completesInMs: number, balance: string) => ({
    delegator_address: "bze1me",
    validator_address: validator,
    entries: [{
        creation_height: height,
        completion_time: new Date(Date.now() + completesInMs).toISOString(),
        initial_balance: balance,
        balance,
    }],
}) as unknown as UnbondingDelegationSDKType;

const validator = (address: string, moniker: string, jailed = false) => ({
    operator_address: address,
    jailed,
    description: { moniker },
}) as unknown as ValidatorSDKType;

const VALIDATORS = [
    validator("valA", "Alpha"),
    validator("valB", "Beta"),
    validator("valJ", "Jailbird", true),
];

const UNBONDING = [
    ubd("valA", "100", 20 * DAY, "1000000"),
    ubd("valB", "200", 21 * DAY, "2000000"),
    ubd("valJ", "300", 15 * DAY, "4000000"),
];

function renderSection(onActionComplete = vi.fn()) {
    render(
        <UnbondingDelegations
            unbondingDelegations={UNBONDING}
            allValidators={VALIDATORS}
            logos={{}}
            onActionComplete={onActionComplete}
        />,
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
            ),
        },
    );
    return { onActionComplete };
}

beforeEach(() => {
    txMock.mockReset();
});

describe("Cancel unbonding", () => {
    it("disables the jailed validator's entry with the reason and leaves it out of Cancel all", () => {
        renderSection();

        expect(screen.getByRole("button", { name: "Cancel unbonding from Jailbird" })).toBeDisabled();
        expect(screen.getByText(/Validator is jailed/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancel unbonding from Alpha" })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Cancel all \(2\)/ })).toBeInTheDocument();
        expect(screen.getByText("1 can't be cancelled")).toBeInTheDocument();
    });

    it("confirms and sends one MsgCancelUnbondingDelegation per cancellable entry in one tx", async () => {
        txMock.mockResolvedValue(true);
        const user = userEvent.setup();
        const { onActionComplete } = renderSection();

        await user.click(screen.getByRole("button", { name: /Cancel all \(2\)/ }));

        const list = await screen.findByRole("list", { name: "Unbonding entries to cancel" });
        expect(within(list).getByText("Alpha")).toBeInTheDocument();
        expect(within(list).getByText("Beta")).toBeInTheDocument();
        expect(within(list).queryByText("Jailbird")).not.toBeInTheDocument();
        expect(screen.getByText(/1 entry skipped/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Cancel 2 unbondings" }));

        expect(txMock).toHaveBeenCalledTimes(1);
        const [messages, options] = txMock.mock.calls[0];
        expect(options).toEqual({ abortOnSimulationError: true });
        expect(messages).toHaveLength(2);
        expect(messages.map((m: { typeUrl: string }) => m.typeUrl)).toEqual([
            "/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation",
            "/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation",
        ]);
        expect(messages[0].value).toMatchObject({
            delegatorAddress: "bze1me",
            validatorAddress: "valA",
            amount: { denom: "ubze", amount: "1000000" },
            creationHeight: BigInt(100),
        });
        expect(messages[1].value).toMatchObject({
            validatorAddress: "valB",
            amount: { denom: "ubze", amount: "2000000" },
            creationHeight: BigInt(200),
        });
        await waitFor(() => expect(onActionComplete).toHaveBeenCalledTimes(1));
    });

    it("cancels a single entry from its card", async () => {
        txMock.mockResolvedValue(true);
        const user = userEvent.setup();
        renderSection();

        await user.click(screen.getByRole("button", { name: "Cancel unbonding from Beta" }));
        const dialog = await screen.findByRole("dialog");
        await user.click(within(dialog).getByRole("button", { name: "Cancel unbonding" }));

        const [messages] = txMock.mock.calls[0];
        expect(messages).toHaveLength(1);
        expect(messages[0].value).toMatchObject({ validatorAddress: "valB", creationHeight: BigInt(200) });
    });

    it("does not send when the dialog is dismissed", async () => {
        const user = userEvent.setup();
        renderSection();

        await user.click(screen.getByRole("button", { name: "Cancel unbonding from Alpha" }));
        await user.click(await screen.findByRole("button", { name: "Keep unbonding" }));

        expect(txMock).not.toHaveBeenCalled();
    });
});
