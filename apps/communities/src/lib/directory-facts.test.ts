import {describe, it, expect} from "vitest";
import BigNumber from "bignumber.js";
import type {Asset, DenomReward, LiquidityPoolData, MarketData} from "@bze/bze-ui-kit";

import {buildDirectoryFacts, isActiveStakingReward, tokenMarket} from "./directory-facts";

const QUOTES = {usdc: "factory/bze1issuer/usdc", native: "ubze"};
const AAA = "factory/bze1owner/uaaa";
const BBB = "factory/bze1owner/ubbb";

const asset = (denom: string, supply: bigint, decimals = 6): Asset => ({
    type: "factory", denom, decimals, name: denom, ticker: denom, logo: "", stable: false, verified: false, supply,
});

const market = (base: string, quote: string, change: number) =>
    ({base, quote, market_id: `${base}/${quote}`, change} as MarketData);

const poolData = (base: string, quote: string, usdVolume: number) =>
    ({poolId: `${base}_${quote}`, base, quote, usdVolume: new BigNumber(usdVolume)} as LiquidityPoolData);

describe("tokenMarket", () => {
    const prices = new Map([[AAA, new BigNumber("0.5")]]);

    it("reads the USD price and prefers the USDC market's 24h change over the BZE one", () => {
        const markets = new Map([
            [`${AAA}/${QUOTES.native}`, market(AAA, QUOTES.native, 3)],
            [`${AAA}/${QUOTES.usdc}`, market(AAA, QUOTES.usdc, -2)],
        ]);
        const result = tokenMarket(AAA, prices, markets, QUOTES);

        expect(result.price.toString()).toBe("0.5");
        expect(result.change).toBe(-2);
    });

    it("falls back to the BZE market's change", () => {
        const markets = new Map([[`${AAA}/${QUOTES.native}`, market(AAA, QUOTES.native, 3)]]);
        expect(tokenMarket(AAA, prices, markets, QUOTES).change).toBe(3);
    });

    it("has a 0 price and no change without data, and prices USDC at 1", () => {
        const result = tokenMarket(BBB, prices, new Map(), QUOTES);
        expect(result.price.isZero()).toBe(true);
        expect(result.change).toBeUndefined();
        expect(tokenMarket(QUOTES.usdc, new Map(), new Map(), QUOTES).price.toString()).toBe("1");
    });
});

describe("isActiveStakingReward", () => {
    it("is active while payouts are below the duration", () => {
        expect(isActiveStakingReward({staking_denom: AAA, payouts: 3, duration: 15})).toBe(true);
        expect(isActiveStakingReward({staking_denom: AAA, payouts: 15, duration: 15})).toBe(false);
    });
});

describe("buildDirectoryFacts", () => {
    const facts = buildDirectoryFacts({
        tokens: [asset(AAA, 4_000_000n), asset(BBB, 1_000_000n)],
        denomRewards: [{staking_denom: AAA} as DenomReward],
        stakingRewards: [
            {staking_denom: BBB, payouts: 1, duration: 10},
            {staking_denom: AAA, payouts: 10, duration: 10},
        ],
        pools: [{base: AAA, quote: QUOTES.native}],
        poolsData: [poolData(AAA, QUOTES.native, 100), poolData(AAA, BBB, 25)],
        prices: new Map([[AAA, new BigNumber("0.5")]]),
        quotes: QUOTES,
    });

    it("marks holders pools and only active reward programs", () => {
        expect([...facts.holdersPool]).toEqual([AAA]);
        expect([...facts.rewardPrograms]).toEqual([BBB]);
    });

    it("marks every denom found in a pool as tradable", () => {
        expect(facts.tradable.has(AAA)).toBe(true);
        expect(facts.tradable.has(BBB)).toBe(false);
    });

    it("sums the 24h volume of every pool holding the denom", () => {
        expect(facts.volume.get(AAA)).toBe(125);
        expect(facts.volume.get(BBB)).toBe(25);
    });

    it("computes market cap from display supply and price, leaving unpriced tokens out", () => {
        expect(facts.marketCap.get(AAA)).toBe(2);
        expect(facts.marketCap.has(BBB)).toBe(false);
    });
});
