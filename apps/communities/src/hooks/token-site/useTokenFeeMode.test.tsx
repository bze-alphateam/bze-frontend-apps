import {beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {forbidNetwork} from "@bze/vitest-preset/no-network";

const T = "factory/bze1owner/upage";
const OTHER = "factory/bze1owner/uother";

let feeTokens = {isLoading: false, eligible: new Set<string>([T])};
let preferred = "ubze";
const updatePreferredFeeDenom = vi.fn((denom?: string) => {
    preferred = denom ?? "ubze";
    return true;
});
vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useFeeTokens: () => ({
        isLoading: feeTokens.isLoading,
        nativeDenom: "ubze",
        isValidFeeDenom: (denom: string) => denom === "ubze" || feeTokens.eligible.has(denom),
    }),
    useSettings: () => ({feeDenom: preferred, updatePreferredFeeDenom}),
}));

import {useTokenFeeMode} from "./useTokenFeeMode";

forbidNetwork();

const renderMode = (denom = T) => renderHook(({denom: current}) => useTokenFeeMode(current), {initialProps: {denom}});

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    feeTokens = {isLoading: false, eligible: new Set([T])};
    preferred = "ubze";
});

describe("useTokenFeeMode", () => {
    it("pays network fees in an eligible token by default", () => {
        const {result} = renderMode();

        expect(result.current).toMatchObject({eligible: true, needsBze: false, optOut: false, feeDenom: T});
        expect(updatePreferredFeeDenom).toHaveBeenCalledWith(T);
    });

    it("pays in BZE for a token that can't pay fees, and says it needs BZE", () => {
        preferred = OTHER;
        const {result} = renderMode(OTHER);

        expect(result.current).toMatchObject({eligible: false, needsBze: true, feeDenom: "ubze"});
        expect(updatePreferredFeeDenom).toHaveBeenCalledWith(undefined);
    });

    it("decides nothing while the fee tokens load", () => {
        feeTokens = {isLoading: true, eligible: new Set()};
        const {result} = renderMode();

        expect(result.current).toMatchObject({isLoading: true, eligible: false, needsBze: false});
        expect(updatePreferredFeeDenom).not.toHaveBeenCalled();
    });

    it("pays in BZE once opted out, and remembers it for that token only", () => {
        const {result, rerender} = renderMode();

        act(() => result.current.setOptOut(true));
        expect(result.current).toMatchObject({optOut: true, feeDenom: "ubze"});
        expect(updatePreferredFeeDenom).toHaveBeenLastCalledWith(undefined);

        feeTokens = {isLoading: false, eligible: new Set([T, OTHER])};
        rerender({denom: OTHER});
        expect(result.current).toMatchObject({optOut: false, feeDenom: OTHER});

        rerender({denom: T});
        expect(result.current).toMatchObject({optOut: true, feeDenom: "ubze"});

        act(() => result.current.setOptOut(false));
        expect(result.current.feeDenom).toBe(T);
        expect(updatePreferredFeeDenom).toHaveBeenLastCalledWith(T);
    });

    it("re-applies when eligibility flips", () => {
        const {result, rerender} = renderMode();
        expect(preferred).toBe(T);

        feeTokens = {isLoading: false, eligible: new Set()};
        rerender({denom: T});
        expect(result.current).toMatchObject({eligible: false, needsBze: true, feeDenom: "ubze"});
        expect(updatePreferredFeeDenom).toHaveBeenLastCalledWith(undefined);

        feeTokens = {isLoading: false, eligible: new Set([T])};
        rerender({denom: T});
        expect(updatePreferredFeeDenom).toHaveBeenLastCalledWith(T);
    });

    it("resets the fee denom to BZE when the page goes away", () => {
        const {unmount} = renderMode();

        unmount();

        expect(updatePreferredFeeDenom).toHaveBeenLastCalledWith(undefined);
        expect(preferred).toBe("ubze");
    });
});
