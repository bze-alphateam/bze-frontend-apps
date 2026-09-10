import BigNumber from "bignumber.js";
import { amountToUAmount } from "@bze/bze-ui-kit";

// Pure amount/validation helpers for the delegate modal, kept free of React /
// wallet imports so they can be unit-tested in isolation. The gas reserve itself
// comes from ui-kit's shared engine (useMaxSpendable / useCanAffordTx); these
// helpers only turn its numbers into form values and error codes.

export type DelegationAmountError = "empty" | "not-positive" | "insufficient-balance" | "no-fee-reserve";

/**
 * Validate a human-entered delegation amount against the wallet's native
 * balance and, when known, the spendable amount left after the gas fee (both
 * in uamount). Returns `null` when the amount is valid, otherwise a reason code
 * the caller maps to a user-facing message:
 *
 * - `insufficient-balance` — more than the wallet holds.
 * - `no-fee-reserve`       — fits the balance but leaves nothing for the gas fee.
 */
export function validateDelegationAmount(
    amount: string,
    balanceUAmount: BigNumber.Value,
    decimals: number,
    spendableUAmount?: BigNumber.Value,
): DelegationAmountError | null {
    if (!amount) {
        return "empty";
    }
    if (new BigNumber(amount).lte(0)) {
        return "not-positive";
    }
    const uAmount = new BigNumber(amountToUAmount(amount, decimals));
    if (uAmount.gt(balanceUAmount)) {
        return "insufficient-balance";
    }
    if (spendableUAmount !== undefined && uAmount.gt(spendableUAmount)) {
        return "no-fee-reserve";
    }
    return null;
}

/**
 * True when the entered amount leaves less than the gas fee behind — the cue to
 * warn and offer the spendable maximum instead. Only meaningful when there is
 * a balance to delegate.
 */
export function exceedsSpendable(amount: string, spendableHuman: BigNumber, availableHuman: BigNumber): boolean {
    if (!amount || !availableHuman.gt(0)) {
        return false;
    }
    const entered = new BigNumber(amount);
    return !entered.isNaN() && entered.gt(spendableHuman);
}

/**
 * A fraction (0.25 / 0.5 / 0.75 / 1) of a balance, at token precision. Callers
 * pass the spendable balance (gas already reserved) so that 100 % is a valid
 * amount, not one that fails at the fee.
 */
export function quickAmount(
    availableHuman: BigNumber,
    fraction: number,
    decimals: number,
): string {
    return availableHuman.multipliedBy(fraction).decimalPlaces(decimals, BigNumber.ROUND_DOWN).toString();
}
