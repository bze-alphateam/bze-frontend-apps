import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRegistryListing } from "./useRegistryListing";

// The raw assetlist.json fetch is mocked; the 15-minute cache goes through the real ui-kit
// storage helpers (jsdom localStorage).
const LISTED = "factory/bze1x/listed";
const ASSETLIST = {
    chain_name: "beezee",
    assets: [
        { base: "ubze", logo_URIs: { png: "https://img/bze.png", svg: "https://img/bze.svg" } },
        { base: LISTED, logo_URIs: { png: "https://img/listed.png" } },
    ],
};

const fetchMock = vi.fn();
const answer = (body: unknown, ok = true) => fetchMock.mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });

beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    answer(ASSETLIST);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

const run = (denom: string) => renderHook(() => useRegistryListing(denom)).result;

describe("useRegistryListing", () => {
    it("listed: an entry with the denom as base, with its logo", async () => {
        const result = run(LISTED);
        expect(result.current.status).toBe("loading");
        await waitFor(() => expect(result.current.status).toBe("listed"));
        expect(result.current.logo).toBe("https://img/listed.png");
        expect(fetchMock).toHaveBeenCalledWith("https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/assetlist.json");
    });

    it("not listed", async () => {
        const result = run("factory/bze1x/new");
        await waitFor(() => expect(result.current.status).toBe("not-listed"));
    });

    it("a failed fetch is an error, and Retry fetches again", async () => {
        answer({}, false);
        const result = run(LISTED);
        await waitFor(() => expect(result.current.status).toBe("error"));

        answer(ASSETLIST);
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.status).toBe("listed"));
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reads the cache for 15 minutes instead of fetching again", async () => {
        const first = run(LISTED);
        await waitFor(() => expect(first.current.status).toBe("listed"));
        const second = run("factory/bze1x/new");
        await waitFor(() => expect(second.current.status).toBe("not-listed"));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("is off on testnet and never fetches", () => {
        vi.stubEnv("NEXT_PUBLIC_CHAIN_IS_TESTNET", "true");
        const result = run(LISTED);
        expect(result.current.status).toBe("off");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
