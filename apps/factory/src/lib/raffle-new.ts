import BigNumber from 'bignumber.js'
import { bze } from '@bze/bzejs'
import { validateAmount } from '@/components/token-wizard/validation'
import { formatDate, minMaxHint, notEnoughText } from '@/lib/format'

// "Burning raffle" (/raffle/new, BFE-208): x/burner MsgStartRaffle. Chain limits from
// its ValidateBasic: pot ≥ 100000 base units, duration 1–180 whole days, chances 1–1,000,000
// (a ticket wins when a random number in [0, 1,000,000) is below it), ratio 0.01–1.00, ticket
// price ≥ 1 base unit. No creation fee; one raffle per denom at a time.

export const RAFFLE_PATH = '/raffle/new'
export const MIN_POT = new BigNumber(100_000)
export const MIN_RAFFLE_DAYS = 1
export const MAX_RAFFLE_DAYS = 180
export const MAX_CHANCES = 1_000_000
/** A raffle where most tickets win isn't a raffle: at best 1 in 5 tickets wins. */
export const MIN_ONE_IN = 5
export const MAX_ONE_IN = 1_000_000
export const MIN_PRIZE_PERCENT = 1
export const MAX_PRIZE_PERCENT = 100

const fmt = (n: number) => n.toLocaleString('en-US')

/** `amount` (display units) in base units; undefined when it isn't a plain number. */
export function toBaseUnits(amount: string, decimals: number): BigNumber | undefined {
    const trimmed = amount.trim()
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined
    return new BigNumber(trimmed).shiftedBy(decimals).integerValue(BigNumber.ROUND_DOWN)
}

/** Base units in display units, exact and without trailing zeros ("1,000", "0.1"). */
export const displayAmount = (base: BigNumber | string, decimals: number): string =>
    new BigNumber(base).shiftedBy(-decimals).toFormat()

/**
 * The prize pot: a valid amount in the token's decimals, at least 100000 base units, at most
 * `maxBase` (the spendable balance, less the network fee when the token pays it). No `maxBase`
 * (no wallet connected) skips the balance check.
 */
export function validatePot(amount: string, decimals: number, ticker: string, maxBase?: BigNumber): string {
    const error = validateAmount(amount, decimals)
    if (error) return error
    const base = toBaseUnits(amount, decimals) as BigNumber
    if (base.lt(MIN_POT)) return `Min ${displayAmount(MIN_POT, decimals)} ${ticker}.`
    if (maxBase && base.gt(maxBase)) return notEnoughText(ticker, displayAmount(maxBase, decimals))
    return ''
}

/** Whole days, 1 to 180. */
export function validateRaffleDays(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return 'Required.'
    if (!/^\d+$/.test(trimmed)) return 'Enter a whole number of days.'
    const days = Number(trimmed)
    if (days < MIN_RAFFLE_DAYS || days > MAX_RAFFLE_DAYS) return `${minMaxHint(MIN_RAFFLE_DAYS, MAX_RAFFLE_DAYS, 'days')}.`
    return ''
}

/** A ticket price above zero and at least one base unit of the token. */
export function validateTicketPrice(amount: string, decimals: number, ticker: string): string {
    const trimmed = amount.trim()
    const fraction = trimmed.split('.')[1]
    if (/^\d+(\.\d+)?$/.test(trimmed) && /[1-9]/.test(trimmed) && fraction && fraction.length > decimals) {
        return `The smallest ticket price is ${displayAmount('1', decimals)} ${ticker}.`
    }
    return validateAmount(amount, decimals)
}

/** "1 in N tickets wins": a whole N from 1 to 1,000,000. */
export function validateOneIn(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return 'Required.'
    if (!/^\d+$/.test(trimmed)) return 'Enter a whole number.'
    const n = Number(trimmed)
    if (n < MIN_ONE_IN || n > MAX_ONE_IN) return `${minMaxHint(MIN_ONE_IN, MAX_ONE_IN)}.`
    return ''
}

/** The share of the pot a winner gets: whole percents, 1 to 100. */
export function validatePrizePercent(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return 'Required.'
    if (!/^\d+$/.test(trimmed)) return 'Enter a whole number.'
    const p = Number(trimmed)
    if (p < MIN_PRIZE_PERCENT || p > MAX_PRIZE_PERCENT) return `${minMaxHint(MIN_PRIZE_PERCENT, `${MAX_PRIZE_PERCENT}%`)}.`
    return ''
}

/** "1 in N tickets wins" → the chain's `chances`: round(1,000,000 / N), clamped to 1…1,000,000. */
export function chancesFromOneIn(n: number): number {
    if (!Number.isFinite(n) || n <= 0) return 1
    return Math.min(MAX_CHANCES, Math.max(1, Math.round(MAX_CHANCES / n)))
}

/** The win chance per ticket the chain uses, in percent ("33.3333"). */
export function percentFromChances(chances: number | bigint | string): string {
    return new BigNumber(chances.toString()).div(MAX_CHANCES).multipliedBy(100).toFixed()
}

/** The chain's `chances` as "1 in N" (rounded to a whole N). */
export function oneInFromChances(chances: number | bigint | string): number {
    const c = new BigNumber(chances.toString())
    if (!c.gt(0)) return 0
    return new BigNumber(MAX_CHANCES).div(c).integerValue(BigNumber.ROUND_HALF_UP).toNumber()
}

/** A whole percent → the chain's `ratio` with two decimals (25 → "0.25", 100 → "1.00"). */
export function ratioFromPercent(percent: number): string {
    return new BigNumber(percent).div(100).toFixed(2)
}

/** The chain's `ratio` → a percent of the pot ("0.25" → "25"). */
export function percentFromRatio(ratio: string): string {
    const r = new BigNumber(ratio)
    return r.isNaN() ? '0' : r.multipliedBy(100).decimalPlaces(2).toFixed()
}

export type PotTrend = 'grows' | 'shrinks' | 'same'

/**
 * Where the pot goes on average, from the expected value per ticket:
 * `ticketPrice − (chances / 1,000,000) × ratio × pot` (all in base units).
 */
export function expectedPotTrend(input: { ticketPrice: BigNumber.Value; chances: number; ratio: string; pot: BigNumber.Value }): PotTrend {
    const win = new BigNumber(input.chances).div(MAX_CHANCES).multipliedBy(input.ratio).multipliedBy(input.pot)
    const ev = new BigNumber(input.ticketPrice).minus(win)
    if (ev.gt(0)) return 'grows'
    if (ev.lt(0)) return 'shrinks'
    return 'same'
}

/** The Review's "Pot trend" row. */
export const POT_TREND_TEXT: Record<PotTrend, string> = {
    grows: 'Grows on average',
    shrinks: 'Shrinks on average',
    same: 'About the same on average',
}

/**
 * When the raffle ends: the chain sets `end_at` = current hour epoch + days × 24, so it ends
 * days × 24 hours after the current hour epoch started. Without epoch info, from `now`.
 */
export function raffleEndDate(days: number, hourEpochStart?: Date | string, now: Date = new Date()): Date {
    const start = hourEpochStart ? new Date(hourEpochStart) : now
    const base = Number.isNaN(start.getTime()) ? now : start
    return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}

/** "14 Nov", with the year when it isn't the current one: the shared date format. */
export const formatRaffleEnd = (date: Date, now: Date = new Date()): string => formatDate(date, now)

export const raffleRunningText = (ticker: string, timeLeft: string) =>
    `A raffle for ${ticker} is already running. It ends in ${timeLeft}.`

/** The chain refused the start because the denom already has a raffle running. */
export const isRaffleRunningError = (err: string | undefined): boolean =>
    Boolean(err && err.includes('raffle already running'))

export interface StartRaffleAnswers {
    creator: string;
    denom: string;
    /** Base units. */
    pot: BigNumber.Value;
    days: number;
    chances: number;
    /** Whole percent of the pot per win. */
    prizePercent: number;
    /** Base units. */
    ticketPrice: BigNumber.Value;
}

/** The one MsgStartRaffle of the form: every field a string, amounts in base units. */
export function buildStartRaffleMsg(a: StartRaffleAnswers) {
    const { startRaffle } = bze.burner.MessageComposer.withTypeUrl
    return startRaffle({
        creator: a.creator,
        denom: a.denom,
        pot: new BigNumber(a.pot).integerValue(BigNumber.ROUND_DOWN).toFixed(),
        duration: String(a.days),
        chances: String(a.chances),
        ratio: ratioFromPercent(a.prizePercent),
        ticketPrice: new BigNumber(a.ticketPrice).integerValue(BigNumber.ROUND_DOWN).toFixed(),
    })
}

/** Link to the form; `returnTo` adds the way back (epic convention: `return` + `returnLabel`). */
export function raffleHref(denom?: string, returnTo?: { href: string; label: string }): string {
    const params = new URLSearchParams()
    if (denom) params.set('denom', denom)
    if (returnTo) {
        params.set('return', returnTo.href)
        params.set('returnLabel', returnTo.label)
    }
    const query = params.toString()
    return query ? `${RAFFLE_PATH}?${query}` : RAFFLE_PATH
}

/** The token's coin page in the Burner app, where a running raffle is shown and joined. */
export const burnerCoinHref = (burnerHref: string, denom: string) =>
    `${burnerHref}/coin?coin=${encodeURIComponent(denom)}`

/** The "How it plays" answers, once valid. */
export interface RafflePlay {
    days: number;
    /** "10 HONEY". */
    ticket: string;
    /** The N of "1 in N". */
    oneIn: number;
    percent: number;
}

/** "500,000 HONEY in the pot". */
export const potSummary = (pot: string) => `${pot} in the pot`

/** "7 days · 10 HONEY a ticket · 1 in 100 · winner gets 50%". */
export function rafflePlaySummary({ days, ticket, oneIn, percent }: RafflePlay): string {
    return `${fmt(days)} ${days === 1 ? 'day' : 'days'} · ${ticket} a ticket · 1 in ${fmt(oneIn)} · winner gets ${percent}%`
}

/** What the raffle wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface RaffleDoneInput {
    denom: string;
    ticker: string;
    /** "14 Nov"; '' when unknown. */
    endsAt: string;
}

/** The Done screen's line under the title. */
export const raffleDoneText = (endsAt: string) => endsAt ? `Ends ${endsAt}.` : ''
