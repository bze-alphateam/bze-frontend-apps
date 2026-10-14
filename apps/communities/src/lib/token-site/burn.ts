import BigNumber from "bignumber.js";

/**
 * Share of T's original supply that has been burned (Business Logic R10): burned ÷ (supply +
 * burned), as a fraction between 0 and 1. Both amounts in the same units. Nothing burned, or
 * nothing ever minted, is 0.
 */
export function burnShare(burned: BigNumber, supply: BigNumber): BigNumber {
    if (!burned.gt(0)) return new BigNumber(0);

    const original = supply.plus(burned);
    if (!original.gt(0)) return new BigNumber(0);

    return burned.dividedBy(original);
}

/** A burn share as a percentage: two decimals, and "<0.01%" for a burn too small to show. */
export function formatBurnShare(share: BigNumber): string {
    if (!share.gt(0)) return "0%";
    const percent = share.multipliedBy(100);
    if (percent.lt("0.01")) return "<0.01%";

    return `${percent.decimalPlaces(2, BigNumber.ROUND_DOWN).toFormat()}%`;
}

/** Sum of a token's burns, each in display units. */
export function burnedTotal(burns: { amount: BigNumber }[]): BigNumber {
    return burns.reduce((sum, burn) => sum.plus(burn.amount), new BigNumber(0));
}

/**
 * Time left until the next burn, as the design shows it: the two largest units ("2d 14h",
 * "5h 12m", "12m"), or "Any moment now" once the date has passed.
 */
export function burnCountdown(date: Date, now: Date): string {
    const minutes = Math.floor((date.getTime() - now.getTime()) / 60_000);
    if (minutes < 1) return "Any moment now";

    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const rest = minutes % 60;
    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;

    return `${rest}m`;
}

/** The burner's coin string for `uAmount` base units of `denom` ("1000000factory/…/upage"). */
export function burnCoin(uAmount: BigNumber, denom: string): string {
    return `${uAmount.toFixed(0)}${denom}`;
}
