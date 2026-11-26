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

/** A date and time for the history: "1 Nov 2026, 10:00 UTC"; empty when the time is missing or unreadable. */
export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
    const time = date.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', timeZone: 'UTC'});
    return `${day}, ${time} UTC`;
}

/** Unix seconds (the chain sends them as strings) as an ISO time; null when unreadable or zero. */
export function isoFromUnix(seconds: string | number | null | undefined): string | null {
    const n = Number(seconds);
    if (!seconds || !Number.isFinite(n) || n <= 0) return null;
    return new Date(n * 1000).toISOString();
}

/** "3 days", "1 day 12 hours", "45 minutes": a duration in seconds for people. */
export function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    if (s === 0) return '0 seconds';
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
    if (days > 0) return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day');
    if (hours > 0) return minutes > 0 ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}` : plural(hours, 'hour');
    if (minutes > 0) return plural(minutes, 'minute');
    return plural(s, 'second');
}

/**
 * A chain ratio ("0.400000000000000000") as a percentage for people: "40%", "33.34%". It rounds
 * up at two decimals so the bar shown is never below the real one; a ratio just under 1 would
 * round to a full 100%, which no threshold can be, so it reads "just under 100%".
 */
export function formatRatio(ratio: string): string {
    const value = new BigNumber(ratio);
    if (!value.isFinite()) return ratio;
    const percent = value.multipliedBy(100).decimalPlaces(2, BigNumber.ROUND_CEIL);
    if (percent.gte(100) && value.lt(1)) return 'just under 100%';
    return `${percent.toFormat()}%`;
}

/** "bze1abcd…wxyz": an address short enough for a sentence. */
export function shortAddress(address: string): string {
    return address.length > 20 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;
}

/**
 * A time relative to `nowMs`: "in 2 days", "3 hours ago", "just now". The clock is a parameter so
 * the text is testable; empty when the time is missing or unreadable.
 */
export function formatRelative(iso: string | null | undefined, nowMs: number): string {
    if (!iso) return '';
    const at = new Date(iso).getTime();
    if (Number.isNaN(at)) return '';
    const diff = Math.round((at - nowMs) / 1000);
    const abs = Math.abs(diff);
    if (abs < 45) return 'just now';
    const units: [number, string][] = [[86400, 'day'], [3600, 'hour'], [60, 'minute']];
    const [size, unit] = units.find(([s]) => abs >= s) ?? units[2];
    const count = Math.max(1, Math.floor(abs / size));
    const span = `${count} ${unit}${count === 1 ? '' : 's'}`;
    return diff > 0 ? `in ${span}` : `${span} ago`;
}
