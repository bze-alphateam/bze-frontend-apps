import BigNumber from "bignumber.js";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

// Pure validator-list logic for the staking dashboard, extracted so it can be
// unit-tested without React / next / wallet wiring. Free of next/* and React
// imports; the components pass their already-fetched validator arrays in.

/**
 * Validators whose moniker or operator address contains the search term,
 * case-insensitively. An empty term matches every validator. Returns a new
 * array — the input, which comes straight from a hook/context, is never
 * filtered in place.
 */
export function filterValidators(
    validators: readonly ValidatorSDKType[],
    search: string,
): ValidatorSDKType[] {
    const term = search.toLowerCase();
    return validators.filter((validator) => {
        const moniker = validator.description?.moniker?.toLowerCase() ?? "";
        return (
            moniker.includes(term) ||
            validator.operator_address.toLowerCase().includes(term)
        );
    });
}

/**
 * Validators sorted by bonded tokens, descending (largest voting power first).
 * Returns a new array — the input is not sorted in place.
 */
export function sortValidatorsByTokens(
    validators: readonly ValidatorSDKType[],
): ValidatorSDKType[] {
    return [...validators].sort((a, b) =>
        new BigNumber(b.tokens).minus(new BigNumber(a.tokens)).toNumber(),
    );
}

/**
 * A validator commission rate (a `0..1` decimal string, e.g. `"0.05"`) rendered
 * as a percentage with at most one decimal place: `"0.05"` -> `"5"`, `"0.125"`
 * -> `"12.5"`. A missing rate is treated as `0`. Shared by the validators list
 * and the delegate modal.
 */
export function formatCommissionRate(rate: string | undefined): string {
    return new BigNumber(rate ?? "0")
        .multipliedBy(100)
        .decimalPlaces(1)
        .toString();
}
