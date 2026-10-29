import BigNumber from "bignumber.js";
import {uAmountToBigNumberAmount} from "@bze/bze-ui-kit";

/**
 * Converts a wallet balance (micro denom) into a value that can be dropped straight into a
 * trading form input. Returns an empty string when there is nothing worth filling in, so
 * callers can ignore the interaction instead of writing a "0" into the form.
 *
 * toFixed() is used instead of toString() so tiny balances never reach an input as
 * exponential notation ("1e-8"), which the form helpers cannot parse back.
 */
export const balanceToFormValue = (uAmount: BigNumber | string | number | undefined, decimals: number): string => {
    if (uAmount === undefined || uAmount === '') {
        return '';
    }

    const amount = uAmountToBigNumberAmount(uAmount, decimals);
    if (amount.isNaN() || amount.lte(0)) {
        return '';
    }

    return amount.toFixed();
}

/**
 * True when an order amount or price (micro units) can go into a message: finite and above zero.
 * BigNumber's isPositive() is true for 0, so a 0 price used to reach the chain and fail its
 * ValidateBasic after signing.
 */
export const isPositiveOrderValue = (value: BigNumber): boolean => value.isFinite() && value.gt(0);

/**
 * The price an order submit actually sends, in chain units: the user's price for a fresh order
 * or a multi-order fill, but the matched order's own price when exactly one order gets filled
 * (that fill is sent as a create at the maker's price). The chain's minimum amount is computed
 * from the price in the message, so any amount check must use this price.
 */
export const orderPriceSent = (uPrice: BigNumber, matchedPrices: string[]): BigNumber =>
    matchedPrices.length === 1 ? new BigNumber(matchedPrices[0]) : uPrice;
