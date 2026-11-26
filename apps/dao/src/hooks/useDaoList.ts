import {useCallback, useState} from 'react';
import {loadDaoPage, type DaoDeps, type DaoFilter, type DaoListResult} from '@/lib/dao-loader';
import type {DaoCard} from '@/lib/dao-types';
import {useAsync} from './useAsync';

interface Extra {
    key: string;
    items: DaoCard[];
    next: string | null;
    failed: boolean;
}

/** The All DAOs list for a filter: the first page, and the pages "Load more" appends. */
export function useDaoList(deps: DaoDeps, filter: DaoFilter) {
    const key = `${filter.kind}|${filter.search.trim()}`;
    const first = useAsync<DaoListResult>(key, () => loadDaoPage(deps, filter, null));
    const [extra, setExtra] = useState<Extra | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const firstOk = first.data?.state === 'ok' ? first.data : undefined;
    const more = extra?.key === key ? extra : null;
    const items = [...(firstOk?.items ?? []), ...(more?.items ?? [])];
    const next = more ? more.next : firstOk?.next ?? null;
    const source = firstOk?.source;

    const loadMore = useCallback(async () => {
        if (!next || !source) return;
        setLoadingMore(true);
        try {
            const page = await loadDaoPage(deps, filter, next, source);
            if (page.state !== 'ok') return;
            setExtra((prev) => ({
                key,
                items: [...(prev?.key === key ? prev.items : []), ...page.items],
                next: page.next,
                failed: false,
            }));
        } catch {
            setExtra((prev) => ({key, items: prev?.key === key ? prev.items : [], next, failed: true}));
        } finally {
            setLoadingMore(false);
        }
    }, [deps, filter, key, next, source]);

    return {
        loading: first.loading,
        error: first.error,
        unsupported: first.data?.state === 'unsupported',
        items,
        source,
        hasMore: next !== null,
        loadMore,
        loadingMore,
        loadMoreFailed: more?.failed ?? false,
    };
}
