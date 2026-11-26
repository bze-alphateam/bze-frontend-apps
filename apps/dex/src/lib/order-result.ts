import BigNumber from "bignumber.js";
import {MAX_FILLS_REACHED_REASON, prettyAmount, uAmountToAmount, uPriceToPrice} from "@bze/bze-ui-kit";
import type {TendermintEvent} from "@bze/bze-ui-kit";
import {maxFillsReachedMessage} from "@/lib/order-fills";

const EXECUTED = 'bze.tradebin.OrderExecutedEvent';
const SAVED = 'bze.tradebin.OrderSavedEvent';
const AMENDED = 'bze.tradebin.OrderAmendedEvent';
const REFUNDED = 'bze.tradebin.OrderMessageRefundedEvent';

export interface PlacedOrder {
    /** micro-unit base amount */
    amount: BigNumber;
    /** micro-unit price, as the chain stores it */
    price: BigNumber;
}

export interface MergedOrder {
    price: BigNumber;
    addedAmount: BigNumber;
    /** the merged order's total */
    amount: BigNumber;
}

export interface ReturnedAmount {
    reason: string;
    /** micro-unit base amount that was not executed (only counted when something was sent back) */
    amount: BigNumber;
}

/** What one order tx did for the signer, in the chain's micro units. */
export interface OrderTxSummary {
    /** false for a v8.2.0 tx: orders ran at the end of the block, the tx carries no order events */
    hasOrderEvents: boolean;
    /** the signer's side of the fills: the opposite of the resting orders they hit */
    side?: 'buy' | 'sell';
    filledAmount: BigNumber;
    /** Σ amount × price / Σ amount (micro price), 0 when nothing filled */
    avgPrice: BigNumber;
    placed: PlacedOrder[];
    merged: MergedOrder[];
    returned: ReturnedAmount[];
}

// Typed-event attribute values are JSON-quoted strings ("\"bze1...\""); plain ones pass.
const unquote = (value: string | undefined): string => {
    if (value === undefined) return '';
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'string' ? parsed : value;
    } catch {
        return value;
    }
}

const attr = (event: TendermintEvent, key: string): string =>
    unquote(event.attributes.find(a => a.key === key)?.value);

const num = (event: TendermintEvent, key: string): BigNumber => {
    const n = new BigNumber(attr(event, key));
    return n.isNaN() ? new BigNumber(0) : n;
}

/**
 * Sums what an order tx did for `signer` from the tx's own events (chain v8.3.0 runs orders inside
 * the tx). Only the signer's events count: fills where they are the taker, and saved / amended /
 * refunded orders they own. A create-order tx with several messages, or a fill with several
 * entries, is aggregated.
 */
export const summarizeOrderTx = (events: TendermintEvent[] | undefined, signer: string): OrderTxSummary => {
    const list = events ?? [];
    const orderEvents = list.filter(e => [EXECUTED, SAVED, AMENDED, REFUNDED].some(t => e.type.includes(t)));
    const summary: OrderTxSummary = {
        hasOrderEvents: orderEvents.length > 0,
        filledAmount: new BigNumber(0),
        avgPrice: new BigNumber(0),
        placed: [],
        merged: [],
        returned: [],
    };

    let notional = new BigNumber(0);
    const returned = new Map<string, BigNumber>();
    for (const event of orderEvents) {
        if (event.type.includes(EXECUTED)) {
            if (attr(event, 'taker') !== signer) continue;
            const amount = num(event, 'amount');
            summary.filledAmount = summary.filledAmount.plus(amount);
            notional = notional.plus(amount.multipliedBy(num(event, 'price')));
            summary.side = attr(event, 'order_type') === 'sell' ? 'buy' : 'sell';
        } else if (event.type.includes(SAVED)) {
            if (attr(event, 'owner') !== signer) continue;
            summary.placed.push({amount: num(event, 'amount'), price: num(event, 'price')});
        } else if (event.type.includes(AMENDED)) {
            if (attr(event, 'owner') !== signer) continue;
            summary.merged.push({price: num(event, 'price'), addedAmount: num(event, 'added_amount'), amount: num(event, 'amount')});
        } else if (event.type.includes(REFUNDED)) {
            if (attr(event, 'owner') !== signer) continue;
            // an empty refund means only dust was left: nothing to tell the user
            if (attr(event, 'refund') === '') continue;
            const reason = attr(event, 'reason');
            returned.set(reason, (returned.get(reason) ?? new BigNumber(0)).plus(num(event, 'amount')));
        }
    }

    if (summary.filledAmount.gt(0)) {
        summary.avgPrice = notional.dividedBy(summary.filledAmount);
    }
    summary.returned = Array.from(returned, ([reason, amount]) => ({reason, amount}));

    return summary;
}

export interface OrderResultMarket {
    baseTicker: string;
    quoteTicker: string;
    baseDecimals: number;
    quoteDecimals: number;
    /** `maxFillsPerOrder`, read lazily: only needed when a refund hit the cap */
    maxFills: () => Promise<number>;
}

/**
 * The toast text of an order tx, or undefined when the tx carries no order events (a v8.2.0 node:
 * the caller shows the generic success toast).
 */
export const describeOrderResult = async (summary: OrderTxSummary, market: OrderResultMarket): Promise<string | undefined> => {
    if (!summary.hasOrderEvents) return undefined;

    const {baseTicker, quoteTicker, baseDecimals, quoteDecimals} = market;
    const amount = (u: BigNumber) => `${prettyAmount(uAmountToAmount(u.toFixed(0), baseDecimals))} ${baseTicker}`;
    const price = (u: BigNumber) => prettyAmount(uPriceToPrice(u.toFixed(), quoteDecimals, baseDecimals));
    const parts: string[] = [];

    const filled = summary.filledAmount.gt(0);
    if (filled) {
        const verb = summary.side === 'sell' ? 'Sold' : 'Bought';
        parts.push(`${verb} ${amount(summary.filledAmount)} at an average price of ${price(summary.avgPrice)} ${quoteTicker}.`);
    }

    const placedTotal = summary.placed.reduce((sum, p) => sum.plus(p.amount), new BigNumber(0));
    if (summary.placed.length > 0) {
        const where = summary.placed.map(p => `${amount(p.amount)} at ${price(p.price)}`).join(', ');
        parts.push(filled
            ? `${amount(placedTotal)} placed on the order book at ${summary.placed.map(p => price(p.price)).join(', ')}.`
            : `Your order is on the book: ${where}.`);
    }

    for (const m of summary.merged) {
        parts.push(`Added ${amount(m.addedAmount)} to your order at ${price(m.price)} (now ${amount(m.amount)}; it moved to the back of the queue at this price).`);
    }

    for (const r of summary.returned) {
        if (r.reason === MAX_FILLS_REACHED_REASON) {
            parts.push(maxFillsReachedMessage(await market.maxFills()));
        } else {
            parts.push(`The rest (${amount(r.amount)}) was returned to you.`);
        }
    }

    // only dust or a refund that was filtered out: still a success the user should see confirmed
    return parts.length > 0 ? parts.join(' ') : undefined;
}
