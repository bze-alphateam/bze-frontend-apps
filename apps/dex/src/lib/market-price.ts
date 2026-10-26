/** A market"s last price with its quote ticker, or "—" when the market has no trade data yet. */
export function marketPriceLabel(lastPrice: number | undefined, quoteTicker: string | undefined): string {
    if (lastPrice === undefined || !quoteTicker) return "—";

    return `${lastPrice} ${quoteTicker}`;
}
