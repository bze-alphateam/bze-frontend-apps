import {daoTabHref} from './dao-tabs';
import {parsePageParam} from './pagination';
import {parseProposalFilter, type ProposalFilter} from './proposal-list';

/** The Proposals tab's view as the URL carries it, next to `tab=proposals`. */
export interface ProposalsQuery {
    filter: ProposalFilter;
    /** 1-based; 1 when the URL has none or an unusable one. */
    page: number;
}

/** Reads `?status=` and `?page=`: an unknown status is All, a page that is not a positive integer is 1. */
export function parseProposalsQuery(search: string | URLSearchParams): ProposalsQuery {
    const params = typeof search === 'string' ? new URLSearchParams(search) : search;
    return {filter: parseProposalFilter(params.get('status')), page: parsePageParam(params.get('page'))};
}

/** `/dao/<id>?tab=proposals&status=active&page=2`; All and page 1 are left out. */
export function proposalsHref(daoId: string, query: ProposalsQuery): string {
    const params = new URLSearchParams();
    if (query.filter !== 'all') params.set('status', query.filter);
    if (query.page > 1) params.set('page', String(query.page));
    const extra = params.toString();
    return `${daoTabHref(daoId, 'proposals')}${extra ? `&${extra}` : ''}`;
}

/** The History tab's page in the URL (`?page=`, next to `tab=history`). */
export const parseHistoryPage = (search: string | URLSearchParams): number =>
    parsePageParam((typeof search === 'string' ? new URLSearchParams(search) : search).get('page'));

/** `/dao/<id>?tab=history&page=2`; page 1 is left out. */
export const historyHref = (daoId: string, page: number): string =>
    `${daoTabHref(daoId, 'history')}${page > 1 ? `&page=${page}` : ''}`;
