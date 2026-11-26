import BigNumber from 'bignumber.js';

export interface FeeAsset {
    decimals: number;
    ticker: string;
}

/** A coin for people: "100 BZE" when the denom is known, the raw amount and denom when it is not. */
export function formatCoin(coin: {denom: string; amount: string}, asset?: FeeAsset): string {
    if (!asset) return `${coin.amount} ${coin.denom}`;
    const amount = new BigNumber(coin.amount).shiftedBy(-asset.decimals);
    return `${amount.toFormat()} ${asset.ticker}`;
}

/** A date for a card: "1 Nov 2026"; empty when the time is missing or unreadable. */
export function formatDay(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
}
