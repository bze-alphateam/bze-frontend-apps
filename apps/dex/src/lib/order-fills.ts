import BigNumber from "bignumber.js";
import {uPriceToMsgPrice} from "@bze/bze-ui-kit";

export interface FillSource {
    price: string;
    amount: string;
}

/**
 * The entries of a MsgFillOrders. The chain refuses amounts that are not canonical base-10
 * integers (no exponent, no decimals) and two entries at one price written differently ("1" and
 * "1.0"), so amounts are written in plain integer notation and prices normalised. Entries that
 * end up at the same price are summed into one.
 */
export const buildFillEntries = (orders: FillSource[]): FillSource[] => {
    const byPrice = new Map<string, BigNumber>();
    for (const order of orders) {
        const price = uPriceToMsgPrice(order.price);
        byPrice.set(price, (byPrice.get(price) ?? new BigNumber(0)).plus(order.amount));
    }

    return Array.from(byPrice, ([price, amount]) => ({price, amount: amount.toFixed(0)}));
}

export const maxFillsReachedMessage = (maxFills: number): string =>
    `Part of your order was returned to you: one order can fill at most ${maxFills} resting orders. Place another order for the rest.`;

export const MERGE_HINT = "You already have an order at this price. This adds to it, and the combined order moves to the back of the queue at this price.";

export interface RestingOrder {
    order_type: string;
    price: string;
}

/** Whether the owner already rests an order on this side at this price (compared numerically). */
export const hasOrderAtPrice = (myOrders: RestingOrder[], orderType: string, uPrice: BigNumber): boolean => {
    if (uPrice.isNaN() || uPrice.lte(0)) return false;

    return myOrders.some(order => order.order_type === orderType && new BigNumber(order.price).eq(uPrice));
}
