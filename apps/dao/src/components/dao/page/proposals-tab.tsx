'use client';

import {useState} from 'react';
import NextLink from 'next/link';
import {Button, chakra, Flex} from '@chakra-ui/react';
import {HgCard, hgVariant, Notice, SegmentedTabs, Shimmer} from '@bze/bze-ui-kit';
import {RowStatusPill} from '@/components/proposal/status-pill';
import {useAsync} from '@/hooks/useAsync';
import {useNow} from '@/hooks/useNow';
import {formatDateTime, formatRelative, shortAddress} from '@/lib/format';
import {loadActiveProposals, loadFinishedProposals, type ProposalDeps} from '@/lib/proposal-loader';
import type {ProposalRow} from '@/lib/proposal-model';
import {votingLine} from '@/lib/proposal-status';
import {tallySummary} from '@/lib/proposal-tally';
import {Tag} from './panel';

type Kind = 'active' | 'finished';

const Row = ({row, nowMs, nameOf}: {row: ProposalRow; nowMs: number; nameOf: (address: string) => string | undefined}) => {
    const ends = formatRelative(row.votingEnd, nowMs);
    const summary = tallySummary(row.tally);

    return (
        <HgCard interactive asChild>
            <NextLink href={`/proposal/${row.id}`} data-testid="proposal-row">
                <Flex direction="column" gap="6px" px="18px" py="14px">
                    <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
                        <chakra.span fontWeight="600" lineClamp={2} minW="0" data-testid="proposal-row-title">{row.title}</chakra.span>
                        <Flex gap="8px" align="center">
                            {row.expedited && <Tag testId="row-expedited">Expedited</Tag>}
                            <RowStatusPill status={row.status} />
                        </Flex>
                    </Flex>
                    <Flex gap="4px 14px" wrap="wrap" fontSize="13px" color="fg.muted">
                        <span>{`#${row.id}`}</span>
                        {row.proposer && <span data-testid="row-proposer">{`by ${nameOf(row.proposer) ?? shortAddress(row.proposer)}`}</span>}
                        {row.votingEnd && <span data-testid="row-ends">{votingLine(row.status, row.votingEnd, nowMs, ends, formatDateTime(row.votingEnd))}</span>}
                        {summary && <span data-testid="row-tally">{summary}</span>}
                    </Flex>
                </Flex>
            </NextLink>
        </HgCard>
    );
};

const Retry = ({what, onRetry}: {what: string; onRetry: () => void}) => (
    <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="scan-retry">
        <span>{`${what} could not be loaded from BZE Scan.`}</span>
        <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={onRetry}>Retry</chakra.button>
    </Flex>
);

const ActiveList = ({deps, daoId, nowMs, nameOf}: {deps: ProposalDeps; daoId: string; nowMs: number; nameOf: (a: string) => string | undefined}) => {
    const [retry, setRetry] = useState(0);
    const list = useAsync(`${daoId}:active:${retry}`, () => loadActiveProposals(deps, daoId));

    if (list.loading) return <Shimmer h="80px" borderRadius="16px" aria-hidden />;
    if (list.error || !list.data) {
        return (
            <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="proposals-error">
                <span>The proposals could not be loaded.</span>
                <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setRetry((n) => n + 1)}>Retry</chakra.button>
            </Flex>
        );
    }
    return (
        <>
            {list.data.source === 'chain' && <Notice status="info">BZE Scan is not answering, so these are read from the chain.</Notice>}
            {list.data.rows.length === 0 && <chakra.p m="0" color="fg.muted" data-testid="active-empty">No proposal is being voted on or waiting for a retry.</chakra.p>}
            {list.data.rows.map((row) => <Row key={row.id} row={row} nowMs={nowMs} nameOf={nameOf} />)}
        </>
    );
};

const FinishedPage = ({deps, daoId, cursor, first, nowMs, nameOf}: {deps: ProposalDeps; daoId: string; cursor: string | null; first: boolean; nowMs: number; nameOf: (a: string) => string | undefined}) => {
    const [retry, setRetry] = useState(0);
    const [more, setMore] = useState(false);
    const page = useAsync(`${daoId}:finished:${cursor ?? 'first'}:${retry}`, () => loadFinishedProposals(deps, daoId, cursor));

    if (page.loading) return <Shimmer h="80px" borderRadius="16px" aria-hidden />;
    if (page.error || !page.data) return <Retry what="The finished proposals" onRetry={() => setRetry((n) => n + 1)} />;

    const {rows, next} = page.data;
    return (
        <>
            {first && rows.length === 0 && !next && <chakra.p m="0" color="fg.muted" data-testid="finished-empty">No proposal of this DAO has finished yet.</chakra.p>}
            {rows.map((row) => <Row key={row.id} row={row} nowMs={nowMs} nameOf={nameOf} />)}
            {next && !more && (
                <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setMore(true)} data-testid="proposals-more">Load more</chakra.button>
            )}
            {next && more && <FinishedPage deps={deps} daoId={daoId} cursor={next} first={false} nowMs={nowMs} nameOf={nameOf} />}
        </>
    );
};

/**
 * A DAO's proposals: the active ones (voting, or passed with a failed execution) and the finished ones, newest
 * first. `newProposal` shows the link to the composer (`actionsFor(...).newProposal`).
 */
export const ProposalsTab = ({deps, daoId, nameOf, newProposal = false}: {deps: ProposalDeps; daoId: string; nameOf: (address: string) => string | undefined; newProposal?: boolean}) => {
    const [kind, setKind] = useState<Kind>('active');
    const nowMs = useNow();

    return (
        <Flex direction="column" gap="12px" data-testid="proposals-tab">
            {newProposal && (
                <Flex justify="flex-end">
                    <Button asChild variant={hgVariant('primary')} size="sm">
                        <NextLink href={`/dao/${daoId}/propose`} data-testid="new-proposal">New proposal</NextLink>
                    </Button>
                </Flex>
            )}
            <SegmentedTabs
                aria-label="Proposals"
                value={kind}
                onChange={setKind}
                options={[{value: 'active', label: 'Active'}, {value: 'finished', label: 'Finished'}]}
            />
            {kind === 'active'
                ? <ActiveList deps={deps} daoId={daoId} nowMs={nowMs} nameOf={nameOf} />
                : <FinishedPage deps={deps} daoId={daoId} cursor={null} first nowMs={nowMs} nameOf={nameOf} />}
        </Flex>
    );
};
