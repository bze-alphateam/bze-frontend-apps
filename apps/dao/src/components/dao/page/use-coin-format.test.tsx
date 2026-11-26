import {describe, expect, it, vi} from "vitest";
import {renderHook} from "@testing-library/react";
import BigNumber from "bignumber.js";
import {useCoinFormat} from "./use-coin-format";

vi.mock("@bze/bze-ui-kit", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@bze/bze-ui-kit")>()),
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom),
    }),
    useAssetsValue: () => ({denomUsdValue: () => new BigNumber(0)}),
}));

describe("useCoinFormat exact", () => {
    const exact = () => renderHook(() => useCoinFormat()).result.current.exact;

    it("keeps every digit of a known token where format rounds", () => {
        const {result} = renderHook(() => useCoinFormat());
        const coin = {denom: "ubze", amount: "1123456"};
        expect(result.current.exact(coin)).toBe("1.123456 BZE");
        expect(result.current.format(coin)).toBe("1.123 BZE");
    });

    it("groups big amounts and stays exact past float precision", () => {
        expect(exact()({denom: "ubze", amount: "9007199254740993"})).toBe("9,007,199,254.740993 BZE");
    });

    it("shows an unknown token's raw amount and denom, never a guess", () => {
        expect(exact()({denom: "factory/bze1x/ulmn", amount: "42"})).toBe("42 factory/bze1x/ulmn");
    });
});
