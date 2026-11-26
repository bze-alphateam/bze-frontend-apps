import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DaoModuleNotSupportedError, type DaoParams } from "@bze/bze-ui-kit";
import { useDaoParams } from "./useDaoParams";

const PARAMS = { max_sr_per_dao: "5", min_electorate_lock_days: 5 } as unknown as DaoParams;

describe("useDaoParams", () => {
    it("is loading, then ready with the params", async () => {
        const { result } = renderHook(() => useDaoParams(() => Promise.resolve(PARAMS)));
        expect(result.current.status).toBe("loading");
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(result.current).toMatchObject({ status: "ready", params: PARAMS });
    });

    it("reads a 501 (v8.2.x node) as unsupported", async () => {
        const { result } = renderHook(() => useDaoParams(() => Promise.reject(new DaoModuleNotSupportedError("Not Implemented"))));
        await waitFor(() => expect(result.current.status).toBe("unsupported"));
    });

    it("reads any other failure as an error, and retry asks again", async () => {
        const get = vi.fn().mockRejectedValueOnce(new Error("node down")).mockResolvedValueOnce(PARAMS);
        const { result } = renderHook(() => useDaoParams(get));
        await waitFor(() => expect(result.current.status).toBe("error"));
        act(() => result.current.retry());
        expect(result.current.status).toBe("loading");
        await waitFor(() => expect(result.current.status).toBe("ready"));
        expect(get).toHaveBeenCalledTimes(2);
    });
});
