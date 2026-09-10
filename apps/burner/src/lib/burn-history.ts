import BigNumber from "bignumber.js";

// Pure burn-history aggregation, extracted from the burn pages so it can be
// unit-tested without React / chain queries. No next/* imports.

// The minimal shape the total-burned logic reads from a processed burn entry
// (as produced by useBurningHistory). Extra fields on the real item are ignored.
interface BurnAmount {
    denom: string;
    amount: BigNumber;
}

/**
 * Sum the burned amounts across history entries. With `denom` given, only that
 * denom's burns are counted (e.g. total native BZE burned); without it, every
 * entry is summed. Returns a new BigNumber and never mutates the input.
 */
export function sumBurnAmounts<T extends BurnAmount>(
    items: readonly T[],
    denom?: string,
): BigNumber {
    return items
        .filter((item) => denom === undefined || item.denom === denom)
        .reduce((total, item) => total.plus(item.amount), new BigNumber(0));
}
