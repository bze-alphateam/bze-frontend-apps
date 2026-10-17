import BigNumber from "bignumber.js";

// Text for the governance pages: percentages, UTC dates and durations. Pure
// functions; the clock is always passed in. Ported from BZE Scan's
// ui/src/lib/format.ts and ui/src/render/proposals.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** A percentage with one decimal, `.0` trimmed: `74.3%`, `50%`. Empty for an unreadable value. */
export function formatPct(value: BigNumber.Value): string {
    const v = new BigNumber(value);
    if (!v.isFinite()) return "";
    return `${v.toFixed(1, BigNumber.ROUND_HALF_UP).replace(/\.0$/, "")}%`;
}

/** A chain fraction (`"0.334000000000000000"`) as a percentage: `33.4%`. */
export function fractionPct(fraction: string): string {
    return formatPct(new BigNumber(fraction).times(100));
}

const toDate = (time: string | Date): Date | null => {
    const d = new Date(time);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** `Oct 20, 2026, 10:13 UTC`. Empty for an unreadable time. */
export function formatDateTimeUtc(time: string | Date): string {
    const d = toDate(time);
    if (!d) return "";
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** `Jul 21, 2026` (UTC). Empty for an unreadable time. */
export function formatDateUtc(time: string | Date): string {
    const d = toDate(time);
    if (!d) return "";
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * A length of time in its two largest units: `2 days 22 hours`, `3 hours 5 min`,
 * `12 min`, `5 days`; `less than a minute` under a minute.
 */
export function durationText(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    if (!Number.isFinite(minutes) || minutes < 1) return "less than a minute";
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    if (days > 0) return hours > 0 ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
    if (hours > 0) return mins > 0 ? `${plural(hours, "hour")} ${mins} min` : plural(hours, "hour");
    return `${mins} min`;
}

/** Time left until `end`: `2 days 22 hours`; `less than a minute` once it is (nearly) over. */
export function endsIn(end: string, now: Date): string {
    return durationText((new Date(end).getTime() - now.getTime()) / 1000);
}

/** A protobuf JSON duration (`"432000s"`, `"1.5s"`) in seconds; null when unreadable. */
export function parseDurationSeconds(duration: string | null | undefined): number | null {
    const match = /^(\d+(?:\.\d+)?)s$/.exec(duration?.trim() ?? "");
    return match ? Number(match[1]) : null;
}

/** The voting period for the rules: `432000s` → `5 days`, `7200s` → `2 hours`; null when unreadable. */
export function votingPeriodText(duration: string | null | undefined): string | null {
    const seconds = parseDurationSeconds(duration);
    return seconds == null ? null : durationText(seconds);
}
