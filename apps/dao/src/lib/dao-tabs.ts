/**
 * The tabs of a DAO's pages and their URLs. Overview, Proposals and History are views of `/dao/<id>` kept in
 * `?tab=` (Overview has none), so a link can open any of them; the Admin console is its own route.
 */
export type DaoPageTab = 'overview' | 'proposals' | 'history';

/** Every tab of the DAO shell: the page's own tabs and the Admin console. */
export type DaoTab = DaoPageTab | 'admin';

const PAGE_TABS: readonly DaoPageTab[] = ['overview', 'proposals', 'history'];

/** The `?tab=` value of a DAO page as a tab: anything missing or unknown is the Overview. */
export function parseDaoTab(value: string | null | undefined): DaoPageTab {
    return PAGE_TABS.includes(value as DaoPageTab) ? (value as DaoPageTab) : 'overview';
}

/**
 * The URL of one tab of a DAO: `/dao/<id>` (Overview), `/dao/<id>?tab=proposals`, `/dao/<id>?tab=history`,
 * `/dao/<id>/admin` (the Admin console).
 */
export function daoTabHref(id: string, tab: DaoTab = 'overview'): string {
    const base = `/dao/${encodeURIComponent(id)}`;
    if (tab === 'admin') return `${base}/admin`;
    return tab === 'overview' ? base : `${base}?tab=${tab}`;
}
