import {describe, expect, it} from "vitest";
import type {TendermintEvent} from "@bze/bze-ui-kit";
import {describeOrderResult, summarizeOrderTx, type OrderResultMarket} from "./order-result";

const ME = "bze1me";
// typed-event attribute values are JSON-quoted strings
const ev = (type: string, attrs: Record<string, string>): TendermintEvent => ({
    type: `bze.tradebin.${type}`,
    attributes: Object.entries(attrs).map(([key, value]) => ({key, value: JSON.stringify(value), index: true})),
});
const executed = (amount: string, price: string, taker = ME, orderType = "sell") =>
    ev("OrderExecutedEvent", {id: "1", market_id: "m", order_type: orderType, amount, price, maker: "bze1maker", taker, order_id: "9"});
const saved = (amount: string, price: string, owner = ME) =>
    ev("OrderSavedEvent", {id: "9", market_id: "m", order_type: "buy", amount, price, owner, order_id: "9"});
const amended = (price: string, added: string, total: string) =>
    ev("OrderAmendedEvent", {id: "12", market_id: "m", order_type: "buy", price, owner: ME, added_amount: added, amount: total, previous_id: "5"});
const refunded = (reason: string, amount: string, refund: string) =>
    ev("OrderMessageRefundedEvent", {order_id: "9", market_id: "m", order_type: "buy", owner: ME, amount, refund, reason});

// base 6 decimals, quote 6 decimals: micro prices equal display prices
const market: OrderResultMarket = {
    baseTicker: "BZE", quoteTicker: "USDC", baseDecimals: 6, quoteDecimals: 6, maxFills: async () => 250,
};
const text = (events: TendermintEvent[]) => describeOrderResult(summarizeOrderTx(events, ME), market);

describe("summarizeOrderTx", () => {
    it("averages the price across 3 makers weighted by amount", () => {
        const s = summarizeOrderTx([executed("1000000", "1"), executed("2000000", "2"), executed("1000000", "4")], ME);

        expect(s.filledAmount.toFixed()).toBe("4000000");
        expect(s.avgPrice.toFixed()).toBe("2.25"); // (1 + 4 + 4) / 4
        expect(s.side).toBe("buy");
        expect(s.placed).toEqual([]);
    });

    it("reports the side as the opposite of the maker's", () => {
        expect(summarizeOrderTx([executed("1", "1", ME, "buy")], ME).side).toBe("sell");
    });

    it("keeps a partial fill and its saved remainder apart", () => {
        const s = summarizeOrderTx([executed("1000000", "2"), saved("250000", "3")], ME);

        expect(s.filledAmount.toFixed()).toBe("1000000");
        expect(s.placed.map(p => [p.amount.toFixed(), p.price.toFixed()])).toEqual([["250000", "3"]]);
    });

    it("reports an unfilled order that was saved", () => {
        const s = summarizeOrderTx([saved("250000", "3")], ME);

        expect(s.filledAmount.toFixed()).toBe("0");
        expect(s.avgPrice.toFixed()).toBe("0");
        expect(s.hasOrderEvents).toBe(true);
    });

    it("reports a merge into an existing order", () => {
        const s = summarizeOrderTx([amended("3", "250000", "600000")], ME);

        expect(s.merged.map(m => [m.price.toFixed(), m.addedAmount.toFixed(), m.amount.toFixed()])).toEqual([["3", "250000", "600000"]]);
    });

    it("sums returned amounts by reason and skips a dust-only refund", () => {
        const s = summarizeOrderTx([
            refunded("max_fills_reached", "100", "100ubze"),
            refunded("max_fills_reached", "50", "50ubze"),
            refunded("below_min_amount", "3", ""),
        ], ME);

        expect(s.returned.map(r => [r.reason, r.amount.toFixed()])).toEqual([["max_fills_reached", "150"]]);
    });

    it("aggregates two create-order messages and a fill with 2 entries in one tx", () => {
        const s = summarizeOrderTx([
            executed("1000000", "1"), executed("1000000", "3"), // first message / entries
            executed("2000000", "2"),
            saved("100000", "4"), saved("200000", "5"),
        ], ME);

        expect(s.filledAmount.toFixed()).toBe("4000000");
        expect(s.avgPrice.toFixed()).toBe("2");
        expect(s.placed).toHaveLength(2);
    });

    it("ignores other users' events", () => {
        const s = summarizeOrderTx([executed("1000000", "1", "bze1other"), saved("5", "1", "bze1other")], ME);

        expect(s.filledAmount.toFixed()).toBe("0");
        expect(s.placed).toEqual([]);
    });

    it("has no order events for a v8.2.0-shaped tx", () => {
        const s = summarizeOrderTx([{type: "transfer", attributes: []}, {type: "message", attributes: []}], ME);

        expect(s.hasOrderEvents).toBe(false);
        expect(summarizeOrderTx(undefined, ME).hasOrderEvents).toBe(false);
    });
});

describe("summarizeOrderTx without a signer", () => {
    it("counts nothing, even for events that carry no taker or owner", () => {
        const noTaker = ev("OrderExecutedEvent", {order_type: "sell", amount: "1000000", price: "1"});
        const noOwner = ev("OrderSavedEvent", {amount: "5", price: "1"});

        const s = summarizeOrderTx([noTaker, noOwner], "");

        expect(s.hasOrderEvents).toBe(false);
        expect(s.filledAmount.toFixed()).toBe("0");
        expect(s.placed).toEqual([]);
    });
});

describe("describeOrderResult", () => {
    it("converts the price with the quote and base decimals the right way round", async () => {
        const wide: OrderResultMarket = {...market, baseDecimals: 8, quoteDecimals: 6};
        // 1 BZE (1e8 micro) at a micro price of 3 is 3 * 10^(8-6) = 300 USDC
        const result = await describeOrderResult(summarizeOrderTx([executed("100000000", "3")], ME), wide);

        expect(result).toBe("Bought 1 BZE at an average price of 300 USDC.");
    });

    it("says a fully filled order was bought at the average price", async () => {
        expect(await text([executed("1000000", "1"), executed("1000000", "3")]))
            .toBe("Bought 2 BZE at an average price of 2 USDC.");
    });

    it("says sold when the signer sold", async () => {
        expect(await text([executed("1000000", "1", ME, "buy")])).toBe("Sold 1 BZE at an average price of 1 USDC.");
    });

    it("adds what was placed after a partial fill", async () => {
        expect(await text([executed("1000000", "2"), saved("250000", "3")]))
            .toBe("Bought 1 BZE at an average price of 2 USDC. 0.250000 BZE placed on the order book at 3.");
    });

    it("says the order is on the book when nothing filled", async () => {
        expect(await text([saved("250000", "3")])).toBe("Your order is on the book: 0.250000 BZE at 3.");
    });

    it("describes a merge", async () => {
        expect(await text([amended("3", "250000", "600000")]))
            .toBe("Added 0.250000 BZE to your order at 3 (now 0.600000 BZE; it moved to the back of the queue at this price).");
    });

    it("appends the fill-cap sentence for max_fills_reached", async () => {
        const result = await text([executed("1000000", "1"), refunded("max_fills_reached", "100", "100ubze")]);

        expect(result).toContain("Bought 1 BZE");
        expect(result).toContain("at most 250 resting orders");
    });

    it("appends the returned rest for the other reasons", async () => {
        expect(await text([refunded("no_match", "2000000", "2000000ubze")])).toBe("The rest (2 BZE) was returned to you.");
    });

    it("omits a dust-only refund", async () => {
        expect(await text([executed("1000000", "1"), refunded("below_min_amount", "3", "")]))
            .toBe("Bought 1 BZE at an average price of 1 USDC.");
    });

    it("gives no text without order events, so the generic toast shows", async () => {
        expect(await text([{type: "transfer", attributes: []}])).toBeUndefined();
    });
});
