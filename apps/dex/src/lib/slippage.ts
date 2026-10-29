import BigNumber from "bignumber.js";

/** Max slippage choices offered by the swap form, in percent. */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 2] as const;

/** Max slippage used until the user picks one, in percent. */
export const DEFAULT_SLIPPAGE = 0.5;

/** Largest custom slippage the form accepts, in percent. */
export const MAX_SLIPPAGE = 50;

/** True when `value` is a slippage the form can use: a finite percent from 0 to the cap. */
export function isValidSlippage(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_SLIPPAGE;
}

/** The slippage to apply for a stored setting; anything missing or out of range falls back to the default. */
export function normalizeSlippage(stored: unknown): number {
    return isValidSlippage(stored) ? stored : DEFAULT_SLIPPAGE;
}

/** Parses the custom slippage field; null when the text is not an acceptable percent. */
export function parseCustomSlippage(text: string): number | null {
    if (text.trim() === "") return null;
    const value = Number(text);
    return isValidSlippage(value) ? value : null;
}

export function isSlippagePreset(value: number): boolean {
    return (SLIPPAGE_PRESETS as readonly number[]).includes(value);
}

/**
 * The least output a swap may return, in micro units: the quoted output minus the slippage,
 * rounded down so the chain's own whole-unit output always satisfies it, and never below 1
 * because `MsgMultiSwap` rejects a zero minimum. Null when the quote itself rounds down to
 * nothing: such a swap cannot be sent, the chain would pay nothing out.
 */
export function minimumSwapOutput(expectedOut: BigNumber, slippagePercent: number): BigNumber | null {
    const quoted = expectedOut.integerValue(BigNumber.ROUND_FLOOR);
    if (!quoted.isFinite() || quoted.lt(1)) return null;

    const minimum = quoted
        .multipliedBy(new BigNumber(100).minus(slippagePercent))
        .dividedBy(100)
        .integerValue(BigNumber.ROUND_FLOOR);

    return BigNumber.max(minimum, 1);
}
