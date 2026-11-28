import {ScanUnavailableError} from './dao-scan';
import {ScanRefusedError} from './dao-proposal-scan';
import {createPagingMemory, readScanPage, type PagedPage, type PagePosition} from './paged-list';
import type {ProposalDeps} from './proposal-loader';
import {rowFromChain, rowFromScan, type ProposalRow, type ProposalTally} from './proposal-model';
import {isOpenStatus} from './proposal-status';
import {percentDown} from './proposal-tally';
import type {ScanStatusCounts} from './proposal-types';

// The DAO page's Proposals tab: one table with a status filter, numbered pages against BZE Scan.

/** The status filter of the tab, as the URL's `?status=` carries it (All = none). */
export type ProposalFilter = 'all' | 'active' | 'passed' | 'rejected' | 'expired' | 'cancelled';

export const PROPOSAL_FILTERS: {value: ProposalFilter; label: string}[] = [
    {value: 'all', label: 'All'},
    {value: 'active', label: 'Active'},
    {value: 'passed', label: 'Passed'},
    {value: 'rejected', label: 'Rejected'},
    {value: 'expired', label: 'Expired'},
    {value: 'cancelled', label: 'Cancelled'},
];

export const PROPOSALS_PAGE = 20;

/** The chain's page when Scan is down (open proposals are capped by the DAO's rules: one page, as a rule). */
const CHAIN_PAGE_LIMIT = 50;
/** The older Scan's Active list: each status read by cursor, a few pages at most. */
const LEGACY_LIMIT = 50;
const LEGACY_READS = 5;

/** A `?status=` value as a filter: anything missing or unknown is All. */
export function parseProposalFilter(value: string | null | undefined): ProposalFilter {
    return PROPOSAL_FILTERS.some((f) => f.value === value) ? (value as ProposalFilter) : 'all';
}

/**
 * The `status` values Scan is asked for: Active is the alias `active` (voting + execution_failed),
 * Passed is `executed`, All is none.
 */
export function filterStatuses(filter: ProposalFilter): string[] {
    switch (filter) {
        case 'all': return [];
        case 'active': return ['active'];
        case 'passed': return ['executed'];
        default: return [filter];
    }
}

/**
 * The count of each segment from Scan's `status_counts` (the whole DAO, whatever the filter): Active is
 * voting + execution failed, All the sum of every status. Every count is null without `status_counts`
 * (an older Scan, the chain), so the segments show no number.
 */
export function segmentCounts(counts: ScanStatusCounts | null | undefined): Record<ProposalFilter, number | null> {
    if (!counts) return {all: null, active: null, passed: null, rejected: null, expired: null, cancelled: null};
    const n = (status: string) => counts[status] ?? 0;
    return {
        all: Object.values(counts).reduce<number>((sum, c) => sum + (c ?? 0), 0),
        active: n('voting') + n('execution_failed'),
        passed: n('executed'),
        rejected: n('rejected'),
        expired: n('expired'),
        cancelled: n('cancelled'),
    };
}

const byIdDesc = (a: ProposalRow, b: ProposalRow): number => (BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0);
const rank = (row: ProposalRow): number => (row.status === 'VOTING' ? 0 : row.status === 'EXECUTION_FAILED' ? 1 : 2);
const endOf = (row: ProposalRow): number => {
    const at = row.votingEnd ? new Date(row.votingEnd).getTime() : NaN;
    return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
};

/**
 * Scan's order of a numbered page, for the lists the app orders itself (the chain, an older Scan): voting
 * first by the soonest end (so the ones ready to settle, past their end, lead), then failed executions,
 * then the finished ones, both newest first.
 */
export function activeFirst(rows: ProposalRow[]): ProposalRow[] {
    return [...rows].sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
        if (rank(a) === 0) return endOf(a) - endOf(b) || -byIdDesc(a, b);
        return byIdDesc(a, b);
    });
}

/** A row that is still moving (voting, or a failed execution that may be retried): tinted under All. */
export const isActiveRow = (row: Pick<ProposalRow, 'status'>): boolean => isOpenStatus(row.status);

/**
 * Where the indigo rule goes under All: after the last active row, when the page holds the active ones
 * first and at least one finished row after them. Null when there is no such boundary on the page (all
 * active, none active, or a list that is not ordered active first, such as an older Scan's).
 */
export function activeRuleAfter(rows: Pick<ProposalRow, 'status'>[]): number | null {
    const firstFinished = rows.findIndex((r) => !isActiveRow(r));
    if (firstFinished <= 0) return null;
    return rows.slice(firstFinished).some(isActiveRow) ? null : firstFinished - 1;
}

const big = (v: string): bigint => BigInt(v);

/** The yes share of yes and no, rounded down ("93.75%"); "—" before any yes or no vote, or without a tally. */
export function yesShare(tally: ProposalTally | null): string {
    if (!tally) return '—';
    const decided = big(tally.yes) + big(tally.no);
    return decided > BigInt(0) ? percentDown(tally.yes, decided.toString()) : '—';
}

/** The turnout against the pinned denominator, rounded down; "—" without a tally. */
export function turnoutShare(tally: ProposalTally | null): string {
    if (!tally) return '—';
    return percentDown((big(tally.yes) + big(tally.no) + big(tally.abstain)).toString(), tally.denominator);
}

// ---- the loader ----

/** One page of the tab, with the counts of each status when Scan gave them. */
export type ProposalPage = PagedPage<ProposalRow, 'scan' | 'chain'> & {counts: ScanStatusCounts | null};

/** Scan is down and this filter cannot be listed from the chain (only the live, active proposals can). */
export type ProposalListResult = ProposalPage | {state: 'needs-scan'};

// Scan clients whose proposals answered a `page` request without a total (a Scan before numbered pages).
const proposalPaging = createPagingMemory();

const rowsOf = (items: Parameters<typeof rowFromScan>[0][]): ProposalRow[] =>
    items.flatMap((item) => {
        const row = rowFromScan(item);
        return row ? [row] : [];
    });

/** An older Scan refuses `status=active`: the two statuses are read one by one and merged. */
async function legacyActive(deps: ProposalDeps, daoId: string): Promise<ProposalPage> {
    const read = async (status: string): Promise<ProposalRow[]> => {
        const rows: ProposalRow[] = [];
        let cursor: string | null = null;
        for (let i = 0; i < LEGACY_READS; i++) {
            const page = await deps.scan.listForDao(daoId, {statuses: [status], cursor, limit: LEGACY_LIMIT});
            rows.push(...rowsOf(page.items));
            if (!page.next_cursor) break;
            cursor = page.next_cursor;
        }
        return rows;
    };
    const [voting, failed] = await Promise.all([read('voting'), read('execution_failed')]);
    const items = activeFirst([...voting, ...failed]);
    return {state: 'ok', items, returned: items.length, source: 'scan', mode: 'cursor', total: null, next: null, counts: null};
}

/** Scan down: the chain's live proposals (voting + execution failed), paged by key. */
async function chainActive(deps: ProposalDeps, daoId: string, key: string | null): Promise<ProposalPage> {
    const page = await deps.chain.getDaoProposals(daoId, ['VOTING', 'EXECUTION_FAILED'], {key: key ?? undefined, limit: CHAIN_PAGE_LIMIT, reverse: true});
    const items = activeFirst(page.items.map(rowFromChain));
    return {state: 'ok', items, returned: page.items.length, source: 'chain', mode: 'cursor', total: null, next: page.nextKey, counts: null};
}

/**
 * One page of a DAO's proposals for a filter. Scan by page number (active first, with `total` and
 * `status_counts`); an older Scan, which ignores `page` and answers without a total, by cursor (newest
 * first, remembered) and, for Active, which it refuses (400), the two statuses merged. With Scan down
 * only Active can be listed, from the chain's live proposals (Prev / Next by key); the other filters are
 * `needs-scan`. A later page never switches source.
 */
export async function loadProposalPage(deps: ProposalDeps, daoId: string, filter: ProposalFilter, position: PagePosition<'scan' | 'chain'>): Promise<ProposalListResult> {
    const cursor = position.cursor ?? null;
    if (position.source === 'chain') return chainActive(deps, daoId, cursor);

    try {
        try {
            const read = await readScanPage(proposalPaging, deps.scan, position, (at) =>
                deps.scan.listForDao(daoId, {statuses: filterStatuses(filter), ...at, limit: PROPOSALS_PAGE}));
            return {
                state: 'ok',
                items: rowsOf(read.answer.items),
                returned: read.answer.items.length,
                source: 'scan',
                mode: read.mode,
                total: read.total,
                next: read.next,
                counts: read.mode === 'pages' ? read.answer.status_counts ?? null : null,
            };
        } catch (e) {
            if (e instanceof ScanRefusedError && filter === 'active' && !cursor) return await legacyActive(deps, daoId);
            throw e;
        }
    } catch (e) {
        if (!(e instanceof ScanUnavailableError) || cursor) throw e;
        if (filter !== 'active') return {state: 'needs-scan'};
        return chainActive(deps, daoId, null);
    }
}
