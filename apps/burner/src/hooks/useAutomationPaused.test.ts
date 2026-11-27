import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import {blockchainEventManager} from "@bze/bze-ui-kit";

const guardian = vi.hoisted(() => ({paused: false}));
const getAutomationPaused = vi.hoisted(() => vi.fn());
const invalidateAutomationPaused = vi.hoisted(() => vi.fn());

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getAutomationPaused,
    invalidateAutomationPaused,
}));

import {AUTOMATION_PAUSE_CHANGED_EVENT} from "@/lib/automation-pause";
import {useAutomationPaused} from "./useAutomationPaused";

describe("useAutomationPaused", () => {
    beforeEach(() => {
        guardian.paused = false;
        getAutomationPaused.mockReset().mockImplementation(async () => guardian.paused);
        invalidateAutomationPaused.mockReset();
    });

    afterEach(() => vi.useRealTimers());

    it("reads the pause flag on mount", async () => {
        guardian.paused = true;
        const {result} = renderHook(() => useAutomationPaused());

        await waitFor(() => expect(result.current).toBe(true));
    });

    it("is false while nothing is paused", async () => {
        const {result} = renderHook(() => useAutomationPaused());

        await waitFor(() => expect(getAutomationPaused).toHaveBeenCalled());
        expect(result.current).toBe(false);
    });

    it("re-reads, bypassing the cache, when the pause event fires, and again when it resumes", async () => {
        const {result} = renderHook(() => useAutomationPaused());
        await waitFor(() => expect(getAutomationPaused).toHaveBeenCalledTimes(1));

        guardian.paused = true;
        act(() => blockchainEventManager.emit(AUTOMATION_PAUSE_CHANGED_EVENT));
        await waitFor(() => expect(result.current).toBe(true));
        expect(invalidateAutomationPaused).toHaveBeenCalledTimes(1);

        guardian.paused = false;
        act(() => blockchainEventManager.emit(AUTOMATION_PAUSE_CHANGED_EVENT));
        await waitFor(() => expect(result.current).toBe(false));
    });

    it("polls every 60 seconds as a fallback", async () => {
        vi.useFakeTimers();
        renderHook(() => useAutomationPaused());
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        const initial = getAutomationPaused.mock.calls.length;

        await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

        expect(getAutomationPaused.mock.calls.length).toBe(initial + 1);
    });

    it("stops listening after unmount", async () => {
        const {unmount} = renderHook(() => useAutomationPaused());
        await waitFor(() => expect(getAutomationPaused).toHaveBeenCalledTimes(1));
        unmount();

        blockchainEventManager.emit(AUTOMATION_PAUSE_CHANGED_EVENT);

        expect(invalidateAutomationPaused).not.toHaveBeenCalled();
    });
});
