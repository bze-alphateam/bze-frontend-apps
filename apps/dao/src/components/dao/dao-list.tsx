'use client';

import NextLink from 'next/link';
import {Box, chakra, Flex, Table} from '@chakra-ui/react';
import {HgCard, Shimmer} from '@bze/bze-ui-kit';
import type {DaoCard, Reason} from '@/lib/dao-types';
import {formatDay} from '@/lib/format';
import {governedBy, governedByLine, roleTone} from '@/lib/home-list';

export interface DaoRow {
    dao: DaoCard;
    /** The connected wallet's roles in the DAO, in display order; empty while unknown. */
    reasons: Reason[];
}

const SKELETON_ROWS = 6;
const SKELETON_CARDS = 3;

const PILL = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: '600',
    px: '9px',
    py: '3px',
    borderRadius: 'hg.pill',
    whiteSpace: 'nowrap' as const,
    borderWidth: '1px',
};

const RolePill = ({reason, testId}: {reason: Reason; testId: string}) => (
    <chakra.span
        {...PILL}
        data-testid={testId}
        {...(roleTone(reason) === 'amber'
            ? {color: 'hg.warning.text', bg: 'hg.warning/12', borderColor: 'hg.warning/38'}
            : {color: 'hg.link', bg: 'app.subtle', borderColor: 'app.border'})}
    >
        {reason}
    </chakra.span>
);

/** The open count: dimmed at 0, a dash when the source cannot tell (the chain fallback). */
const openText = (dao: DaoCard) => (dao.proposalsOpen === null ? '—' : String(dao.proposalsOpen));
const openColor = (dao: DaoCard) => (dao.proposalsOpen ? 'fg' : 'fg.subtle');

const HEAD = {
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'hg.text.faint',
    bg: 'transparent',
    borderBottomWidth: '1px',
    borderColor: 'hg.hairline',
    py: '10px',
    ps: '12px',
    pe: '12px',
};
const CELL = {py: '12px', ps: '12px', pe: '12px', borderBottomWidth: '1px', borderColor: 'hg.divider', bg: 'transparent'};

/** The DAOs as a table (md and up); it scrolls inside its card below ~760 px, never the page. */
export const DaoTable = ({rows, loading, showRoles}: {rows: DaoRow[]; loading: boolean; showRoles: boolean}) => (
    <Box display={{base: 'none', md: 'block'}} overflowX="auto" mx={{md: '-24px'}} data-testid="dao-table">
        <Table.Root minW="760px" w="100%" fontSize="14px" css={{fontVariantNumeric: 'tabular-nums'}}>
            <Table.Header>
                <Table.Row bg="transparent">
                    <Table.ColumnHeader {...HEAD} ps="24px">DAO</Table.ColumnHeader>
                    <Table.ColumnHeader {...HEAD}>Governed by</Table.ColumnHeader>
                    <Table.ColumnHeader {...HEAD} textAlign="end">Open proposals</Table.ColumnHeader>
                    <Table.ColumnHeader {...HEAD} pe={showRoles ? '12px' : '24px'}>Created</Table.ColumnHeader>
                    {showRoles && <Table.ColumnHeader {...HEAD} pe="24px">You</Table.ColumnHeader>}
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {loading
                    ? Array.from({length: SKELETON_ROWS}, (_, i) => (
                        <Table.Row key={i} bg="transparent" aria-hidden data-testid="dao-row-skeleton">
                            <Table.Cell {...CELL} ps="24px">
                                <Flex direction="column" gap="6px"><Shimmer h="14px" w="55%" /><Shimmer h="10px" w="12%" /></Flex>
                            </Table.Cell>
                            <Table.Cell {...CELL}><Shimmer h="14px" w="96px" /></Table.Cell>
                            <Table.Cell {...CELL}><Shimmer h="14px" w="24px" ms="auto" /></Table.Cell>
                            <Table.Cell {...CELL} pe={showRoles ? '12px' : '24px'}><Shimmer h="14px" w="88px" /></Table.Cell>
                            {showRoles && <Table.Cell {...CELL} pe="24px"><Shimmer h="14px" w="64px" /></Table.Cell>}
                        </Table.Row>
                    ))
                    : rows.map(({dao, reasons}) => (
                        <Table.Row key={dao.id} bg="transparent" data-testid="dao-row">
                            <Table.Cell {...CELL} ps="24px">
                                <NextLink href={`/dao/${dao.id}`} data-testid="dao-link" aria-label={`${dao.name}, DAO ${dao.id}`}>
                                    <Flex direction="column" gap="1px" minW="0">
                                        <chakra.strong fontSize="15px" fontWeight="600" color="fg">{dao.name}</chakra.strong>
                                        <chakra.span fontSize="12px" color="hg.text.faint">{`#${dao.id}`}</chakra.span>
                                    </Flex>
                                </NextLink>
                            </Table.Cell>
                            <Table.Cell {...CELL} whiteSpace="nowrap" color="fg.muted" data-testid="dao-governed">{governedBy(dao.kind)}</Table.Cell>
                            <Table.Cell {...CELL} textAlign="end" fontWeight="600" color={openColor(dao)} data-testid="dao-open">{openText(dao)}</Table.Cell>
                            <Table.Cell {...CELL} whiteSpace="nowrap" color="fg.muted" pe={showRoles ? '12px' : '24px'} data-testid="dao-created">{formatDay(dao.createdAt)}</Table.Cell>
                            {showRoles && (
                                <Table.Cell {...CELL} pe="24px" data-testid="dao-roles">
                                    <Flex gap="6px" wrap="wrap">{reasons.map((reason) => <RolePill key={reason} reason={reason} testId="dao-reason" />)}</Flex>
                                </Table.Cell>
                            )}
                        </Table.Row>
                    ))}
            </Table.Body>
        </Table.Root>
    </Box>
);

/** The DAOs as cards (below md): the whole card links to the DAO. */
export const DaoCards = ({rows, loading}: {rows: DaoRow[]; loading: boolean}) => (
    <Flex direction="column" gap="10px" display={{base: 'flex', md: 'none'}} data-testid="dao-cards">
        {loading
            ? Array.from({length: SKELETON_CARDS}, (_, i) => (
                <HgCard key={i} p="14px" borderRadius="14px" aria-hidden data-testid="dao-card-skeleton">
                    <Flex direction="column" gap="12px">
                        <Flex justify="space-between" gap="12px"><Flex direction="column" gap="6px" flex="1"><Shimmer h="14px" w="60%" /><Shimmer h="10px" w="40%" /></Flex><Shimmer h="18px" w="24px" /></Flex>
                        <Shimmer h="22px" w="150px" borderRadius="hg.pill" />
                    </Flex>
                </HgCard>
            ))
            : rows.map(({dao, reasons}) => {
                const created = formatDay(dao.createdAt);
                return (
                    <HgCard key={dao.id} interactive asChild p="14px" borderRadius="14px">
                        <NextLink href={`/dao/${dao.id}`} data-testid="dao-card" aria-label={`${dao.name}, DAO ${dao.id}`}>
                            <Flex direction="column" gap="10px">
                                <Flex gap="12px" align="center">
                                    <Flex direction="column" gap="2px" flex="1" minW="0">
                                        <chakra.strong fontSize="15px" color="fg" lineClamp={2}>{dao.name}</chakra.strong>
                                        <chakra.span fontSize="12px" color="hg.text.faint">{created ? `#${dao.id} · Created ${created}` : `#${dao.id}`}</chakra.span>
                                    </Flex>
                                    <Flex direction="column" align="flex-end" flex="none">
                                        <chakra.strong fontSize="17px" fontWeight="600" color={openColor(dao)} data-testid="dao-card-open">{openText(dao)}</chakra.strong>
                                        <chakra.span fontSize="11px" color="hg.text.faint">open</chakra.span>
                                    </Flex>
                                </Flex>
                                <Flex gap="6px" wrap="wrap">
                                    <chakra.span {...PILL} color="fg.muted" bg="hg.inset" borderColor="hg.hairline" data-testid="dao-card-governed">{governedByLine(dao.kind)}</chakra.span>
                                    {reasons.map((reason) => <RolePill key={reason} reason={reason} testId="dao-card-reason" />)}
                                </Flex>
                            </Flex>
                        </NextLink>
                    </HgCard>
                );
            })}
    </Flex>
);
