import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {Asset, MarketData} from "@bze/bze-ui-kit";
import type {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";

import {poolData, poolTickers} from "./pool-data";

const TOKEN = "factory/bze1owner/upage";

const asset = (denom: string, decimals = 6): Asset => ({
    type: "factory", denom, decimals, name: denom, ticker: denom, logo: "", stable: false, verified: false, supply: 0n,
});

// 1,000 PAGE + 500 BZE in reserve, a 0.3% fee of which 50% goes to the providers.
const POOL: LiquidityPoolSDKType = {
    id: `${TOKEN}_ubze`,
    base: TOKEN,
    quote: "ubze",
    lp_denom: "ulp_page_ubze",
    creator: "bze1owner",
    fee: "0.003",
    fee_dest: {treasury: "0", burner: "0.5", providers: "0.5", liquidity: "0"},
    reserve_base: "1000000000",
    reserve_quote: "500000000",
    stable: false,
};

const ticker = (extra: Partial<MarketData> = {}): MarketData => ({
    base: TOKEN, quote: "ubze", market_id: POOL.id, last_price: 0.5, base_volume: 200, quote_volume: 100,
    bid: 0, ask: 0, high: 0, low: 0, open_price: 0, change: 0, ...extra,
});

const prices = (entries: [string, number][]) => new Map(entries.map(([denom, price]) => [denom, new BigNumber(price)]));

describe("poolTickers", () => {
    it("keeps pool tickers by pool id and drops order-book markets", () => {
        const orderBook = ticker({market_id: `${TOKEN}/ubze`});
        const byPool = poolTickers([orderBook, ticker()]);

        expect([...byPool.keys()]).toEqual([POOL.id]);
    });
});

describe("poolData", () => {
    it("reads the 24h volume, fees and APR from the pool's ticker", () => {
        // PAGE $0.10, BZE $0.20 → TVL $100 + $100 = $200; 200 PAGE traded = $20 volume;
        // fees 0.3% = $0.06 a day, providers get $0.03 → 0.03 / 200 × 365 × 100 = 5.475%.
        const data = poolData(POOL, prices([[TOKEN, 0.1], ["ubze", 0.2]]), asset(TOKEN), asset("ubze"), ticker());

        expect(data.usdValue.toString()).toBe("200");
        expect(data.usdVolume.toString()).toBe("20");
        expect(data.baseVolume.toString()).toBe("200");
        expect(data.quoteVolume.toString()).toBe("100");
        expect(data.usdFees.toString()).toBe("0.06");
        expect(data.apr).toBe("5.48");
        expect(data.isComplete).toBe(true);
    });

    it("falls back to the quote side when the base has no USD price", () => {
        const data = poolData(POOL, prices([["ubze", 0.2]]), asset(TOKEN), asset("ubze"), ticker());

        // 100 BZE traded × $0.20.
        expect(data.usdVolume.toString()).toBe("20");
        expect(data.usdFees.toString()).toBe("0.06");
        expect(data.isComplete).toBe(false);
    });

    it("reports zero volume, fees and APR for a pool without a ticker", () => {
        const data = poolData(POOL, prices([[TOKEN, 0.1], ["ubze", 0.2]]), asset(TOKEN), asset("ubze"));

        expect(data.usdValue.toString()).toBe("200");
        expect(data.usdVolume.toString()).toBe("0");
        expect(data.usdFees.toString()).toBe("0");
        expect(data.apr).toBe("0.00");
    });
});
