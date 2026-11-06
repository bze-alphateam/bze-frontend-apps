import BigNumber from "bignumber.js";

import type {ScanBalance} from "./types";

/** A base-unit amount in display units: grouped, every significant decimal, no padding zeros. */
export function formatUnits(amount: string | BigNumber, exponent: number | null | undefined): string {
    const value = new BigNumber(amount);
    if (value.isNaN()) return "0";

    return value.shiftedBy(-(exponent ?? 0)).toFormat();
}

/** "1,000 NOAD"; the denom stands in when Scan doesn't know its symbol (then in base units). */
export function formatCoin(coin: Pick<ScanBalance, "amount" | "denom" | "symbol" | "exponent">): string {
    if (!coin.symbol) return `${formatUnits(coin.amount, 0)} ${coin.denom}`;

    return `${formatUnits(coin.amount, coin.exponent)} ${coin.symbol}`;
}

/** Coins joined with " + " (a fee paid in two denoms). */
export const formatCoins = (coins: ScanBalance[]): string => coins.map(formatCoin).join(" + ");

/** "bze1fk…y3y5k": the prefix and two characters, then the last five. */
export const shortAddress = (address: string): string =>
    address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-5)}` : address;

/** "8E56…F595". */
export const shortHash = (hash: string): string =>
    hash.length > 10 ? `${hash.slice(0, 4).toUpperCase()}…${hash.slice(-4).toUpperCase()}` : hash.toUpperCase();

/** "Nov 5 · 21:09" in the viewer's time zone (`timeZone` for tests); the year only when it isn't this one. */
export function formatWhen(time: string, now: Date = new Date(), timeZone?: string): string {
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return "";

    const yearOf = (d: Date) => new Intl.DateTimeFormat("en-US", {year: "numeric", timeZone}).format(d);
    const day = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        ...(yearOf(date) === yearOf(now) ? {} : {year: "numeric"}),
        timeZone,
    }).format(date);
    const clock = new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit", hour12: false, timeZone}).format(date);

    return `${day} · ${clock}`;
}
