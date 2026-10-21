import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

// The wallet side is mocked: a balance that can't cover the gas, and the inner useBZETx.
const { bzeTxMock, toastError, canAfford } = vi.hoisted(() => ({
    bzeTxMock: vi.fn(async () => true),
    toastError: vi.fn(),
    canAfford: { value: false },
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useBZETx: () => ({ tx: bzeTxMock, progressTrack: "" }),
    useGasFeeEstimator: () => ({ estimate: () => ({ denom: "ubze", amount: "5000" }) }),
    useBalances: () => ({ getBalanceByDenom: () => ({ amount: "1" }) }),
    useAssets: () => ({ denomTicker: () => "BZE", denomDecimals: () => 6 }),
    useToast: () => ({ toast: { error: toastError } }),
    canAffordTx: () => ({ canAfford: canAfford.value }),
}));

import { txKindsOf, useFactoryTx } from "./useFactoryTx";

describe("txKindsOf", () => {
    it("maps a multi-send to its kind with the output count", () => {
        const msg = { typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend", value: { inputs: [{}], outputs: [{}, {}, {}] } };
        expect(txKindsOf([msg])).toEqual([{ kind: "multi-send", count: 3 }]);
    });

    it("keeps plain kinds and skips unknown messages", () => {
        expect(txKindsOf([
            { typeUrl: "/bze.tokenfactory.MsgMint" },
            { typeUrl: "/unknown.Msg" },
        ])).toEqual(["mint"]);
    });

    it("covers the burning raffle start (BFE-208)", () => {
        expect(txKindsOf([{ typeUrl: "/bze.burner.MsgStartRaffle" }])).toEqual(["start-raffle"]);
    });
});

describe("useFactoryTx gas pre-flight", () => {
    const MINT = [{ typeUrl: "/bze.tokenfactory.MsgMint", value: {} }];

    beforeEach(() => {
        bzeTxMock.mockClear();
        toastError.mockClear();
        canAfford.value = false;
    });

    it("toasts the refusal by default and never opens the wallet", async () => {
        const { result } = renderHook(() => useFactoryTx());
        let ok = true;
        await act(async () => { ok = await result.current.tx(MINT as never); });

        expect(ok).toBe(false);
        expect(toastError).toHaveBeenCalledWith("Not enough for the network fee", expect.stringContaining("BZE for gas"));
        expect(bzeTxMock).not.toHaveBeenCalled();
    });

    it("with toasts: false, reports the refusal to onFailure instead", async () => {
        const onFailure = vi.fn();
        const { result } = renderHook(() => useFactoryTx());
        await act(async () => { await result.current.tx(MINT as never, { toasts: false, onFailure }); });

        expect(onFailure).toHaveBeenCalledWith("Not enough BZE for the network fee", { stage: "prepare" });
        expect(toastError).not.toHaveBeenCalled();
        expect(bzeTxMock).not.toHaveBeenCalled();
    });

    it("passes an affordable tx and its options through", async () => {
        canAfford.value = true;
        const options = { toasts: false };
        const { result } = renderHook(() => useFactoryTx());
        await act(async () => { await result.current.tx(MINT as never, options); });

        expect(bzeTxMock).toHaveBeenCalledWith(MINT, options);
    });
});
