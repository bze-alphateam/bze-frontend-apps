// Pure countdown math for the next-burn timer, extracted so it can be unit-tested
// without the timer component's interval/effect. No React / next imports.

export interface DurationParts {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

/**
 * Break a whole-second countdown into day / hour / minute / second parts, as the
 * burn countdown timer displays them. The input is clamped to a non-negative
 * integer first, so a spent (negative) countdown reads as all zeros.
 */
export function breakdownDuration(totalSeconds: number): DurationParts {
    const clamped = Math.max(0, Math.floor(totalSeconds));
    return {
        days: Math.floor(clamped / SECONDS_PER_DAY),
        hours: Math.floor((clamped % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
        minutes: Math.floor((clamped % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
        seconds: clamped % SECONDS_PER_MINUTE,
    };
}
