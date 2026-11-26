'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {getExplorerBlockURL, getExplorerTxURL, HgCard, Shimmer} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {describeDaoEvent} from '@/lib/dao-history';
import {loadHistoryPage, type DaoViewDeps} from '@/lib/dao-view-loader';
import {formatDateTime} from '@/lib/format';
import {ScanRetry} from './panel';

interface PageProps {
    deps: DaoViewDeps;
    daoId: string;
    daoAddress: string;
    nameOf: (address: string) => string | undefined;
    cursor: string | null;
    first: boolean;
}

/** One page of the history; "Load more" mounts the next page below it. */
const HistoryPageView = ({deps, daoId, daoAddress, nameOf, cursor, first}: PageProps) => {
    const [retry, setRetry] = useState(0);
    const [more, setMore] = useState(false);
    const page = useAsync(`${daoId}:${cursor ?? 'first'}:${retry}`, () => loadHistoryPage(deps, daoId, cursor));

    if (page.loading) return <Shimmer h="80px" borderRadius="16px" aria-hidden />;
    if (page.error || !page.data) return <ScanRetry what="The history" onRetry={() => setRetry((n) => n + 1)} />;

    const {items, next} = page.data;
    return (
        <>
            {first && items.length === 0 && (
                <chakra.p m="0" color="fg.muted" data-testid="history-empty">Nothing has been recorded for this DAO yet.</chakra.p>
            )}
            {items.map((event) => {
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
            {next && !more && (
                <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setMore(true)} data-testid="history-more">
                    Load more
                </chakra.button>
            )}
            {next && more && <HistoryPageView deps={deps} daoId={daoId} daoAddress={daoAddress} nameOf={nameOf} cursor={next} first={false} />}
        </>
    );
};

/** What happened to the DAO, newest first, from BZE Scan, each item linking to its transaction. */
export const HistoryTab = (props: Omit<PageProps, 'cursor' | 'first'>) => (
    <Flex direction="column" gap="12px" data-testid="history-tab">
        <HistoryPageView {...props} cursor={null} first />
    </Flex>
);
