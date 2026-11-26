import type {ScanDao, ScanDaoList, ScanProposalList} from './dao-types';

export type Query = [string, string][];

/** One GET against the app's `/api/scan/*` route: the HTTP status and the parsed body (null when unreadable). */
export type ScanGetter = (path: string, query?: Query) => Promise<{status: number; body: unknown}>;

/** BZE Scan did not answer (down, or it answered with an error). */
export class ScanUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScanUnavailableError';
    }
}

/** Scan allows up to 20 `source` values per request. */
export const SOURCES_PER_REQUEST = 20;

/** The browser side: the app's own proxy route, which forwards to Scan. */
export const browserScanGetter: ScanGetter = async (path, query = []) => {
    const search = query.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const response = await fetch(`/api/scan/${path}${search ? `?${search}` : ''}`);
    let body: unknown = null;
    try {
        body = await response.json();
    } catch {
        // an unreadable body is an error answer or a proxy page: the status decides
    }
    return {status: response.status, body};
};

export interface DaoListRequest {
    type?: 'static_list' | 'stake';
    /** Name search (min 2 characters, BFE-368). */
    q?: string;
    member?: string;
    sources?: string[];
    cursor?: string | null;
    limit?: number;
}

export interface DaoScanClient {
    listDaos(request: DaoListRequest): Promise<ScanDaoList>;
    /** Open proposals across all DAOs, soonest end first. */
    openProposals(cursor?: string | null, limit?: number): Promise<ScanProposalList>;
    /**
     * Whether Scan runs the filters of BFE-368 (`member`, `source`, `q`, the cross-DAO proposals).
     * A Scan without them ignores the unknown parameters and answers the whole list, so it is
     * probed once: with an invalid `member` address a newer Scan answers 400 where an older one
     * answers 200. A probe that fails for any other reason reads as "not supported".
     */
    filtersSupported(): Promise<boolean>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const asList = <T,>(body: unknown): {items: T[]; next_cursor: string | null; supported: boolean} => {
    if (!isObject(body) || !Array.isArray(body.items)) {
        throw new ScanUnavailableError('BZE Scan answered with an unexpected body');
    }
    return {
        items: body.items as T[],
        next_cursor: typeof body.next_cursor === 'string' && body.next_cursor ? body.next_cursor : null,
        // an answer without the flag comes from a Scan that predates it: x/dao is there
        supported: body.supported !== false,
    };
};

export function createDaoScanClient(get: ScanGetter): DaoScanClient {
    let probe: Promise<boolean> | undefined;

    const read = async (path: string, query: Query) => {
        let answer;
        try {
            answer = await get(path, query);
        } catch (e) {
            throw new ScanUnavailableError(e instanceof Error ? e.message : 'BZE Scan is unreachable');
        }
        if (answer.status !== 200) throw new ScanUnavailableError(`BZE Scan answered HTTP ${answer.status}`);
        return answer.body;
    };

    return {
        async listDaos(request) {
            const query: Query = [];
            if (request.type) query.push(['type', request.type]);
            if (request.q) query.push(['q', request.q]);
            if (request.member) query.push(['member', request.member]);
            for (const source of request.sources ?? []) query.push(['source', source]);
            if (request.cursor) query.push(['cursor', request.cursor]);
            if (request.limit) query.push(['limit', String(request.limit)]);
            return asList<ScanDao>(await read('daos', query)) as ScanDaoList;
        },

        async openProposals(cursor, limit) {
            const query: Query = [['status', 'voting']];
            if (cursor) query.push(['cursor', cursor]);
            if (limit) query.push(['limit', String(limit)]);
            return asList(await read('dao-proposals', query)) as ScanProposalList;
        },

        filtersSupported() {
            probe ??= get('daos', [['member', 'not-an-address'], ['limit', '1']]).then(
                (answer) => answer.status === 400,
                () => false,
            );
            return probe;
        },
    };
}
