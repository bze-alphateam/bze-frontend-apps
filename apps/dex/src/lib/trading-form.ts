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
