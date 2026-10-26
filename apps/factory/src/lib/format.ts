// The wording every form shares: dates, min/max hints and the balance lines, so the forms
// never phrase the same thing two ways.

/** "26 Oct", with the year when it isn't the current one: "26 Oct 2027". Always exact, never "about". */
export function formatDate(date: Date, now: Date = new Date()): string {
    const sameYear = date.getFullYear() === now.getFullYear()
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** "Min 1 · Max 36500 days": raw numbers, the same the errors print. */
export const minMaxHint = (min: number | string, max: number | string, unit = '') =>
    `Min ${min} · Max ${max}${unit ? ` ${unit}` : ''}`

/** "You hold 12 HONEY" */
export const youHoldText = (held: string, ticker: string) => `You hold ${held} ${ticker}`

/** "Not enough HONEY: you hold 12 HONEY." */
export const notEnoughText = (ticker: string, held: string) => `Not enough ${ticker}: you hold ${held} ${ticker}.`
