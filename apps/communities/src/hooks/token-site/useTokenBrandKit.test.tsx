import {beforeEach, describe, expect, it, vi} from "vitest";
import {renderHook, waitFor} from "@testing-library/react";
import {DEFAULT_DENOM_BRANDING, type DenomBranding} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const getDenomBranding = vi.fn();
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    getDenomBranding: (denom: string) => getDenomBranding(denom),
}));

import {useTokenBrandKit} from "./useTokenBrandKit";

forbidNetwork();

const KIT: DenomBranding = {
    font: "roboto",
    light: {background: "#FFFFFF", text: "#000000", primary: "#123456", secondary: "#654321"},
    dark: {background: "#0A0A0A", text: "#FAFAFA", primary: "#ABCDEF", secondary: "#FEDCBA"},
};

beforeEach(() => {
    getDenomBranding.mockReset();
});

// Kits are cached per denom for a few minutes, so every test uses its own denom.
describe("useTokenBrandKit", () => {
    it("is undefined while the kit loads, then the token's own kit", async () => {
        getDenomBranding.mockResolvedValue(KIT);
        const {result} = renderHook(() => useTokenBrandKit("factory/bze1owner/ukit"));

        expect(result.current).toBeUndefined();
        await waitFor(() => expect(result.current).toEqual(KIT));
    });

    it("falls back to the default kit when the token has none", async () => {
        getDenomBranding.mockResolvedValue(null);
        const {result} = renderHook(() => useTokenBrandKit("factory/bze1owner/unokit"));

        await waitFor(() => expect(result.current).toBe(DEFAULT_DENOM_BRANDING));
    });

    it("falls back to the default kit when the query throws", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        getDenomBranding.mockRejectedValue(new Error("501 Not Implemented"));
        const {result} = renderHook(() => useTokenBrandKit("factory/bze1owner/uold"));

        await waitFor(() => expect(result.current).toBe(DEFAULT_DENOM_BRANDING));
    });
});
