import type {Dao, DaoType} from '@bze/bze-ui-kit';
import type {ScanDaoDetail} from './dao-types';

/** What the SubDAOs list reads: the chain's DAOs by admin, and Scan's DAO detail for the open counts. Injected. */
export interface SubDaoDeps {
    chain: {
        /** One page of the DAOs an address administers (a self-owned DAO is listed under its own address). */
        getDaosByAdmin(admin: string, pageKey: string | null): Promise<{items: Dao[]; nextKey: string | null}>;
    };
    scan: {
        /** The DAO as Scan indexed it; null when Scan does not know it. Throws when Scan does not answer. */
        daoDetail(id: string): Promise<ScanDaoDetail | null>;
    };
}

/** One DAO this DAO administers. */
export interface SubDaoRow {
    id: string;
    name: string;
    type: DaoType;
    /** Its open proposals; null when Scan cannot tell (down, older, or the DAO is not indexed yet). */
    open: number | null;
}

/** Rows shown before "Show all". */
export const SUBDAO_PREVIEW = 5;
const MAX_PAGES = 10;
/** The sub-DAOs whose open count is asked from Scan (one request each). */
const MAX_COUNTS = 50;

const openOf = (detail: ScanDaoDetail | null): number | null => {
    const v = detail?.proposals_open;
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
};

/**
 * The DAOs `dao` administers, from the chain (the DAO itself, listed when it is self-owned, is left out),
 * with each one's open proposals from Scan. A Scan that fails leaves the counts out, never the list;
 * a chain that fails throws. A list longer than the pages read is cut there.
 */
export async function loadSubDaos(deps: SubDaoDeps, dao: Pick<Dao, 'address'>): Promise<SubDaoRow[]> {
    const found: Dao[] = [];
    let key: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
        const result: {items: Dao[]; nextKey: string | null} = await deps.chain.getDaosByAdmin(dao.address, key);
        found.push(...result.items);
        if (!result.nextKey) break;
        key = result.nextKey;
    }
    const subs = found.filter((d) => d.address !== dao.address && d.admin === dao.address);
    return Promise.all(subs.map(async (sub, i): Promise<SubDaoRow> => ({
        id: sub.id,
        name: sub.name,
        type: sub.type,
        open: i < MAX_COUNTS ? await deps.scan.daoDetail(sub.id).then(openOf, () => null) : null,
    })));
}

/** "3 voting" / "Nothing to vote on"; empty when the count is not known. */
export const subDaoOpenText = (open: number | null): string => (open === null ? '' : open === 0 ? 'Nothing to vote on' : `${open} voting`);
