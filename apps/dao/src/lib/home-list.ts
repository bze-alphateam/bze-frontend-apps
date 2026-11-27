import type {DaoKind, Reason} from './dao-types';

/** "A member list" / "Stakers": who decides in a DAO, as the Governed by column says it. */
export const governedBy = (kind: DaoKind): string => (kind === 'stake' ? 'Stakers' : 'A member list');

/** The same on a phone card, as a sentence. */
export const governedByLine = (kind: DaoKind): string => (kind === 'stake' ? 'Governed by stakers' : 'Governed by a member list');

/** The type's name in the filter. */
export const kindLabel = (kind: DaoKind): string => (kind === 'stake' ? 'Stakers' : 'Member list');

/** Nominated is the one role that is still to be accepted: amber; the others are indigo. */
export const roleTone = (reason: Reason): 'amber' | 'indigo' => (reason === 'Nominated' ? 'amber' : 'indigo');

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * The count line under a numbered list: "1–20 of 24 DAOs", or "1 DAO" / "4 DAOs" when it all
 * fits on one page. The range comes from the rows the page really holds.
 */
export function numberedCount(args: {page: number; pageSize: number; rows: number; total: number}): string {
    const {page, pageSize, rows, total} = args;
    if (total <= pageSize) return plural(total, 'DAO', 'DAOs');
    const from = (page - 1) * pageSize + 1;
    return `${from}–${from + Math.max(rows, 1) - 1} of ${total.toLocaleString('en-US')} DAOs`;
}

/** The count line of a list without a total (an older Scan, the chain). */
export const cursorCount = (page: number): string => `Page ${page}`;

/** The count line of My DAOs. */
export const mineCount = (n: number): string => (n === 1 ? '1 of your DAOs' : `${n.toLocaleString('en-US')} of your DAOs`);
