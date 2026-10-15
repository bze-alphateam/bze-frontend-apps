import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import { useStakeLink, type UseStakeLinkOptions } from "./useStakeLink";

const ALICE = "bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu";
const UNKNOWN = "bzevaloper1fhkcj8e67jxm27e2hx4m9nq7p2jftfnuy4kvhr";

const VALIDATORS = [
    { operator_address: ALICE, description: { moniker: "Alice Node" } },
] as unknown as ValidatorSDKType[];

function setup(overrides: Partial<UseStakeLinkOptions> = {}) {
    const options: UseStakeLinkOptions = {
        stakeParam: ALICE,
        validators: VALIDATORS,
        isConnected: true,
        isConnecting: false,
        isConnectPromptOpen: false,
        openDelegate: vi.fn(),
        openConnectPrompt: vi.fn(),
        highlight: vi.fn(),
        clearParam: vi.fn(),
        notify: vi.fn(),
        ...overrides,
    };
    const hook = renderHook((props: UseStakeLinkOptions) => useStakeLink(props), { initialProps: options });
    return { options, rerender: (next: Partial<UseStakeLinkOptions>) => hook.rerender({ ...options, ...next }) };
}

describe("useStakeLink", () => {
    it("opens the delegate form for the linked validator when a wallet is connected", () => {
        const { options } = setup();

        expect(options.highlight).toHaveBeenCalledWith(ALICE);
        expect(options.openDelegate).toHaveBeenCalledWith(VALIDATORS[0]);
        expect(options.openConnectPrompt).not.toHaveBeenCalled();
        expect(options.clearParam).toHaveBeenCalledTimes(1);
    });

    it("asks to connect first, then opens the form once the wallet connects", () => {
        const { options, rerender } = setup({ isConnected: false });

        expect(options.openConnectPrompt).toHaveBeenCalledWith(VALIDATORS[0]);
        expect(options.openDelegate).not.toHaveBeenCalled();

        rerender({ isConnectPromptOpen: true });
        rerender({ isConnectPromptOpen: true, isConnected: true });

        expect(options.openDelegate).toHaveBeenCalledTimes(1);
        expect(options.openDelegate).toHaveBeenCalledWith(VALIDATORS[0]);
    });

    it("drops the pending stake when the connect prompt is closed without connecting", () => {
        const { options, rerender } = setup({ isConnected: false });

        rerender({ isConnectPromptOpen: true });
        rerender({ isConnectPromptOpen: false });
        rerender({ isConnectPromptOpen: false, isConnected: true });

        expect(options.openDelegate).not.toHaveBeenCalled();
        expect(options.highlight).toHaveBeenCalledWith(ALICE);
    });

    it("waits for the validators to load", () => {
        const { options, rerender } = setup({ validators: undefined });

        expect(options.openDelegate).not.toHaveBeenCalled();
        expect(options.clearParam).not.toHaveBeenCalled();

        rerender({ validators: VALIDATORS });

        expect(options.openDelegate).toHaveBeenCalledWith(VALIDATORS[0]);
    });

    it("waits while the wallet is still auto-connecting", () => {
        const { options, rerender } = setup({ isConnected: false, isConnecting: true });

        expect(options.openConnectPrompt).not.toHaveBeenCalled();

        rerender({ isConnecting: false, isConnected: true });

        expect(options.openDelegate).toHaveBeenCalledWith(VALIDATORS[0]);
        expect(options.openConnectPrompt).not.toHaveBeenCalled();
    });

    it("tells the user when the validator is not on this network", () => {
        const { options } = setup({ stakeParam: UNKNOWN });

        expect(options.notify).toHaveBeenCalledWith("Validator not found on this network");
        expect(options.openDelegate).not.toHaveBeenCalled();
        expect(options.highlight).not.toHaveBeenCalled();
        expect(options.clearParam).toHaveBeenCalled();
    });

    it("ignores an invalid value with a toast, without waiting for the data", () => {
        const { options } = setup({ stakeParam: "not-an-address", validators: undefined });

        expect(options.notify).toHaveBeenCalledWith("That stake link is not valid");
        expect(options.openDelegate).not.toHaveBeenCalled();
        expect(options.clearParam).toHaveBeenCalled();
    });

    it("does nothing without the parameter", () => {
        const { options } = setup({ stakeParam: null });

        expect(options.clearParam).not.toHaveBeenCalled();
        expect(options.notify).not.toHaveBeenCalled();
        expect(options.openDelegate).not.toHaveBeenCalled();
    });

    it("handles a link once, even while the parameter is still in the URL", () => {
        const { options, rerender } = setup();

        rerender({ validators: [...VALIDATORS] });

        expect(options.openDelegate).toHaveBeenCalledTimes(1);
        expect(options.clearParam).toHaveBeenCalledTimes(1);
    });
});
