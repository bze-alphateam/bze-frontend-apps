import BigNumber from "bignumber.js";

/** A ticket wins when the chain's draw out of this range lands under `chances` (x/burner `randomRangeMax`). */
export const RAFFLE_CHANCE_RANGE = 1_000_000;

/** The chain keeps a raffle's winners in a ring of this many slots, keyed by `winners % 100`. */
const WINNER_SLOTS = 100;

/** A ticket's chance as "1 in N" (Business Logic R11): never a percentage that reads like a promise. */
export function raffleOdds(chances: bigint | string | number): string {
    const value = new BigNumber(chances.toString());
    if (value.isNaN() || !value.gt(0)) return "—";

    const odds = new BigNumber(RAFFLE_CHANCE_RANGE).dividedBy(value);
    return `1 in ${odds.decimalPlaces(2, BigNumber.ROUND_HALF_UP).toFormat()}`;
}

/** What a winning ticket takes right now, display units: `ratio × pot`, truncated like the chain does. */
export function rafflePrize(pot: string, ratio: string, decimals: number): BigNumber {
    const prize = new BigNumber(pot).multipliedBy(ratio).integerValue(BigNumber.ROUND_DOWN);
    if (!prize.isFinite() || !prize.gt(0)) return new BigNumber(0);

    return prize.shiftedBy(-decimals);
}

/** The prize share as a percentage of the pot ("50%"). */
export function raffleShare(ratio: string): string {
    const percent = new BigNumber(ratio).multipliedBy(100);
    if (!percent.isFinite() || !percent.gt(0)) return "0%";

    return `${percent.decimalPlaces(2, BigNumber.ROUND_DOWN).toFormat()}%`;
}

interface Winner {
    index: string;
}

/**
 * The newest `count` winners first. The chain writes winner number n to slot `n % 100`, so the
 * list comes back in key order, not in the order people won: walk back from the raffle's count.
 */
export function recentWinners<W extends Winner>(list: W[], winners: bigint | string | number, count = 5): W[] {
    const total = Number(winners);
    if (!Number.isFinite(total) || total <= 0) return [];

    const bySlot = new Map(list.map((winner) => [winner.index, winner]));
    const recent: W[] = [];
    for (let n = total; n > 0 && n > total - Math.min(count, WINNER_SLOTS); n--) {
        const winner = bySlot.get(String(n % WINNER_SLOTS));
        if (winner) recent.push(winner);
    }

    return recent;
}

/** What the chain says about one ticket: `amount` is the uamount won, "0" when it lost. */
export interface TicketCheck {
    hasWon: boolean;
    amount: string;
}

/** Looks up the draw at `height`; `undefined` until that block is processed. */
export type TicketChecker = (height: number) => Promise<TicketCheck | undefined>;

export interface TicketResult {
    won: boolean;
    /** uamount of T won, 0 for a lost ticket. */
    amount: BigNumber;
}

/** One join: `tickets` bought in the tx included at `height`, resolved one ticket per block. */
export interface RaffleEntry {
    id: string;
    height: number;
    tickets: number;
    /** In ticket order; `results.length` tickets are resolved. */
    results: TicketResult[];
    /** The result view is showing this entry, so results need no toast. */
    watched: boolean;
}

export function newRaffleEntry(id: string, height: number, tickets: number): RaffleEntry {
    return {id, height, tickets, results: [], watched: true};
}

/** The chain draws ticket i (0-based) of a join in block `height + 2 + i`. */
export function ticketBlock(entry: RaffleEntry, ticket = entry.results.length): number {
    return entry.height + 2 + ticket;
}

export function isEntryResolved(entry: RaffleEntry): boolean {
    return entry.results.length >= entry.tickets;
}

/**
 * Resolves as many of the entry's remaining tickets as the chain has drawn, in order, stopping
 * at the first block not processed yet (the checker answers `undefined`); the next call retries it.
 */
export async function resolveEntry(entry: RaffleEntry, check: TicketChecker): Promise<RaffleEntry> {
    const results = [...entry.results];
    while (results.length < entry.tickets) {
        const result = await check(ticketBlock(entry, results.length));
        if (!result) break;

        results.push({won: result.hasWon, amount: result.hasWon ? new BigNumber(result.amount) : new BigNumber(0)});
    }

    return results.length === entry.results.length ? entry : {...entry, results};
}

export interface EntrySummary {
    won: number;
    lost: number;
    pending: number;
    /** uamount of T won over every resolved ticket. */
    amount: BigNumber;
}

export function entrySummary(entry: RaffleEntry): EntrySummary {
    const won = entry.results.filter((result) => result.won);

    return {
        won: won.length,
        lost: entry.results.length - won.length,
        pending: Math.max(entry.tickets - entry.results.length, 0),
        amount: won.reduce((sum, result) => sum.plus(result.amount), new BigNumber(0)),
    };
}

/** Why `input` tickets can't be bought, or '' when the balance covers them (fees are checked apart). */
export function ticketsProblem(input: string, ticketPrice: BigNumber, balance: BigNumber, ticker: string): string {
    const tickets = new BigNumber(input);
    if (tickets.isNaN() || !tickets.isInteger() || !tickets.gt(0)) return "Buy at least 1 ticket";
    if (tickets.multipliedBy(ticketPrice).gt(balance)) return `Not enough ${ticker} for ${tickets.toFormat()} ${tickets.eq(1) ? "ticket" : "tickets"}`;

    return "";
}
