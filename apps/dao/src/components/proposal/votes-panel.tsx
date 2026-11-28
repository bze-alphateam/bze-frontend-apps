'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {Notice, SegmentedTabs, Shimmer} from '@bze/bze-ui-kit';
import {AddressLine, Panel} from '@/components/dao/page/panel';
import {Pagination, PrevNext} from '@/components/ui/pagination';
import {usePagedList} from '@/hooks/usePagedList';
import {formatDateTime} from '@/lib/format';
import {cursorCount} from '@/lib/home-list';
import {clampPage} from '@/lib/pagination';
import {loadVotesPage, optionLabel, VOTES_PAGE, type ProposalDeps, type VoteFilter, type VotesPage} from '@/lib/proposal-loader';
import {filterCounts, votesCount, type VotesFilter} from '@/lib/proposal-votes';

interface Props {
    deps: ProposalDeps;
    proposalId: string;
    /** The DAO's type: a member list says "one vote per member" when every vote fits on one page. */
    daoType: string | null;
    formatWeight: (amount: string) => string;
}

const FILTERS: {value: VotesFilter; label: string}[] = [
    {value: 'all', label: 'All'},
    {value: 'YES', label: 'Yes'},
    {value: 'NO', label: 'No'},
    {value: 'ABSTAIN', label: 'Abstain'},
];

/**
 * Who voted and with what weight (the effective one, after later reductions), filterable by option, each option
 * with its count from Scan. Numbered pages while Scan answers totals; Prev / Next with an older Scan, and with
 * Scan down the chain's ballots (voter order, no names). The page is the panel's own (not in the URL); a filter
 * change starts again at page 1.
 */
export const VotesPanel = ({deps, proposalId, daoType, formatWeight}: Props) => {
    const [filter, setFilter] = useState<VotesFilter>('all');
    const scope = `${proposalId}|${filter}`;
    const [paging, setPaging] = useState<{scope: string; page: number}>({scope, page: 1});
    const page = paging.scope === scope ? paging.page : 1;
    const option: VoteFilter | null = filter === 'all' ? null : filter;

    const list = usePagedList<VotesPage>(scope, page, VOTES_PAGE, (position) => loadVotesPage(deps, proposalId, option, position), proposalId);
    // a numbered list asked past its end (the votes got fewer): show its last page instead
    if (list.pastEnd !== null && list.pastEnd !== page) setPaging({scope, page: list.pastEnd});

    const counts = filterCounts(list.latest?.counts ?? null);
    const loading = list.loading || list.pastEnd !== null;
    const failed = !!list.error;
    const rows = list.items;
    const empty = !loading && !failed && rows.length === 0 && !list.hasPrev && !list.hasNext;
    const memberList = daoType === 'DAO_TYPE_STATIC_LIST';

    const footer = () => {
        if (empty || failed) return null;
        const count = (text: string) => (list.loading ? ' ' : text);
        if (list.mode === 'pages' && list.pages !== null) {
            const shown = clampPage(page, list.pages);
            return (
                <Pagination
                    page={shown}
                    pages={list.pages}
                    onPage={(next) => setPaging({scope, page: next})}
                    busy={list.loading}
                    count={count(votesCount({page: shown, pageSize: VOTES_PAGE, rows: rows.length, total: list.total ?? 0, memberList}))}
                />
            );
        }
        if (list.mode === 'cursor') {
            // nowhere to go: every vote is on this page, so its rows are the count
            const single = !list.hasPrev && !list.hasNext;
            const text = single ? votesCount({page: 1, pageSize: VOTES_PAGE, rows: rows.length, total: rows.length, memberList}) : cursorCount(list.page);
            return <PrevNext hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.goPrev} onNext={list.goNext} busy={list.loading} count={count(text)} />;
        }
        return null;
    };

    return (
        <Panel id="votes" title="Votes" testId="votes-panel">
            <SegmentedTabs
                aria-label="Filter the votes"
                value={filter}
                onChange={setFilter}
                options={FILTERS.map(({value, label}) => ({
                    value,
                    label: counts[value] === null ? label : (
                        <chakra.span display="inline-flex" gap="6px" alignItems="center">
                            {label}
                            <chakra.span fontSize="12px" fontWeight="700" fontVariantNumeric="tabular-nums" color="hg.text.faint" data-testid="vote-filter-count">
                                {(counts[value] as number).toLocaleString('en-US')}
                            </chakra.span>
                        </chakra.span>
                    ),
                }))}
            />
            {list.source === 'chain' && <Notice status="info">BZE Scan is not answering, so the votes are read from the chain: in voter order, without names.</Notice>}
            <Flex direction="column" gap="0">
                {loading && <Shimmer h="56px" borderRadius="12px" aria-hidden />}
                {!loading && failed && (
                    <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="votes-error">
                        <span>The votes could not be loaded.</span>
                        <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={list.retry}>Retry</chakra.button>
                    </Flex>
                )}
                {empty && <chakra.p m="0" color="fg.muted" data-testid="votes-empty">{option ? `Nobody has voted ${optionLabel(option)}.` : 'Nobody has voted on this proposal.'}</chakra.p>}
                {!loading && !failed && rows.map((vote) => (
                    <Flex key={vote.voter} justify="space-between" align="center" gap="12px" wrap="wrap" py="8px" borderTopWidth="1px" borderColor="app.border" data-testid="vote-row">
                        <AddressLine address={vote.voter} name={vote.name ?? undefined} />
                        <Flex gap="12px" align="center" fontSize="14px" wrap="wrap">
                            <chakra.strong data-testid="vote-option">{optionLabel(vote.option)}</chakra.strong>
                            <span data-testid="vote-weight">{formatWeight(vote.effectiveWeight)}</span>
                            {vote.effectiveWeight !== vote.weight && <chakra.span fontSize="12px" color="fg.muted" data-testid="vote-reduced">{`cast with ${formatWeight(vote.weight)}`}</chakra.span>}
                            {vote.time && <chakra.span fontSize="12px" color="hg.text.faint">{formatDateTime(vote.time)}</chakra.span>}
                        </Flex>
                    </Flex>
                ))}
            </Flex>
            {footer()}
        </Panel>
    );
};
