'use client';

import {useEffect, useState} from 'react';
import {Box, Button, chakra, Flex, Input, SimpleGrid} from '@chakra-ui/react';
import {Notice, PageState, SegmentedTabs, Shimmer} from '@bze/bze-ui-kit';
import {useDaoList} from '@/hooks/useDaoList';
import type {DaoDeps} from '@/lib/dao-loader';
import type {DaoKind} from '@/lib/dao-types';
import {DaoListCard} from './dao-card';

const KIND_OPTIONS = [
    {value: '', label: 'All'},
    {value: 'static_list', label: 'Static list'},
    {value: 'stake', label: 'Stake'},
] as const;

const SEARCH_DELAY_MS = 300;

/** The list of every DAO: type filter, name search, "Load more" paging. */
export const AllDaos = ({deps, onUnsupported}: {deps: DaoDeps; onUnsupported: () => void}) => {
    const [kind, setKind] = useState<DaoKind | ''>('');
    const [typed, setTyped] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setSearch(typed), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [typed]);

    const list = useDaoList(deps, {kind, search});

    useEffect(() => {
        if (list.unsupported) onUnsupported();
    }, [list.unsupported, onUnsupported]);

    if (list.unsupported) return null;

    return (
        <Flex direction="column" gap="16px" as="section" aria-labelledby="all-daos-title">
            <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
                <chakra.h2 id="all-daos-title" m="0" fontSize="22px" fontWeight="700">All DAOs</chakra.h2>
                <Flex gap="12px" align="center" wrap="wrap">
                    <SegmentedTabs
                        aria-label="DAO type"
                        options={KIND_OPTIONS.map((o) => ({value: o.value, label: o.label}))}
                        value={kind}
                        onChange={(value) => setKind(value as DaoKind | '')}
                    />
                    <Input
                        aria-label="Search DAOs by name"
                        placeholder="Search by name"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        maxW="240px"
                        size="sm"
                    />
                </Flex>
            </Flex>

            {list.source === 'chain' && (
                <Notice status="warning" title="BZE Scan is not answering">
                    The list is read from the chain: it has no open-proposal counts and the filter applies to each page as it loads.
                </Notice>
            )}

            {list.loading && (
                <SimpleGrid columns={{base: 1, md: 2, lg: 3}} gap="14px" aria-hidden>
                    {[0, 1, 2].map((i) => <Shimmer key={i} h="120px" borderRadius="16px" />)}
                </SimpleGrid>
            )}

            {!list.loading && !!list.error && (
                <PageState kind="error" title="The DAOs did not load" description="Reload the page to try again." />
            )}

            {!list.loading && !list.error && list.items.length === 0 && (
                <PageState
                    kind="empty"
                    title={search.trim() || kind ? 'No DAO matches' : 'No DAOs yet'}
                    description={search.trim() || kind ? 'Try another name or type.' : 'DAOs created on BeeZee are listed here.'}
                />
            )}

            {list.items.length > 0 && (
                <SimpleGrid columns={{base: 1, md: 2, lg: 3}} gap="14px">
                    {list.items.map((dao) => <DaoListCard key={dao.id} dao={dao} />)}
                </SimpleGrid>
            )}

            {list.loadMoreFailed && <Notice status="danger">The next page did not load.</Notice>}
            {list.hasMore && !list.loading && (
                <Box textAlign="center">
                    <Button variant="outline" onClick={list.loadMore} loading={list.loadingMore}>Load more</Button>
                </Box>
            )}
        </Flex>
    );
};
