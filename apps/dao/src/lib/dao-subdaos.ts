import type {Dao, DaoType} from '@bze/bze-ui-kit';
import type {DaoScanClient} from './dao-scan';

/**
 * What the SubDAOs list reads, injected: the chain's DAOs by admin (the rows), and Scan's DAO list filtered by
 * `admin` (the open counts).
 */
export interface SubDaoDeps {
    chain: {
        /** One page of the DAOs an address administers (a self-owned DAO is listed under its own address). */
        getDaosByAdmin(admin: string, pageKey: string | null): Promise<{items: Dao[]; nextKey: string | null}>;
    };
    scan: Pick<DaoScanClient, 'listDaos'>;
}

/** One DAO this DAO administers. */
export interface SubDaoRow {
    id: string;
    name: string;
    type: DaoType;
}

/** Rows shown before "Show all". */
export const SUBDAO_PREVIEW = 5;
const MAX_CHAIN_PAGES = 10;
const SCAN_PAGE = 50;
const MAX_SCAN_PAGES = 10;

/**
 * The DAOs `dao` administers, from the chain (the DAO itself, listed when it is self-owned, is left out).
 * A chain that fails throws. A list longer than the pages read is cut there.
 */
export async function loadSubDaos(deps: SubDaoDeps, dao: Pick<Dao, 'address'>): Promise<SubDaoRow[]> {
    const found: Dao[] = [];
    let key: string | null = null;
    for (let page = 0; page < MAX_CHAIN_PAGES; page++) {
        const result: {items: Dao[]; nextKey: string | null} = await deps.chain.getDaosByAdmin(dao.address, key);
        found.push(...result.items);
        if (!result.nextKey) break;
        key = result.nextKey;
    }
    return found
        .filter((d) => d.address !== dao.address && d.admin === dao.address)
        .map((d) => ({id: d.id, name: d.name, type: d.type}));
}

/**
 * The open proposals of the DAOs `dao` administers, by DAO id, from one Scan list (`admin=<address>`, read by
 * cursor to its end, up to a cap). A DAO missing from the answer has no count. Throws when Scan does not answer.
 */
export async function loadSubDaoCounts(deps: SubDaoDeps, dao: Pick<Dao, 'address'>): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    let cursor: string | null = null;
    for (let page = 0; page < MAX_SCAN_PAGES; page++) {
        const list = await deps.scan.listDaos({admin: dao.address, cursor, limit: SCAN_PAGE});
        for (const item of list.items) {
            const open = item.proposals_open;
            if (typeof open === 'number' && Number.isInteger(open) && open >= 0) counts.set(String(item.id), open);
        }
        if (!list.next_cursor) break;
        cursor = list.next_cursor;
    }
    return counts;
}

/** "3 voting" / "Nothing to vote on"; empty when the count is not known. */
export const subDaoOpenText = (open: number | null): string => (open === null ? '' : open === 0 ? 'Nothing to vote on' : `${open} voting`);
