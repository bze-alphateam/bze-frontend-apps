import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";
import { createAmmRouter } from "./amm_router";

function pool(id: string, base: string, quote: string, reserveBase: string, reserveQuote: string, fee = "0.003"): LiquidityPoolSDKType {
    return {
        id,
        base,
        quote,
        lp_denom: `ulp${id}`,
        creator: "bze1creator",
        fee,
        reserve_base: reserveBase,
        reserve_quote: reserveQuote,
        stable: false,
    };
}

// 5,000,000 BZE against 1,000 USDC, 0.3 % fee; then 1,000 USDC against 100 ATOM.
const bzeUsdc = pool("1", "ubze", "uusdc", "5000000000000", "1000000000");
const usdcAtom = pool("2", "uusdc", "uatom", "1000000000", "100000000");

// The chain's `swapTokens` for one hop, by hand:
//   fee    = floor(amountIn * poolFee)              (calculateSwapInputAndFee, TruncateInt)
//   output = floor(real * reserveOut / (reserveIn + real)) with real = amountIn - fee (TruncateInt)
//
// 1,000 BZE into BZE/USDC: fee = floor(1e9 * 0.003) = 3,000,000; real = 997,000,000;
//   output = floor(997e6 * 1e9 / (5e12 + 997e6)) = floor(199360.2475…) = 199,360 uusdc.
// 199,360 USDC-micro into USDC/ATOM: fee = floor(199360 * 0.003) = floor(598.08) = 598;
//   real = 198,762; output = floor(198762 * 1e8 / (1e9 + 198762)) = floor(19872.2668…) = 19,872 uatom.
describe("AmmRouter chain-exact outputs", () => {
    it("truncates the fee and the output of a single hop to whole micro units", () => {
        const router = createAmmRouter([bzeUsdc]);

        const route = router.findOptimalRoute("ubze", "uusdc", new BigNumber("1000000000"), 3);

        expect(route).not.toBeNull();
        expect(route!.expectedOutput.toFixed()).toBe("199360");
        expect(route!.feesPerHop.map((fee) => fee.toFixed())).toEqual(["3000000"]);
    });

    it("feeds each hop the previous hop's truncated output", () => {
        const router = createAmmRouter([bzeUsdc, usdcAtom]);

        const route = router.findOptimalRoute("ubze", "uatom", new BigNumber("1000000000"), 3);

        expect(route).not.toBeNull();
        expect(route!.route).toEqual(["1", "2"]);
        expect(route!.expectedOutput.toFixed()).toBe("19872");
        expect(route!.feesPerHop.map((fee) => fee.toFixed())).toEqual(["3000000", "598"]);
    });

    it("prices a cached route with the same truncation", () => {
        const router = createAmmRouter([bzeUsdc, usdcAtom]);
        router.findOptimalRoute("ubze", "uatom", new BigNumber("1000000000"), 3);

        const again = router.findOptimalRoute("ubze", "uatom", new BigNumber("1000000000"), 3);
        const output = router.calculateRouteOutput([bzeUsdc, usdcAtom], ["ubze", "uusdc", "uatom"], new BigNumber("1000000000"));

        expect(again!.expectedOutput.toFixed()).toBe("19872");
        expect(output.expectedOutput.toFixed()).toBe("19872");
        expect(output.feesPerHop.map((fee) => fee.toFixed())).toEqual(["3000000", "598"]);
    });

    it("has no route when the chain would pay nothing out", () => {
        const router = createAmmRouter([bzeUsdc]);

        // 1,000 ubze: fee 3, real 997, output floor(0.1994) = 0 -> "non positive output" on chain.
        expect(router.findOptimalRoute("ubze", "uusdc", new BigNumber(1000), 3)).toBeNull();
        // 333 ubze: fee floor(0.999) = 0 on a fee-bearing pool -> "amount is too low to be traded".
        expect(router.findOptimalRoute("ubze", "uusdc", new BigNumber(333), 3)).toBeNull();
    });

    it("drops a cached route for an input the chain would refuse", () => {
        const router = createAmmRouter([bzeUsdc]);
        expect(router.findOptimalRoute("ubze", "uusdc", new BigNumber("1000000000"), 3)).not.toBeNull();

        expect(router.findOptimalRoute("ubze", "uusdc", new BigNumber(1000), 3)).toBeNull();
    });

    it("charges no fee on a fee-less pool and still truncates the output", () => {
        const router = createAmmRouter([pool("3", "ubze", "uusdc", "5000000000000", "1000000000", "0")]);

        const route = router.findOptimalRoute("ubze", "uusdc", new BigNumber("1000000000"), 3);

        // floor(1e9 * 1e9 / (5e12 + 1e9)) = floor(199960.0079…)
        expect(route!.expectedOutput.toFixed()).toBe("199960");
        expect(route!.feesPerHop.map((fee) => fee.toFixed())).toEqual(["0"]);
    });
});
