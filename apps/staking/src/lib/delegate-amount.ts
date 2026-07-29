import BigNumber from "bignumber.js";
import { amountToUAmount } from "@bze/bze-ui-kit";

// Pure amount/validation helpers for the delegate modal, kept free of React /
// wallet imports so they can be unit-tested in isolation.

// BZE held back from a "Max" delegation so the user keeps enough to pay the
// transaction fee.
export const FEE_RESERVE = new BigNumber("0.1");

export type DelegationAmountError = "empty" | "not-positive" | "insufficient-balance";

/**
 * Validate a human-entered delegation amount against the wallet's native
 * balance (in uamount). Returns `null` when the amount is valid, otherwise a
 * reason code the caller maps to a user-facing message.
 */
export function validateDelegationAmount(
    amount: string,
    balanceUAmount: BigNumber.Value,
    decimals: number,
): DelegationAmountError | null {
    if (!amount) {
        return "empty";
    }
    if (new BigNumber(amount).lte(0)) {
        return "not-positive";
    }
    const uAmount = amountToUAmount(amount, decimals);
    if (new BigNumber(uAmount).gt(balanceUAmount)) {
        return "insufficient-balance";
    }
    return null;
}

/**
 * True when the entered amount would delegate the entire available balance
 * (and there is a balance to delegate) — the cue to warn about leaving nothing
 * for fees.
 */
export function isUsingFullBalance(amount: string, availableHuman: BigNumber): boolean {
    if (!amount) {
        return false;
    }
    return new BigNumber(amount).gte(availableHuman) && availableHuman.gt(0);
}

/** A fraction (0.25 / 0.5 / 0.75 / 1) of the available balance, at token precision. */
export function quickAmount(
    availableHuman: BigNumber,
    fraction: number,
    decimals: number,
): string {
    return availableHuman.multipliedBy(fraction).decimalPlaces(decimals).toString();
}

/** The available balance minus the fee reserve, at token precision. */
export function reserveForFeesAmount(availableHuman: BigNumber, decimals: number): string {
    return availableHuman.minus(FEE_RESERVE).decimalPlaces(decimals).toString();
}

/** Whether there is enough balance to keep the fee reserve back at all. */
export function canReserveForFees(availableHuman: BigNumber): boolean {
    return availableHuman.gt(FEE_RESERVE);
}
