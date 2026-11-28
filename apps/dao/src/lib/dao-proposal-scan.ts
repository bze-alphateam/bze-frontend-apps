import {ScanUnavailableError, type Query, type ScanGetter} from './dao-scan';
import type {ScanProposalDetail, ScanProposalPage, ScanStatusCounts, ScanVoteList} from './proposal-types';

/** Scan refused the request with a 400 (an older Scan that does not know a status, such as the `active` alias). */
export class ScanRefusedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScanRefusedError';
    }
}

/** One request for a DAO's proposals: a numbered page or a cursor, never both. */
export interface ProposalListRequest {
    /** Lower-case chain names, or the alias `active` (voting + execution_failed); none = every status. Repeated in the query. */
    statuses?: string[];
    /** 1-based numbered page: the answer carries `total` and `status_counts`, active first. */
    page?: number;
    cursor?: string | null;
    limit: number;
}

/** The reads of the proposal pages that BZE Scan answers. */
export interface DaoProposalScan {
    /**
     * A DAO's proposals. With `page`: active first, with `total` and `status_counts` (null from an older Scan, which
     * ignores `page`). By cursor: newest first. Throws ScanRefusedError on a 400, ScanUnavailableError otherwise.
     */
    listForDao(daoId: string, request: ProposalListRequest): Promise<ScanProposalPage>;
    /** One proposal as Scan indexed it; null when Scan does not know it. */
    detail(id: string): Promise<ScanProposalDetail | null>;
    /** A proposal's ballots, heaviest first, optionally of one option (yes|no|abstain); null when Scan does not know the proposal. */
    votes(id: string, option: string | null, cursor: string | null, limit: number): Promise<ScanVoteList | null>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function createDaoProposalScan(get: ScanGetter): DaoProposalScan {
    const read = async (path: string, query: Query): Promise<{status: number; body: unknown}> => {
        try {
            return await get(path, query);
        } catch (e) {
            throw new ScanUnavailableError(e instanceof Error ? e.message : 'BZE Scan is unreachable');
        }
    };

    const paging = (cursor: string | null, limit: number): Query => {
        const query: Query = [];
        if (cursor) query.push(['cursor', cursor]);
        query.push(['limit', String(limit)]);
        return query;
    };

    const cursorOf = (body: Record<string, unknown>): string | null =>
        typeof body.next_cursor === 'string' && body.next_cursor ? body.next_cursor : null;

    const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

    const countsOf = (v: unknown): ScanStatusCounts | null => {
        if (!isObject(v)) return null;
        const counts: ScanStatusCounts = {};
        for (const [status, n] of Object.entries(v)) {
            const c = count(n);
            if (c !== null) counts[status] = c;
        }
        return counts;
    };

    return {
        async listForDao(daoId, request) {
            const query: Query = (request.statuses ?? []).map((status): [string, string] => ['status', status]);
            if (request.page) query.push(['page', String(request.page)]);
            else if (request.cursor) query.push(['cursor', request.cursor]);
            query.push(['limit', String(request.limit)]);
            const answer = await read(`daos/${encodeURIComponent(daoId)}/proposals`, query);
            if (answer.status === 400) throw new ScanRefusedError('BZE Scan refused the request (HTTP 400)');
            if (answer.status !== 200 || !isObject(answer.body) || !Array.isArray(answer.body.items)) {
                throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
            }
            return {
                items: answer.body.items as ScanProposalPage['items'],
                next_cursor: cursorOf(answer.body),
                total: count(answer.body.total),
                status_counts: countsOf(answer.body.status_counts),
            };
        },

        async detail(id) {
            const answer = await read(`dao-proposals/${encodeURIComponent(id)}`, []);
            if (answer.status === 404) return null;
            if (answer.status !== 200 || !isObject(answer.body)) throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
            return answer.body as unknown as ScanProposalDetail;
        },

        async votes(id, option, cursor, limit) {
            const query: Query = option ? [['option', option], ...paging(cursor, limit)] : paging(cursor, limit);
            const answer = await read(`dao-proposals/${encodeURIComponent(id)}/votes`, query);
            if (answer.status === 404) return null;
            if (answer.status !== 200 || !isObject(answer.body) || !Array.isArray(answer.body.items)) {
                throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
            }
            return {
                items: answer.body.items as ScanVoteList['items'],
                next_cursor: cursorOf(answer.body),
                weight_denom: (isObject(answer.body.weight_denom) ? answer.body.weight_denom : null) as ScanVoteList['weight_denom'],
            };
        },
    };
}
