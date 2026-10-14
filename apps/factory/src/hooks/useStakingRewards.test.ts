import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({ allStakingRewards: vi.fn() }));

vi.mock("@bze/bze-ui-kit", () => ({
    getRestClient: async () => ({ bze: { rewards: { allStakingRewards: m.allStakingRewards } } }),
}));

import { useStakingRewards } from "./useStakingRewards";

beforeEach(() => {
    m.allStakingRewards.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("useStakingRewards", () => {
    it("loads every program, newest first, up to 1000", async () => {
        m.allStakingRewards.mockResolvedValue({ list: [{ reward_id: "1" }] });
        const { result } = renderHook(() => useStakingRewards());

        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.rewards).toEqual([{ reward_id: "1" }]);
        expect(result.current.hasError).toBe(false);
        const [request] = m.allStakingRewards.mock.calls[0];
        expect(request.pagination).toMatchObject({ reverse: true, limit: 1000n });
    });

    it("reports a failed query as an error, not as an empty list, and retries", async () => {
        m.allStakingRewards.mockRejectedValueOnce(new Error("node down")).mockResolvedValue({ list: [{ reward_id: "2" }] });
        const { result } = renderHook(() => useStakingRewards());

        await waitFor(() => expect(result.current.hasError).toBe(true));
        expect(result.current.isLoading).toBe(false);

        act(() => result.current.refresh());
        expect(result.current.isLoading).toBe(true);
        expect(result.current.hasError).toBe(false);
        await waitFor(() => expect(result.current.rewards).toEqual([{ reward_id: "2" }]));
    });

    it("skips the query when the caller passes the list in", async () => {
        renderHook(() => useStakingRewards(false));
        await Promise.resolve();
        expect(m.allStakingRewards).not.toHaveBeenCalled();
    });
});
