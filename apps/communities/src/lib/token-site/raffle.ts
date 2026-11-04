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
    /** When the page learned the result (ms); drives the short win/loss flash. */
    at?: number;
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
    /** When the join was made (ms). */
    createdAt: number;
    /** When its last ticket was drawn (ms); the results stay on the page for an hour after. */
    resolvedAt?: number;
}

export function newRaffleEntry(id: string, height: number, tickets: number, createdAt = Date.now()): RaffleEntry {
    return {id, height, tickets, results: [], watched: true, createdAt};
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

/** How long a fully drawn join stays on the page. */
export const RAFFLE_RESULTS_TTL_MS = 60 * 60 * 1000;
/** A join still drawing after this long is given up on (its blocks are long gone). */
export const RAFFLE_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Whether an entry is past its time on the page: an hour after its last draw, a day after the join. */
export function isEntryExpired(entry: RaffleEntry, now: number): boolean {
    if (entry.resolvedAt !== undefined) return now - entry.resolvedAt >= RAFFLE_RESULTS_TTL_MS;

    return now - entry.createdAt >= RAFFLE_PENDING_MAX_AGE_MS;
}

interface StoredEntry {
    id: string;
    height: number;
    tickets: number;
    results: { won: boolean; amount: string; at?: number }[];
    createdAt: number;
    resolvedAt?: number;
}

/** The entries as kept in browser storage; `watched` belongs to the open dialog, so it is left out. */
export function serializeEntries(entries: RaffleEntry[]): string {
    const stored: StoredEntry[] = entries.map((entry) => ({
        id: entry.id,
        height: entry.height,
        tickets: entry.tickets,
        results: entry.results.map((result) => ({won: result.won, amount: result.amount.toFixed(0), at: result.at})),
        createdAt: entry.createdAt,
        resolvedAt: entry.resolvedAt,
    }));

    return JSON.stringify(stored);
}

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Entries read back from storage, unwatched; anything malformed is dropped rather than trusted. */
export function parseEntries(raw: string | null): RaffleEntry[] {
    if (!raw) return [];

    let stored: unknown;
    try {
        stored = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(stored)) return [];

    return stored.flatMap((item: Partial<StoredEntry>): RaffleEntry[] => {
        if (!item || typeof item.id !== "string" || !isCount(item.height) || !isCount(item.tickets) || item.tickets === 0
            || !isCount(item.createdAt) || !Array.isArray(item.results)) return [];

        const results = item.results.slice(0, item.tickets).map((result) => ({
            won: Boolean(result?.won),
            amount: result?.won ? new BigNumber(result.amount ?? 0) : new BigNumber(0),
            at: typeof result?.at === "number" ? result.at : undefined,
        }));
        if (results.some((result) => !result.amount.isFinite())) return [];

        return [{
            id: item.id,
            height: item.height,
            tickets: item.tickets,
            results,
            watched: false,
            createdAt: item.createdAt,
            resolvedAt: typeof item.resolvedAt === "number" ? item.resolvedAt : undefined,
        }];
    });
}

/** One ticket still to be drawn: `blocksAway` 0 means its block is the one being made now. */
export interface UpcomingTicket {
    /** 1-based over every entry shown, in join order. */
    number: number;
    blocksAway: number;
}

export interface DrawnTicket {
    number: number;
    result: TicketResult;
}

export interface TicketStrip {
    total: number;
    drawn: number;
    /** The next `size` tickets to be drawn, soonest first. */
    upcoming: UpcomingTicket[];
    /** Undrawn tickets beyond `upcoming`. */
    more: number;
    /** Drawn tickets, newest first. */
    results: DrawnTicket[];
    won: number;
    /** uamount of T won over every drawn ticket. */
    amount: BigNumber;
}

/**
 * The raffle slot's view of the wallet's tickets at chain height `height` (the last block the feed
 * reported): the ticket drawn in block `height + 1` is the one drawing now. The entries prove a
 * height of their own (a join's block, the block of its last drawn ticket), which carries the
 * countdown when the feed is down or hasn't reported a block yet.
 */
export function ticketStrip(entries: RaffleEntry[], height?: number, size = 5): TicketStrip {
    const pending: { number: number; block: number }[] = [];
    const results: DrawnTicket[] = [];
    let number = 0;
    let current = height ?? 0;
    for (const entry of entries) {
        current = Math.max(current, entry.height, entry.results.length > 0 ? ticketBlock(entry, entry.results.length - 1) : 0);
        for (let ticket = 0; ticket < entry.tickets; ticket++) {
            number++;
            const result = entry.results[ticket];
            if (result) results.push({number, result});
            else pending.push({number, block: ticketBlock(entry, ticket)});
        }
    }
    pending.sort((a, b) => a.block - b.block || a.number - b.number);
    results.sort((a, b) => (b.result.at ?? 0) - (a.result.at ?? 0) || b.number - a.number);

    const won = results.filter((ticket) => ticket.result.won);

    return {
        total: number,
        drawn: results.length,
        upcoming: pending.slice(0, size).map((ticket) => ({number: ticket.number, blocksAway: Math.max(ticket.block - current - 1, 0)})),
        more: Math.max(pending.length - size, 0),
        results,
        won: won.length,
        amount: won.reduce((sum, ticket) => sum.plus(ticket.result.amount), new BigNumber(0)),
    };
}

/** Why `input` tickets can't be bought, or '' when the balance covers them (fees are checked apart). */
export function ticketsProblem(input: string, ticketPrice: BigNumber, balance: BigNumber, ticker: string): string {
    const tickets = new BigNumber(input);
    if (tickets.isNaN() || !tickets.isInteger() || !tickets.gt(0)) return "Buy at least 1 ticket";
    if (tickets.multipliedBy(ticketPrice).gt(balance)) return `Not enough ${ticker} for ${tickets.toFormat()} ${tickets.eq(1) ? "ticket" : "tickets"}`;

    return "";
}
