'use client';

import {Fragment} from 'react';
import NextLink from 'next/link';
import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoProposal} from '@bze/bze-ui-kit';
import {HgCard} from '@bze/bze-ui-kit';
import {linkify} from '@/lib/dao-text';
import type {ScanDaoDetail} from '@/lib/dao-types';
import type {Part} from '@/lib/dao-view-loader';
import {formatDay, isoFromUnix} from '@/lib/format';
import type {DaoActions} from '@/lib/dao-actions';
import {AddressLine, ScanRetry, Tag} from './panel';

export const TYPE_BADGE = {DAO_TYPE_STATIC_LIST: 'Member list', DAO_TYPE_STAKE: 'Stakers'} as const;

/** The DAO's description as plain text: line breaks kept, only http(s) links. Never HTML. */
export const DescriptionText = ({text}: {text: string}) => (
    <chakra.p m="0" fontSize="15px" lineHeight="1.6" color="fg.muted" whiteSpace="pre-wrap" overflowWrap="anywhere" data-testid="dao-description">
        {linkify(text).map((segment, i) => segment.kind === 'link'
            ? <chakra.a key={i} href={segment.href} target="_blank" rel="noopener noreferrer nofollow ugc" color="hg.link" textDecoration="underline">{segment.text}</chakra.a>
            : <Fragment key={i}>{segment.text}</Fragment>)}
    </chakra.p>
);

interface HeaderProps {
    dao: Dao;
    openProposals: Part<DaoProposal[]>;
    extras: {data: ScanDaoDetail | null | undefined; failed: boolean};
    nameOf: (address: string) => string | undefined;
    onRetryExtras: () => void;
    actions: DaoActions;
}

/** Type, description, the DAO's account, who made it and when, and how many proposals are open. */
export const DaoHeader = ({dao, openProposals, extras, nameOf, onRetryExtras, actions}: HeaderProps) => {
    const created = formatDay(isoFromUnix(dao.created_at));
    const creator = extras.data?.creator;
    const open = openProposals.ok ? openProposals.value.length : null;

    return (
        <HgCard data-testid="dao-header">
            <Flex direction="column" gap="14px" p={{base: '16px', md: '22px'}}>
                <Flex gap="10px" align="center" wrap="wrap">
                    <Tag testId="dao-type">{TYPE_BADGE[dao.type]}</Tag>
                    <chakra.span fontSize="13px" color="hg.text.faint" data-testid="dao-number">{`DAO #${dao.id}`}</chakra.span>
                </Flex>
                {dao.description && <DescriptionText text={dao.description} />}
                <Flex direction="column" gap="8px" fontSize="14px">
                    <Flex gap="8px" align="center" wrap="wrap">
                        <chakra.span color="hg.text.faint" fontSize="13px">DAO account</chakra.span>
                        <AddressLine address={dao.address} full testId="dao-address" />
                    </Flex>
                    <Flex gap="8px 18px" wrap="wrap" color="fg.muted" align="center">
                        {created && <span data-testid="dao-created">{`Created ${created}`}</span>}
                        {creator && (
                            <Flex gap="6px" align="center" data-testid="dao-creator">
                                <span>by</span>
                                <AddressLine address={creator} name={nameOf(creator)} />
                            </Flex>
                        )}
                        {open !== null && (
                            <span data-testid="dao-open-count">{open === 1 ? '1 open proposal' : `${open} open proposals`}</span>
                        )}
                    </Flex>
                    {extras.failed && <ScanRetry what="Who created this DAO" onRetry={onRetryExtras} />}
                </Flex>
                {actions.newProposal && (
                    <Flex gap="10px" wrap="wrap" data-testid="dao-actions">
                        <chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={`/dao/${dao.id}/propose`}>New proposal</NextLink></chakra.a>
                    </Flex>
                )}
            </Flex>
        </HgCard>
    );
};
