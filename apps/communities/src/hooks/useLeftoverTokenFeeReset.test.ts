import {beforeEach, describe, expect, it, vi} from "vitest";
import {renderHook} from "@testing-library/react";
import {getFromLocalStorage} from "@bze/bze-ui-kit";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const PICKED = "factory/bze1owner/upicked";
const MARKER = "communities:feeDenomSetByTokenPage";

let settings = {isLoaded: true, feeDenom: T};
const updatePreferredFeeDenom = vi.fn(() => true);
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useSettings: () => ({...settings, updatePreferredFeeDenom}),
}));

import {clearTokenPageFeeDenom, markTokenPageFeeDenom, useLeftoverTokenFeeReset} from "./useLeftoverTokenFeeReset";

forbidNetwork();

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    settings = {isLoaded: true, feeDenom: T};
});

describe("useLeftoverTokenFeeReset", () => {
    it("resets a fee denom the token page left behind to BZE and drops the marker", () => {
        markTokenPageFeeDenom(T);

        renderHook(() => useLeftoverTokenFeeReset());

        expect(updatePreferredFeeDenom).toHaveBeenCalledExactlyOnceWith(undefined);
        expect(getFromLocalStorage(MARKER)).toBeNull();
    });

    it("keeps a fee denom the viewer picked since, and only drops the stale marker", () => {
        markTokenPageFeeDenom(T);
        settings = {isLoaded: true, feeDenom: PICKED};

        renderHook(() => useLeftoverTokenFeeReset());

        expect(updatePreferredFeeDenom).not.toHaveBeenCalled();
        expect(getFromLocalStorage(MARKER)).toBeNull();
    });

    it("never touches a preference without the marker", () => {
        markTokenPageFeeDenom(T);
        clearTokenPageFeeDenom();

        renderHook(() => useLeftoverTokenFeeReset());

        expect(updatePreferredFeeDenom).not.toHaveBeenCalled();
    });

    it("waits for the stored settings before comparing", () => {
        markTokenPageFeeDenom(T);
        settings = {isLoaded: false, feeDenom: "ubze"};
        const {rerender} = renderHook(() => useLeftoverTokenFeeReset());

        expect(updatePreferredFeeDenom).not.toHaveBeenCalled();
        expect(getFromLocalStorage(MARKER)).toBe(T);

        settings = {isLoaded: true, feeDenom: T};
        rerender();
        expect(updatePreferredFeeDenom).toHaveBeenCalledExactlyOnceWith(undefined);
    });
});
