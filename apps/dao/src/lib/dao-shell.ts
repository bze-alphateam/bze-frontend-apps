import type {Dao, DaoProposal} from '@bze/bze-ui-kit';
import type {ScanDaoDetail} from './dao-types';
import type {Part} from './dao-view-loader';
import {formatDay, isoFromUnix} from './format';

/** The Proposals tab's pill: "1/9", or "1" when the total is not known. */
export interface ProposalCounter {
    open: number;
    /** Every proposal the DAO ever had; null when Scan does not say (an older Scan, or Scan down). */
    total: number | null;
    /** The pill's text. */
    label: string;
    /** The pill's tooltip and accessible name. */
    title: string;
}

const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

/**
 * The Proposals tab's counter. The open count is Scan's `proposals_open`, else the chain's open
 * proposals; the total is Scan's `proposals_total` only (the chain forgets cleaned-up proposals).
 * Null when the open count is not known at all: then there is no pill.
 */
export function proposalCounter(detail: Pick<ScanDaoDetail, 'proposals_open' | 'proposals_total'> | null | undefined, chainOpen: Part<DaoProposal[]>): ProposalCounter | null {
    const open = count(detail?.proposals_open) ?? (chainOpen.ok ? chainOpen.value.length : null);
    if (open === null) return null;
    const total = count(detail?.proposals_total);
    const voting = `${open} voting now`;
    if (total === null) return {open, total, label: String(open), title: voting};
    return {open, total, label: `${open}/${total}`, title: `${voting}, ${total} ${total === 1 ? 'proposal' : 'proposals'} in all`};
}

/** "Created on 2 Nov 2026" from the chain's `created_at`, else Scan's `created_time`; null when neither is known. */
export function createdOnLine(dao: Pick<Dao, 'created_at'>, detail: Pick<ScanDaoDetail, 'created_time'> | null | undefined): string | null {
    const day = formatDay(isoFromUnix(dao.created_at)) || formatDay(detail?.created_time);
    return day ? `Created on ${day}` : null;
}

/** A description longer than this many characters is taken as overflowing 3 lines. */
const DESCRIPTION_CLAMP_CHARS = 240;
const DESCRIPTION_CLAMP_LINES = 3;

/**
 * Whether a description likely does not fit in 3 lines: more than 3 lines of text, or more than 240 characters.
 * The fallback of "View all" where the browser cannot measure the rendered text.
 */
export function descriptionOverflows(text: string): boolean {
    return text.split('\n').length > DESCRIPTION_CLAMP_LINES || text.length > DESCRIPTION_CLAMP_CHARS;
}

/** An address as the DAO page's boards write it: "bze1h0n…ey7q" (7 + 4); a short one stays whole. */
export function boardAddress(address: string): string {
    return address.length > 14 ? `${address.slice(0, 7)}…${address.slice(-4)}` : address;
}
