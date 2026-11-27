'use client';

import {Button, chakra, Flex} from '@chakra-ui/react';
import {LuTriangleAlert} from 'react-icons/lu';
import {Notice} from '@bze/bze-ui-kit';
import type {MyDaosResult} from '@/lib/dao-loader';

/** Scan is down and the list is the chain's own. */
export const ReducedListNotice = ({onRetry}: {onRetry: () => void}) => (
    <Flex
        role="note"
        gap="12px"
        align="flex-start"
        px="14px"
        py="12px"
        borderRadius="12px"
        bg="hg.warning/8"
        borderWidth="1px"
        borderColor="hg.warning/30"
        data-testid="reduced-list"
    >
        <chakra.span aria-hidden flex="none" mt="2px" color="hg.warning"><LuTriangleAlert size={16} /></chakra.span>
        <Flex direction="column" gap="2px" fontSize="14px" lineHeight="1.5" minW="0" flex="1">
            <chakra.strong color="fg">Reduced list</chakra.strong>
            <chakra.span color="fg.muted">
                BZE Scan isn&apos;t answering, so this list comes straight from the chain: no search, no type filter, no open-proposal counts. My DAOs shows only DAOs you run.
            </chakra.span>
        </Flex>
        <Button variant="outline" size="sm" flex="none" onClick={onRetry}>Retry</Button>
    </Flex>
);

/** What My DAOs could not read, shown above the list while the switch is on. */
export const MineNotices = ({result}: {result: MyDaosResult}) => (
    <>
        {result.adminFailed && (
            <Notice status="warning">The DAOs you administer could not be read from the chain, so this list may be incomplete.</Notice>
        )}
        {result.onlyAdmin && (
            <Notice status="info">Only the DAOs you administer are listed for now. DAOs you joined, stake in or are nominated for appear once BZE Scan supports it.</Notice>
        )}
        {result.nominatedFailed && (
            <Notice status="warning">The DAOs that nominated you as their admin couldn&apos;t be loaded right now, so this list may be incomplete.</Notice>
        )}
        {(result.memberFailed || result.stakerFailed) && (
            <Notice status="warning">
                {result.memberFailed
                    ? "The DAOs you joined or stake in couldn't be loaded right now, so this list may be incomplete."
                    : "The DAOs you stake in couldn't be loaded right now, so this list may be incomplete."}
            </Notice>
        )}
    </>
);
