'use client';

import {useEffect} from 'react';
import NextLink from 'next/link';
import {Box, Button, chakra, Flex, Table} from '@chakra-ui/react';
import {HgCard, hgVariant, Notice, PageState, Shimmer} from '@bze/bze-ui-kit';
import {Pagination, PrevNext} from '@/components/ui/pagination';
import {RowStatusPill} from '@/components/proposal/status-pill';
import {useProposalsUrl} from '@/hooks/useDaoTabUrl';
import {useNow} from '@/hooks/useNow';
import {usePagedList} from '@/hooks/usePagedList';
import {formatDateTime, formatRelative, shortAddress} from '@/lib/format';
import {clampPage, cursorCount, rangeCount} from '@/lib/pagination';
import {
    activeRuleAfter, isActiveRow, loadProposalPage, PROPOSAL_FILTERS, PROPOSALS_PAGE, segmentCounts, turnoutShare, yesShare,
    type ProposalFilter, type ProposalPage,
} from '@/lib/proposal-list';
import type {ProposalDeps} from '@/lib/proposal-loader';
import type {ProposalRow} from '@/lib/proposal-model';
import {votingLine} from '@/lib/proposal-status';
import {Tag} from './panel';

type NameOf = (address: string) => string | undefined;

const SKELETON_ROWS = 5;
const SKELETON_CARDS = 3;

/** The status segmented control, each segment with its count when Scan gave the counts. */
const StatusFilter = ({value, counts, onChange}: {value: ProposalFilter; counts: Record<ProposalFilter, number | null>; onChange: (value: ProposalFilter) => void}) => (
    <Flex
        role="group"
        aria-label="Status"
        display={{base: 'grid', md: 'inline-flex'}}
        gridTemplateColumns="repeat(3, minmax(0, 1fr))"
        flexWrap="wrap"
        gap="2px"
        p="3px"
        borderRadius="12px"
        bg="hg.inset"
        borderWidth="1px"
        borderColor="hg.hairline"
        data-testid="status-filter"
    >
        {PROPOSAL_FILTERS.map((option) => {
            const on = option.value === value;
            const count = counts[option.value];
            return (
                <chakra.button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(option.value)}
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    gap="6px"
                    h={{base: '36px', md: '32px'}}
                    px={{base: '8px', md: '12px'}}
                    border="0"
                    borderRadius="9px"
                    fontSize="13px"
                    fontWeight="600"
                    whiteSpace="nowrap"
                    cursor="pointer"
                    bg={on ? 'hg.raised' : 'transparent'}
                    color={on ? 'fg' : 'fg.muted'}
                    boxShadow={on ? 'xs' : 'none'}
                    focusVisibleRing="outside"
                    _hover={on ? undefined : {color: 'fg'}}
                    data-testid={`status-${option.value}`}
                >
                    {option.label}
                    {count !== null && (
                        <chakra.span fontSize="12px" fontWeight="700" fontVariantNumeric="tabular-nums" color={on ? 'hg.link' : 'hg.text.faint'} data-testid="status-count">
                            {count.toLocaleString('en-US')}
                        </chakra.span>
                    )}
                </chakra.button>
            );
        })}
    </Flex>
);

interface RowsProps {
    rows: ProposalRow[];
    loading: boolean;
    /** Tint the active rows and draw the rule after the last one (All, ordered active first). */
    grouped: boolean;
    nowMs: number;
    nameOf: NameOf;
}

const whenOf = (row: ProposalRow, nowMs: number) =>
    row.votingEnd ? votingLine(row.status, row.votingEnd, nowMs, formatRelative(row.votingEnd, nowMs), formatDateTime(row.votingEnd)) : '';
const byOf = (row: ProposalRow, nameOf: NameOf) => (row.proposer ? `by ${nameOf(row.proposer) ?? shortAddress(row.proposer)}` : '');

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
const CELL = {py: '14px', ps: '12px', pe: '12px', borderBottomWidth: '1px', borderColor: 'hg.divider', bg: 'transparent'};

const StatusCell = ({row}: {row: ProposalRow}) => (
    <Flex gap="6px" wrap="wrap">
        <RowStatusPill status={row.status} />
        {row.expedited && <Tag testId="row-expedited">Expedited</Tag>}
    </Flex>
);

/** The proposals as a table (md and up); it scrolls inside its card when narrow, never the page. */
const ProposalTable = ({rows, loading, grouped, nowMs, nameOf}: RowsProps) => {
    const rule = grouped ? activeRuleAfter(rows) : null;
    return (
        <Box display={{base: 'none', md: 'block'}} overflowX="auto" mx={{md: '-24px'}} data-testid="proposal-table">
            <Table.Root minW="820px" w="100%" fontSize="14px" css={{fontVariantNumeric: 'tabular-nums'}}>
                <Table.Header>
                    <Table.Row bg="transparent">
                        <Table.ColumnHeader {...HEAD} ps="24px" w="56px">#</Table.ColumnHeader>
                        <Table.ColumnHeader {...HEAD}>Proposal</Table.ColumnHeader>
                        <Table.ColumnHeader {...HEAD}>Status</Table.ColumnHeader>
                        <Table.ColumnHeader {...HEAD} textAlign="end">Yes</Table.ColumnHeader>
                        <Table.ColumnHeader {...HEAD} textAlign="end">Turnout</Table.ColumnHeader>
                        <Table.ColumnHeader {...HEAD} pe="24px">When</Table.ColumnHeader>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {loading
                        ? Array.from({length: SKELETON_ROWS}, (_, i) => (
                            <Table.Row key={i} bg="transparent" aria-hidden data-testid="proposal-row-skeleton">
                                <Table.Cell {...CELL} ps="24px"><Shimmer h="14px" w="24px" /></Table.Cell>
                                <Table.Cell {...CELL}><Flex direction="column" gap="6px"><Shimmer h="14px" w="60%" /><Shimmer h="10px" w="25%" /></Flex></Table.Cell>
                                <Table.Cell {...CELL}><Shimmer h="20px" w="80px" borderRadius="hg.pill" /></Table.Cell>
                                <Table.Cell {...CELL}><Shimmer h="14px" w="40px" ms="auto" /></Table.Cell>
                                <Table.Cell {...CELL}><Shimmer h="14px" w="40px" ms="auto" /></Table.Cell>
                                <Table.Cell {...CELL} pe="24px"><Shimmer h="14px" w="100px" /></Table.Cell>
                            </Table.Row>
                        ))
                        : rows.map((row, i) => {
                            const active = grouped && isActiveRow(row);
                            const ruled = rule === i;
                            const cell = {...CELL, ...(ruled ? {borderColor: 'app.border'} : {})};
                            return (
                                <Table.Row
                                    key={row.id}
                                    bg={active ? 'app.subtle/40' : 'transparent'}
                                    data-testid="proposal-row"
                                    data-active={active ? 'true' : undefined}
                                    data-rule={ruled ? 'after' : undefined}
                                >
                                    <Table.Cell {...cell} ps="24px" color="hg.text.faint" fontWeight="600">{`#${row.id}`}</Table.Cell>
                                    <Table.Cell {...cell}>
                                        <NextLink href={`/proposal/${row.id}`} data-testid="proposal-link">
                                            <Flex direction="column" gap="3px" minW="0">
                                                <chakra.strong fontSize="15px" fontWeight="600" color="fg" lineClamp={2} data-testid="proposal-row-title">{row.title}</chakra.strong>
                                                {row.proposer && <chakra.span fontSize="12px" color="hg.text.faint" data-testid="row-proposer">{byOf(row, nameOf)}</chakra.span>}
                                            </Flex>
                                        </NextLink>
                                    </Table.Cell>
                                    <Table.Cell {...cell}><StatusCell row={row} /></Table.Cell>
                                    <Table.Cell {...cell} textAlign="end" color="fg.muted" whiteSpace="nowrap" data-testid="row-yes">{yesShare(row.tally)}</Table.Cell>
                                    <Table.Cell {...cell} textAlign="end" color="fg.muted" whiteSpace="nowrap" data-testid="row-turnout">{turnoutShare(row.tally)}</Table.Cell>
                                    <Table.Cell {...cell} pe="24px" fontSize="13px" whiteSpace="nowrap" color={isActiveRow(row) ? 'fg' : 'fg.muted'} data-testid="row-ends">{whenOf(row, nowMs)}</Table.Cell>
                                </Table.Row>
                            );
                        })}
                </Table.Body>
            </Table.Root>
        </Box>
    );
};

/** The proposals as cards (below md): the whole card links to the proposal. */
const ProposalCards = ({rows, loading, grouped, nowMs, nameOf}: RowsProps) => (
    <Flex direction="column" gap="10px" display={{base: 'flex', md: 'none'}} data-testid="proposal-cards">
        {loading
            ? Array.from({length: SKELETON_CARDS}, (_, i) => (
                <HgCard key={i} p="14px" borderRadius="14px" aria-hidden data-testid="proposal-card-skeleton">
                    <Flex direction="column" gap="10px"><Shimmer h="14px" w="70%" /><Shimmer h="20px" w="120px" borderRadius="hg.pill" /><Shimmer h="10px" w="50%" /></Flex>
                </HgCard>
            ))
            : rows.map((row) => {
                const active = grouped && isActiveRow(row);
                const when = whenOf(row, nowMs);
                return (
                    <HgCard key={row.id} interactive asChild p="14px" borderRadius="14px" {...(active ? {borderColor: 'app.border'} : {})}>
                        <NextLink href={`/proposal/${row.id}`} data-testid="proposal-card" data-active={active ? 'true' : undefined}>
                            <Flex direction="column" gap="8px">
                                <Flex direction="column" gap="2px" minW="0">
                                    <chakra.strong fontSize="15px" color="fg" lineClamp={2}>{row.title}</chakra.strong>
                                    <chakra.span fontSize="12px" color="hg.text.faint">{[`#${row.id}`, byOf(row, nameOf)].filter(Boolean).join(' · ')}</chakra.span>
                                </Flex>
                                <StatusCell row={row} />
                                <Flex gap="4px 14px" wrap="wrap" fontSize="13px" color="fg.muted">
                                    {row.tally && <span data-testid="card-tally">{`Yes ${yesShare(row.tally)} · Turnout ${turnoutShare(row.tally)}`}</span>}
                                    {when && <span>{when}</span>}
                                </Flex>
                            </Flex>
                        </NextLink>
                    </HgCard>
                );
            })}
    </Flex>
);

/**
 * A DAO's proposals in one table (cards on a phone) with a status filter: All · Active · Passed · Rejected ·
 * Expired · Cancelled, each with its count from Scan's `status_counts`. Under All the active ones come first
 * (Scan's order with `page`), tinted, with a rule after the last. Numbered pages while Scan answers totals,
 * Prev / Next otherwise; the status and the page live in the URL next to `tab=proposals`. With Scan down only
 * Active lists (the chain's live proposals). `newProposal` shows the link to the composer (`actionsFor(...).newProposal`).
 */
export const ProposalsTab = ({deps, daoId, nameOf, newProposal = false}: {deps: ProposalDeps; daoId: string; nameOf: NameOf; newProposal?: boolean}) => {
    const nowMs = useNow();
    const {query, pushPage, replacePage, setFilter} = useProposalsUrl(daoId);
    const {filter} = query;
    const list = usePagedList<ProposalPage, {state: 'needs-scan'}>(`${daoId}|${filter}`, query.page, PROPOSALS_PAGE, (position) =>
        loadProposalPage(deps, daoId, filter, position), daoId);

    const lastPage = list.pastEnd;
    useEffect(() => {
        if (lastPage !== null) replacePage(lastPage);
    }, [lastPage, replacePage]);

    const counts = segmentCounts(list.latest?.counts);
    const needsScan = list.result?.state === 'needs-scan';
    const loading = list.loading || list.pastEnd !== null;
    const failed = !!list.error;
    const rows = list.items;
    const empty = !loading && !failed && !needsScan && rows.length === 0;
    // Scan orders a numbered page active first; an older Scan (by cursor) lists newest first, so no rule there.
    const grouped = filter === 'all' && list.mode === 'pages';

    const footer = () => {
        if (empty || failed || needsScan) return null;
        const count = (text: string) => (list.loading ? ' ' : text);
        if (list.mode === 'pages' && list.pages !== null) {
            const page = clampPage(query.page, list.pages);
            return (
                <Pagination
                    page={page}
                    pages={list.pages}
                    onPage={pushPage}
                    busy={list.loading}
                    count={count(rangeCount({page, pageSize: PROPOSALS_PAGE, rows: rows.length, total: list.total ?? 0, one: 'proposal', many: 'proposals'}))}
                />
            );
        }
        if (list.mode === 'cursor') {
            return <PrevNext hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.goPrev} onNext={list.goNext} busy={list.loading} count={count(cursorCount(list.page))} />;
        }
        return null;
    };

    return (
        <Box
            as="section"
            aria-label="Proposals"
            bg={{base: 'transparent', md: 'hg.card'}}
            borderWidth={{base: '0', md: '1px'}}
            borderColor="hg.hairline"
            borderRadius="hg.lg"
            boxShadow={{base: 'none', md: 'hg.card'}}
            p={{base: '0', md: '22px 24px'}}
            data-testid="proposals-tab"
        >
            <Flex direction="column" gap="16px">
                <Flex wrap="wrap" align="center" justify="space-between" gap="12px">
                    <Box flexBasis={{base: '100%', md: 'auto'}}>
                        <StatusFilter value={filter} counts={counts} onChange={(value) => value !== filter && setFilter(value)} />
                    </Box>
                    {newProposal && (
                        <Button asChild variant={hgVariant('primary')} size="sm">
                            <NextLink href={`/dao/${daoId}/propose`} data-testid="new-proposal">New proposal</NextLink>
                        </Button>
                    )}
                </Flex>

                {list.source === 'chain' && !needsScan && (
                    <Notice status="info">
                        BZE Scan is not answering, so the active proposals are read from the chain.{' '}
                        <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={list.retry}>Retry</chakra.button>
                    </Notice>
                )}

                {needsScan && (
                    <Flex direction="column" gap="10px" align="flex-start" data-testid="needs-scan">
                        <Notice status="warning" title="This list needs BZE Scan">
                            BZE Scan is not answering. The chain only keeps the proposals that are still active.
                        </Notice>
                        <Flex gap="16px" fontSize="13px">
                            <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setFilter('active')}>Show the active ones</chakra.button>
                            <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={list.retry}>Retry</chakra.button>
                        </Flex>
                    </Flex>
                )}

                {failed && (
                    <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="proposals-error">
                        <span>The proposals could not be loaded.</span>
                        <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={list.retry}>Retry</chakra.button>
                    </Flex>
                )}

                {empty && (
                    filter === 'all'
                        ? <PageState kind="empty" title="No proposals yet" description="Proposals submitted to this DAO are listed here." />
                        : <PageState kind="empty" title="No proposals with this status" description="Pick another status, or All." />
                )}

                {!empty && !failed && !needsScan && (
                    <>
                        <ProposalTable rows={rows} loading={loading} grouped={grouped} nowMs={nowMs} nameOf={nameOf} />
                        <ProposalCards rows={rows} loading={loading} grouped={grouped} nowMs={nowMs} nameOf={nameOf} />
                    </>
                )}

                {footer()}
            </Flex>
        </Box>
    );
};
