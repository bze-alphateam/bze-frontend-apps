import {ScanUnavailableError, type ScanGetter} from './dao-scan';
import type {ScanDaoDetail, ScanDaoEventList, ScanVoterBallotList} from './dao-types';

/** The reads of the DAO page that BZE Scan answers: creation info, history, a wallet's votes. */
export interface DaoPageScan {
    /** The DAO as Scan indexed it; null when Scan does not know it (yet). */
    daoDetail(id: string): Promise<ScanDaoDetail | null>;
    /** A page of the DAO's events, newest first: numbered (`page`, the answer has `total`) or by cursor, never both. */
    history(id: string, at?: {page?: number; cursor?: string | null}, limit?: number): Promise<ScanDaoEventList>;
    votesByVoter(voter: string, cursor?: string | null, limit?: number): Promise<ScanVoterBallotList>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function createDaoPageScan(get: ScanGetter): DaoPageScan {
    const read = async (path: string, query: [string, string][]): Promise<{status: number; body: unknown}> => {
        let answer;
        try {
            answer = await get(path, query);
        } catch (e) {
            throw new ScanUnavailableError(e instanceof Error ? e.message : 'BZE Scan is unreachable');
        }
        return answer;
    };

    const ok = async (path: string, query: [string, string][]): Promise<Record<string, unknown>> => {
        const answer = await read(path, query);
        if (answer.status !== 200 || !isObject(answer.body)) throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
        return answer.body;
    };

    const paging = (cursor?: string | null, limit?: number): [string, string][] => {
        const query: [string, string][] = [];
        if (cursor) query.push(['cursor', cursor]);
        if (limit) query.push(['limit', String(limit)]);
        return query;
    };

    const list = <T,>(body: Record<string, unknown>): {items: T[]; next_cursor: string | null; supported: boolean} => {
        if (!Array.isArray(body.items)) throw new ScanUnavailableError('BZE Scan answered with an unexpected body');
        return {
            items: body.items as T[],
            next_cursor: typeof body.next_cursor === 'string' && body.next_cursor ? body.next_cursor : null,
            supported: body.supported !== false,
        };
    };

    return {
        async daoDetail(id) {
            const answer = await read(`daos/${encodeURIComponent(id)}`, []);
            if (answer.status === 404) return null;
            if (answer.status !== 200 || !isObject(answer.body)) throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
            return answer.body as unknown as ScanDaoDetail;
        },

        async history(id, at = {}, limit) {
            const query: [string, string][] = at.page ? [['page', String(at.page)], ...paging(null, limit)] : paging(at.cursor, limit);
            const body = await ok(`daos/${encodeURIComponent(id)}/history`, query);
            const {items, next_cursor} = list<ScanDaoEventList['items'][number]>(body);
            const total = typeof body.total === 'number' && Number.isInteger(body.total) && body.total >= 0 ? body.total : null;
            return {items, next_cursor, total};
        },

        async votesByVoter(voter, cursor, limit) {
            return list<ScanVoterBallotList['items'][number]>(await ok('dao-votes', [['voter', voter], ...paging(cursor, limit)]));
        },
    };
}
