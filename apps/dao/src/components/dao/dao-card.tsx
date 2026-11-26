'use client';

import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import {HgCard} from '@bze/bze-ui-kit';
import type {DaoCard, Reason} from '@/lib/dao-types';
import {formatDay} from '@/lib/format';

const KIND_LABEL = {static_list: 'Static list', stake: 'Stake'} as const;

const Tag = ({children, testId}: {children: React.ReactNode; testId?: string}) => (
    <chakra.span
        fontSize="12px"
        fontWeight="600"
        px="9px"
        py="3px"
        borderRadius="hg.pill"
        whiteSpace="nowrap"
        color="hg.link"
        bg="app.subtle"
        borderWidth="1px"
        borderColor="app.border"
        data-testid={testId}
    >
        {children}
    </chakra.span>
);

/** One DAO in a list: name, type, who runs it, open proposals, creation day. The whole card links to the DAO. */
export const DaoListCard = ({dao, reasons}: {dao: DaoCard; reasons?: Reason[]}) => {
    const created = formatDay(dao.createdAt);
    const open = dao.proposalsOpen;

    return (
        <HgCard interactive asChild>
            <NextLink href={`/dao/${dao.id}`} data-testid="dao-card" aria-label={`${dao.name}, DAO ${dao.id}`}>
                <Flex direction="column" gap="10px" p="18px" h="100%">
                    <Flex justify="space-between" align="flex-start" gap="12px">
                        <chakra.span fontSize="17px" fontWeight="700" lineClamp={2} minW="0">{dao.name}</chakra.span>
                        <chakra.span fontSize="12px" color="hg.text.faint" whiteSpace="nowrap">{`#${dao.id}`}</chakra.span>
                    </Flex>
                    <Flex gap="8px" wrap="wrap">
                        <Tag testId="dao-kind">{KIND_LABEL[dao.kind]}</Tag>
                        <Tag testId="dao-owner">{dao.selfOwned ? 'Self-owned' : 'Admin-run'}</Tag>
                        {reasons?.map((reason) => <Tag key={reason} testId="dao-reason">{reason}</Tag>)}
                    </Flex>
                    <Flex gap="14px" wrap="wrap" fontSize="13px" color="fg.muted" mt="auto" pt="4px">
                        {open !== null && (
                            <span data-testid="dao-open">{open === 1 ? '1 open proposal' : `${open} open proposals`}</span>
                        )}
                        {created && <span>{`Created ${created}`}</span>}
                    </Flex>
                </Flex>
            </NextLink>
        </HgCard>
    );
};
