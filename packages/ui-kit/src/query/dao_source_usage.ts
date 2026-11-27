// Which DAOs vote with a staking source (`sr/{reward_id}` or `dr/{staking_denom}`), and which of
// their proposals are open. Read from BZE Scan through the app's own `/api/scan/*` proxy (Scan
// sends no CORS headers for the apps). Every failure reads as "no DAO uses it": the notices built
// on this are a courtesy and never block a join, a top-up or an exit.

export interface DaoSourceUsageDao {
    id: string;
    name: string;
}

export interface DaoSourceUsageProposal {
    id: string;
    title: string;
    daoId: string;
    /** ISO time voting ends; null when Scan did not say. */
    votingEnd: string | null;
}

export interface DaoSourceUsage {
    daos: DaoSourceUsageDao[];
    /** The open proposals of those DAOs. */
    openProposals: DaoSourceUsageProposal[];
}

export const EMPTY_DAO_SOURCE_USAGE: DaoSourceUsage = {daos: [], openProposals: []};

type Query = [string, string][];

/** One GET against the app's `/api/scan/*` route: the HTTP status and the parsed body (null when unreadable). */
export type DaoScanGetter = (path: string, query?: Query) => Promise<{status: number; body: unknown}>;

/** The browser side: the app's own proxy route. */
export const browserDaoScanGetter: DaoScanGetter = async (path, query = []) => {
    const search = query.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const response = await fetch(`/api/scan/${path}${search ? `?${search}` : ''}`);
    let body: unknown = null;
    try {
        body = await response.json();
    } catch {
        // an unreadable body is an error answer or a proxy page: the status decides
    }
    return {status: response.status, body};
}

export interface DaoSourceUsageReader {
    read(source: string): Promise<DaoSourceUsage>;
}

export interface DaoSourceUsageReaderOptions {
    get?: DaoScanGetter;
    /** How long an answer is kept, in ms (60 s by default). */
    ttlMs?: number;
    now?: () => number;
}

const PAGE_LIMIT = '100';
const MAX_PROPOSAL_PAGES = 5;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

interface ScanList {
    items: Record<string, unknown>[];
    nextCursor: string | null;
    supported: boolean;
}

const asList = (body: unknown): ScanList | null => {
    if (!isObject(body) || !Array.isArray(body.items)) return null;
    return {
        items: body.items.filter(isObject),
        nextCursor: typeof body.next_cursor === 'string' && body.next_cursor ? body.next_cursor : null,
        supported: body.supported !== false,
    };
}

const idOf = (v: unknown): string | null => (typeof v === 'number' || typeof v === 'string') && String(v) !== '' ? String(v) : null;

/**
 * The reader of the DAO usage of a source. Answers are kept for a minute per source; a failed
 * read is not kept, so the next dialog asks again.
 */
export function createDaoSourceUsageReader(options: DaoSourceUsageReaderOptions = {}): DaoSourceUsageReader {
    const get = options.get ?? browserDaoScanGetter;
    const ttlMs = options.ttlMs ?? 60_000;
    const now = options.now ?? Date.now;
    const cache = new Map<string, {at: number; usage: Promise<DaoSourceUsage>}>();
    let probe: Promise<boolean | undefined> | undefined;

    // A Scan without the `source` filter ignores it and answers every DAO, which must not read as
    // "these DAOs use the source". With an invalid `member` a Scan that has the filters answers
    // 400 where an older one answers 200. undefined = the probe itself failed (asked again).
    const filtersSupported = (): Promise<boolean | undefined> => {
        if (!probe) {
            const attempt = get('daos', [['member', 'not-an-address'], ['limit', '1']]).then(
                (answer) => (answer.status === 400 ? true : answer.status === 200 ? false : undefined),
                () => undefined,
            );
            probe = attempt;
            void attempt.then((verdict) => {
                if (verdict === undefined && probe === attempt) probe = undefined;
            });
        }
        return probe;
    };

    // Throws on anything but a clean answer.
    const load = async (source: string): Promise<DaoSourceUsage> => {
        const supported = await filtersSupported();
        // the probe itself failed: not a verdict, so this read fails and is not kept
        if (supported === undefined) throw new Error('BZE Scan could not be probed for the DAO filters');
        if (!supported) return EMPTY_DAO_SOURCE_USAGE;

        const daosAnswer = await get('daos', [['source', source], ['limit', PAGE_LIMIT]]);
        const daoList = daosAnswer.status === 200 ? asList(daosAnswer.body) : null;
        if (!daoList) throw new Error(`BZE Scan answered HTTP ${daosAnswer.status}`);
        if (!daoList.supported) return EMPTY_DAO_SOURCE_USAGE;

        const daos: DaoSourceUsageDao[] = [];
        for (const item of daoList.items) {
            const id = idOf(item.id);
            if (id) daos.push({id, name: typeof item.name === 'string' && item.name ? item.name : `DAO #${id}`});
        }
        if (daos.length === 0) return EMPTY_DAO_SOURCE_USAGE;

        const ids = new Set(daos.map((d) => d.id));
        const openProposals: DaoSourceUsageProposal[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < MAX_PROPOSAL_PAGES; page++) {
            const query: Query = [['status', 'voting'], ['limit', PAGE_LIMIT]];
            if (cursor) query.push(['cursor', cursor]);
            const answer = await get('dao-proposals', query);
            const list = answer.status === 200 ? asList(answer.body) : null;
            if (!list) throw new Error(`BZE Scan answered HTTP ${answer.status}`);
            if (!list.supported) return {daos, openProposals: []};

            for (const item of list.items) {
                const id = idOf(item.id);
                const dao = isObject(item.dao) ? item.dao : undefined;
                const daoId = idOf(item.dao_id) ?? idOf(dao?.id);
                if (!id || !daoId || !ids.has(daoId)) continue;
                openProposals.push({
                    id,
                    title: typeof item.title === 'string' ? item.title : '',
                    daoId,
                    votingEnd: typeof item.voting_end === 'string' ? item.voting_end : null,
                });
            }
            cursor = list.nextCursor;
            if (!cursor) break;
        }

        return {daos, openProposals};
    };

    return {
        read(source) {
            const hit = cache.get(source);
            if (hit && now() - hit.at < ttlMs) return hit.usage;

            const attempt = load(source).catch((): DaoSourceUsage => {
                if (cache.get(source)?.usage === attempt) cache.delete(source);
                return EMPTY_DAO_SOURCE_USAGE;
            });
            cache.set(source, {at: now(), usage: attempt});
            return attempt;
        },
    };
}

/** The reader the apps share. */
export const defaultDaoSourceUsageReader: DaoSourceUsageReader = createDaoSourceUsageReader();
