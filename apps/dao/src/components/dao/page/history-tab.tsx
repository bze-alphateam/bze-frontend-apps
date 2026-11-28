'use client';

import {useEffect} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {getExplorerBlockURL, getExplorerTxURL, HgCard, Shimmer} from '@bze/bze-ui-kit';
import {Pagination, PrevNext} from '@/components/ui/pagination';
import {useHistoryUrl} from '@/hooks/useDaoTabUrl';
import {usePagedList} from '@/hooks/usePagedList';
import {describeDaoEvent} from '@/lib/dao-history';
import {HISTORY_PAGE, loadHistoryPage, type DaoViewDeps, type HistoryPage} from '@/lib/dao-view-loader';
import {formatDateTime} from '@/lib/format';
import {cursorCount} from '@/lib/home-list';
import {clampPage, rangeCount} from '@/lib/pagination';
import {ScanRetry} from './panel';

interface HistoryTabProps {
    deps: DaoViewDeps;
    daoId: string;
    daoAddress: string;
    nameOf: (address: string) => string | undefined;
}

/**
 * What happened to the DAO, newest first, each item linking to its transaction. The list starts right under
 * the tabs (no heading, no source line). Numbered pages while Scan answers totals (`?tab=history&page=2`),
 * Prev / Next with an older Scan; Scan is the only source, so a failure offers a retry.
 */
export const HistoryTab = ({deps, daoId, daoAddress, nameOf}: HistoryTabProps) => {
    const {page, pushPage, replacePage} = useHistoryUrl(daoId);
    const list = usePagedList<HistoryPage>(daoId, page, HISTORY_PAGE, (position) => loadHistoryPage(deps, daoId, position));

    const lastPage = list.pastEnd;
    useEffect(() => {
        if (lastPage !== null) replacePage(lastPage);
    }, [lastPage, replacePage]);

    const loading = list.loading || list.pastEnd !== null;
    const failed = !!list.error;
    const items = list.items;
    const empty = !loading && !failed && items.length === 0;

    const footer = () => {
        if (empty || failed) return null;
        const count = (text: string) => (list.loading ? ' ' : text);
        if (list.mode === 'pages' && list.pages !== null) {
            const shown = clampPage(page, list.pages);
            return (
                <Pagination
                    page={shown}
                    pages={list.pages}
                    onPage={pushPage}
                    busy={list.loading}
                    count={count(rangeCount({page: shown, pageSize: HISTORY_PAGE, rows: items.length, total: list.total ?? 0, one: 'event', many: 'events'}))}
                />
            );
        }
        if (list.mode === 'cursor') {
            return <PrevNext hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.goPrev} onNext={list.goNext} busy={list.loading} count={count(cursorCount(list.page))} />;
        }
        return null;
    };

    return (
        <Flex direction="column" gap="12px" data-testid="history-tab">
            {loading && <Shimmer h="80px" borderRadius="16px" aria-hidden />}
            {!loading && failed && <ScanRetry what="The history" onRetry={list.retry} />}
            {empty && <chakra.p m="0" color="fg.muted" data-testid="history-empty">Nothing has been recorded for this DAO yet.</chakra.p>}
            {!loading && items.map((event) => {
                const described = describeDaoEvent(event, {daoAddress, nameOf});
                const href = event.tx_hash ? getExplorerTxURL(event.tx_hash) : getExplorerBlockURL(event.height);
                return (
                    <HgCard key={`${event.height}-${event.tx_index}-${event.msg_index}-${event.seq}`} data-testid="history-item">
                        <Flex direction="column" gap="4px" p="14px 18px">
                            <chakra.span fontWeight="600">{described.title}</chakra.span>
                            {described.details.map((line) => <chakra.span key={line} fontSize="13px" color="fg.muted" overflowWrap="anywhere">{line}</chakra.span>)}
                            <Flex gap="12px" fontSize="12px" color="hg.text.faint" wrap="wrap">
                                <span>{formatDateTime(event.time)}</span>
                                <chakra.a href={href} target="_blank" rel="noopener noreferrer" color="hg.link" data-testid="history-link">
                                    {event.tx_hash ? 'View transaction' : 'View block'}
                                </chakra.a>
                            </Flex>
                        </Flex>
                    </HgCard>
                );
            })}
            {footer()}
        </Flex>
    );
};
