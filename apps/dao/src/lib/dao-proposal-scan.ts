import {ScanUnavailableError, type Query, type ScanGetter} from './dao-scan';
import type {ScanProposalDetail, ScanProposalPage, ScanVoteList} from './proposal-types';

/** The reads of the proposal pages that BZE Scan answers. */
export interface DaoProposalScan {
    /** A DAO's proposals, newest first, optionally of one status (lower-case chain name). Throws ScanUnavailableError. */
    listForDao(daoId: string, status: string | null, cursor: string | null, limit: number): Promise<ScanProposalPage>;
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

    return {
        async listForDao(daoId, status, cursor, limit) {
            const query: Query = status ? [['status', status], ...paging(cursor, limit)] : paging(cursor, limit);
            const answer = await read(`daos/${encodeURIComponent(daoId)}/proposals`, query);
            if (answer.status !== 200 || !isObject(answer.body) || !Array.isArray(answer.body.items)) {
                throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
            }
            return {items: answer.body.items as ScanProposalPage['items'], next_cursor: cursorOf(answer.body)};
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
