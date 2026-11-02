import {beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import {blockchainEventManager, LOCK_CHANGED_EVENT} from "@bze/bze-ui-kit";

const locked = vi.hoisted(() => ({balances: [] as {denom: string, amount: string}[], calls: 0}));

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getLockedBalances: async () => {
        locked.calls++;
        return locked.balances;
    },
    useAssetPrice: () => ({price: undefined}),
}));

import {useLockedLiquidity} from "./useLockedLiquidity";

// LP shares have 12 decimals, so 2e12 base units read as 2.
const LP = "ulp_ubze_uusdc";

describe("useLockedLiquidity", () => {
    beforeEach(() => {
        locked.balances = [{denom: LP, amount: "2000000000000"}];
        locked.calls = 0;
    });

    it("loads the pool's locked amount", async () => {
        const {result} = renderHook(() => useLockedLiquidity(LP));

        await waitFor(() => expect(result.current.lockedForeverAmount).toBe("2"));
    });

    it("refreshes the amount when coins are locked in a new block", async () => {
        const {result} = renderHook(() => useLockedLiquidity(LP));
        await waitFor(() => expect(result.current.lockedForeverAmount).toBe("2"));

        locked.balances = [{denom: LP, amount: "5000000000000"}];
        act(() => blockchainEventManager.emit(LOCK_CHANGED_EVENT));

        await waitFor(() => expect(result.current.lockedForeverAmount).toBe("5"), {timeout: 2000});
        expect(result.current.isLoading).toBe(false);
    });

    it("stops listening once unmounted", async () => {
        const {result, unmount} = renderHook(() => useLockedLiquidity(LP));
        await waitFor(() => expect(result.current.lockedForeverAmount).toBe("2"));
        const callsBefore = locked.calls;

        unmount();
        blockchainEventManager.emit(LOCK_CHANGED_EVENT);
        await new Promise(resolve => setTimeout(resolve, 700));

        expect(locked.calls).toBe(callsBefore);
    });
});
