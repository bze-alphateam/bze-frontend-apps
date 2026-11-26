import BigNumber from 'bignumber.js';

export type ParsedAmount = {ok: true; base: string} | {ok: false; error: string};

/**
 * A typed amount in a token's display units as whole base units (exact BigNumber math, never a float).
 * Digits past the token's exponent are refused rather than cut, so the chain never gets less than
 * what the form showed. `decimals` 0 is a token the app does not know: the amount is in base units.
 */
export function parseTokenAmount(text: string, decimals: number): ParsedAmount {
    const value = text.trim();
    if (value === '') return {ok: false, error: 'Enter an amount.'};
    if (!/^\d+(\.\d+)?$/.test(value)) return {ok: false, error: 'The amount must be a plain number, like 12.5.'};

    const fraction = value.split('.')[1] ?? '';
    if (fraction.length > decimals) {
        return {ok: false, error: decimals === 0 ? 'This token has no decimals: enter a whole number.' : `This token has at most ${decimals} decimals.`};
    }

    const base = new BigNumber(value).shiftedBy(decimals);
    if (!base.isFinite() || !base.isInteger()) return {ok: false, error: 'The amount is not a valid number.'};
    if (base.lte(0)) return {ok: false, error: 'The amount must be more than zero.'};
    return {ok: true, base: base.toFixed(0)};
}
