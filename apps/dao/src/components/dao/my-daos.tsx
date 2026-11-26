'use client';

import {chakra, Flex, SimpleGrid} from '@chakra-ui/react';
import {Notice, PageState, Shimmer} from '@bze/bze-ui-kit';
import {useAsync} from '@/hooks/useAsync';
import {loadMyDaos, type DaoDeps} from '@/lib/dao-loader';
import {DaoListCard} from './dao-card';

/** The connected wallet's DAOs, each with why it is listed. */
export const MyDaos = ({deps, address}: {deps: DaoDeps; address: string}) => {
    const mine = useAsync(address, () => loadMyDaos(deps, address));
    const result = mine.data;

    return (
        <Flex direction="column" gap="16px" as="section" aria-labelledby="my-daos-title" data-testid="my-daos">
            <chakra.h2 id="my-daos-title" m="0" fontSize="22px" fontWeight="700">My DAOs</chakra.h2>

            {mine.loading && (
                <SimpleGrid columns={{base: 1, md: 2, lg: 3}} gap="14px" aria-hidden>
                    {[0, 1].map((i) => <Shimmer key={i} h="120px" borderRadius="16px" />)}
                </SimpleGrid>
            )}

            {!mine.loading && !!mine.error && (
                <PageState kind="error" title="Your DAOs did not load" description="Reload the page to try again." />
            )}

            {result?.adminFailed && (
                <Notice status="warning">The DAOs you administer could not be read from the chain, so this list may be incomplete.</Notice>
            )}
            {result?.onlyAdmin && !result.adminFailed && (
                <Notice status="info">Only the DAOs you administer are listed for now. DAOs you joined or stake in appear once BZE Scan supports it.</Notice>
            )}

            {result && result.rows.length === 0 && (
                <PageState kind="empty" title="No DAOs yet" description="DAOs you administer, are a member of or stake in will show up here." />
            )}

            {result && result.rows.length > 0 && (
                <SimpleGrid columns={{base: 1, md: 2, lg: 3}} gap="14px">
                    {result.rows.map((row) => <DaoListCard key={row.dao.id} dao={row.dao} reasons={row.reasons} />)}
                </SimpleGrid>
            )}
        </Flex>
    );
};
