import BigNumber from 'bignumber.js';

/** One token of the treasury as the card shows it. */
export interface TreasuryRow {
    denom: string;
    ticker: string;
    /** The amount for people ("182,400"). */
    amount: string;
    /** "≈ $9,120"; empty when the token has no price. */
    usd: string;
    /** The letter of the badge and its two colours. */
    badge: {letter: string; from: string; to: string; ink: string};
}

export interface TreasuryView {
    rows: TreasuryRow[];
    /** "≈ $14,860", the sum of the priced tokens; empty when none has a price. */
    total: string;
    /** Some tokens have no price, so the total leaves them out. */
    partial: boolean;
}

export interface TreasuryCoinInfo {
    ticker: (denom: string) => string;
    amount: (denom: string, amount: string) => string;
    /** The coin's value in USD; null (or zero) when there is no price. */
    usdValue: (coin: {denom: string; amount: string}) => BigNumber | null;
}

/** "≈ $9,120" from 100 up, "≈ $12.50" below: the card's rounding. */
export function formatUsd(value: BigNumber): string {
    return `≈ $${value.gte(100) ? value.toFormat(0) : value.toFormat(2)}`;
}

// The badge colours of the board: BZE in its cyan, then gold, blue and a few more picked by the ticker.
const BZE = {from: '#33C3E0', to: '#0094C5', ink: '#FFFFFF'};
const PALETTE = [
    {from: '#FFE08A', to: '#C98A00', ink: '#1A1200'},
    {from: '#4C8DF6', to: '#2D62C9', ink: '#FFFFFF'},
    {from: '#8F8CFF', to: '#5B55E8', ink: '#FFFFFF'},
    {from: '#3DD07A', to: '#1E9150', ink: '#03170B'},
    {from: '#FF8A1F', to: '#E85A00', ink: '#1A0A00'},
    {from: '#B57EDC', to: '#8E44AD', ink: '#FFFFFF'},
];

/** The letter badge of a token: its ticker's first letter, a colour pair picked by the ticker (BZE always cyan). */
export function tokenBadge(ticker: string): TreasuryRow['badge'] {
    const letter = (ticker.match(/[A-Za-z0-9]/)?.[0] ?? '?').toUpperCase();
    if (/^T?BZE$/i.test(ticker)) return {letter, ...BZE};
    let hash = 0;
    for (const ch of ticker.toUpperCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return {letter, ...PALETTE[hash % PALETTE.length]};
}

/** The treasury card: one row per token, its USD value when priced, and the total of the priced ones. */
export function treasuryView(coins: readonly {denom: string; amount: string}[], info: TreasuryCoinInfo): TreasuryView {
    let total = new BigNumber(0);
    let priced = 0;
    const rows = coins.map((coin): TreasuryRow => {
        const ticker = info.ticker(coin.denom);
        const value = info.usdValue(coin);
        const has = !!value && value.isFinite() && value.gt(0);
        if (value && has) {
            total = total.plus(value);
            priced += 1;
        }
        return {denom: coin.denom, ticker, amount: info.amount(coin.denom, coin.amount), usd: value && has ? formatUsd(value) : '', badge: tokenBadge(ticker)};
    });
    return {rows, total: priced > 0 ? formatUsd(total) : '', partial: priced > 0 && priced < coins.length};
}
