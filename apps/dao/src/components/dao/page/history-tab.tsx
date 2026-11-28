'use client';

import {useEffect} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import type {IconType} from 'react-icons';
import {LuCircleDot, LuCoins, LuCrown, LuFlag, LuPencil, LuPlus, LuSlidersHorizontal, LuSparkles, LuUsers, LuX} from 'react-icons/lu';
import {getExplorerBlockURL, getExplorerTxURL, Shimmer} from '@bze/bze-ui-kit';
import {Pagination, PrevNext} from '@/components/ui/pagination';
import {useHistoryUrl} from '@/hooks/useDaoTabUrl';
import {useNow} from '@/hooks/useNow';
import {usePagedList} from '@/hooks/usePagedList';
import {describeDaoEvent, historyTime, type EventIcon} from '@/lib/dao-history';
import {HISTORY_PAGE, loadHistoryPage, type DaoViewDeps, type HistoryPage} from '@/lib/dao-view-loader';
import {formatDateTime} from '@/lib/format';
import {clampPage, cursorCount, rangeCount} from '@/lib/pagination';
import {Card, OutLink} from './bits';
import {ScanRetry} from './panel';

interface HistoryTabProps {
    deps: DaoViewDeps;
    daoId: string;
    daoAddress: string;
    nameOf: (address: string) => string | undefined;
    /** Who created the DAO (Scan's detail), for the created event; null or undefined when unknown. */
    creator?: string | null;
}

const ICONS: Record<EventIcon, IconType> = {
    execute: LuSparkles,
    rules: LuSlidersHorizontal,
    voters: LuCoins,
    admin: LuCrown,
    nominate: LuFlag,
    withdraw: LuX,
    metadata: LuPencil,
    created: LuPlus,
    members: LuUsers,
    other: LuCircleDot,
};

/**
 * What happened to the DAO, newest first, in one card: time, icon, what happened, and the transaction. The
 * list starts right under the tabs (no heading, no source line). Numbered pages while Scan answers totals (`?tab=history&page=2`),
 * Prev / Next with an older Scan; Scan is the only source, so a failure offers a retry.
 */
export const HistoryTab = ({deps, daoId, daoAddress, nameOf, creator}: HistoryTabProps) => {
    const nowMs = useNow();
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
        <Card gap="8px" testId="history-tab">
            {loading && <Shimmer h="80px" borderRadius="12px" aria-hidden />}
            {!loading && failed && <ScanRetry what="The history" onRetry={list.retry} />}
            {empty && <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="history-empty">Nothing has been recorded for this DAO yet.</chakra.p>}
            {!loading && items.length > 0 && (
                <chakra.ol m="0" p="0" listStyleType="none">
                    {items.map((event, i) => {
                        const described = describeDaoEvent(event, {daoAddress, nameOf, creator});
                        const href = event.tx_hash ? getExplorerTxURL(event.tx_hash) : getExplorerBlockURL(event.height);
                        const when = historyTime(event.time, nowMs);
                        const Icon = ICONS[described.icon];
                        return (
                            <chakra.li
                                key={`${event.height}-${event.tx_index}-${event.msg_index}-${event.seq}`}
                                display="grid"
                                gridTemplateColumns={{base: '36px minmax(0, 1fr)', md: '120px 40px minmax(0, 1fr) auto'}}
                                gap={{base: '4px 12px', md: '14px'}}
                                alignItems="flex-start"
                                pt={i === 0 ? '6px' : '16px'}
                                pb="16px"
                                borderTopWidth={i === 0 ? '0' : '1px'}
                                borderColor="hg.divider"
                                data-testid="history-item"
                                data-icon={described.icon}
                            >
                                <chakra.span display={{base: 'none', md: 'block'}} fontSize="13px" color="hg.text.faint" pt="9px" title={formatDateTime(event.time)} data-testid="history-time">{when}</chakra.span>
                                <chakra.span boxSize="36px" borderRadius="10px" bg="color-mix(in srgb, var(--chakra-colors-hg-accent) 12%, transparent)" color="hg.link" display="inline-flex" alignItems="center" justifyContent="center" aria-hidden>
                                    <Icon size={17} />
                                </chakra.span>
                                <Flex direction="column" gap="3px" minW="0">
                                    <chakra.span display={{base: 'block', md: 'none'}} fontSize="12px" color="hg.text.faint">{when}</chakra.span>
                                    <chakra.strong fontSize="15px" overflowWrap="anywhere" data-testid="history-title">{described.title}</chakra.strong>
                                    {described.details.length > 0 && (
                                        <chakra.span fontSize="14px" color="hg.text.secondary" overflowWrap="anywhere" data-testid="history-details">{described.details.join(' · ')}</chakra.span>
                                    )}
                                </Flex>
                                <chakra.span pt={{base: '0', md: '5px'}} gridColumn={{base: '2', md: 'auto'}}>
                                    <OutLink href={href} testId="history-link">{event.tx_hash ? 'Tx' : 'Block'}</OutLink>
                                </chakra.span>
                            </chakra.li>
                        );
                    })}
                </chakra.ol>
            )}
            {footer()}
        </Card>
    );
};
