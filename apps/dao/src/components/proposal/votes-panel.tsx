'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {Notice, SegmentedTabs, Shimmer} from '@bze/bze-ui-kit';
import {AddressLine} from '@/components/dao/page/panel';
import {Pagination, PrevNext} from '@/components/ui/pagination';
import {usePagedList} from '@/hooks/usePagedList';
import {clampPage, cursorCount} from '@/lib/pagination';
import {loadVotesPage, optionLabel, VOTES_PAGE, type ProposalDeps, type VoteFilter, type VotesPage} from '@/lib/proposal-loader';
import {filterCounts, votesCount, type VotesFilter} from '@/lib/proposal-votes';
import {Card, OPTION_TONE, Pill} from './ui';

const COLUMNS = {base: '1fr auto', md: '1fr 90px 140px'};

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
    // `seq` counts the filter changes: each one is a new list (page 1, no cursor trail), so going back to a filter never lands on its old page
    const [view, setView] = useState<{filter: VotesFilter; seq: number; page: number}>({filter: 'all', seq: 0, page: 1});
    const {filter, page} = view;
    const scope = `${proposalId}|${filter}|${view.seq}`;
    const option: VoteFilter | null = filter === 'all' ? null : filter;
    const pickFilter = (next: VotesFilter) => {
        if (next !== filter) setView((v) => ({filter: next, seq: v.seq + 1, page: 1}));
    };
    const goPage = (next: number) => setView((v) => ({...v, page: next}));

    const list = usePagedList<VotesPage>(scope, page, VOTES_PAGE, (position) => loadVotesPage(deps, proposalId, option, position), proposalId);
    // a numbered list asked past its end (the votes got fewer): show its last page instead
    if (list.pastEnd !== null && list.pastEnd !== page) goPage(list.pastEnd);

    const counts = filterCounts(list.latest?.counts ?? null);
    const loading = list.loading || list.pastEnd !== null;
    const failed = !!list.error;
    const rows = list.items;
    const empty = !loading && !failed && rows.length === 0 && !list.hasPrev && !list.hasNext;
    const memberList = daoType === 'DAO_TYPE_STATIC_LIST';
    const single = list.mode === 'cursor' && !list.hasPrev && !list.hasNext;
    // every option's votes: Scan's counts, else under All the list's own total (or, on a single cursor page, its rows)
    const allVotes = counts.all ?? (filter !== 'all' ? null : list.mode === 'pages' ? list.total : single ? rows.length : null);

    const footer = () => {
        if (empty || failed) return null;
        const count = (text: string) => (list.loading ? ' ' : text);
        if (list.mode === 'pages' && list.pages !== null) {
            const shown = clampPage(page, list.pages);
            return (
                <Pagination
                    page={shown}
                    pages={list.pages}
                    onPage={goPage}
                    busy={list.loading}
                    count={count(votesCount({page: shown, pageSize: VOTES_PAGE, rows: rows.length, total: list.total ?? 0, memberList, allVotes}))}
                />
            );
        }
        if (list.mode === 'cursor') {
            // nowhere to go: every vote is on this page, so its rows are the count
            const text = single ? votesCount({page: 1, pageSize: VOTES_PAGE, rows: rows.length, total: rows.length, memberList, allVotes}) : cursorCount(list.page);
            return <PrevNext hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.goPrev} onNext={list.goNext} busy={list.loading} count={count(text)} />;
        }
        return null;
    };

    // a member list counts votes, one per member: "1 vote"
    const weightText = (amount: string) => (memberList ? `${amount} ${amount === '1' ? 'vote' : 'votes'}` : formatWeight(amount));

    const filters = (
        <SegmentedTabs
            aria-label="Filter the votes"
            value={filter}
            onChange={pickFilter}
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
    );

    return (
        <Card id="votes" title="Votes" aside={filters} testId="votes-panel" gap="12px">
            {list.source === 'chain' && <Notice status="info">BZE Scan is not answering, so the votes are read from the chain: in voter order, without names.</Notice>}
            <chakra.div display={{base: 'none', md: 'grid'}} gridTemplateColumns={COLUMNS} gap="12px" fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint" aria-hidden>
                <span>Voter</span>
                <span>Vote</span>
                <chakra.span textAlign="right">Weight</chakra.span>
            </chakra.div>
            <div>
                {loading && <Shimmer h="56px" borderRadius="12px" aria-hidden />}
                {!loading && failed && (
                    <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="votes-error">
                        <span>The votes could not be loaded.</span>
                        <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={list.retry}>Retry</chakra.button>
                    </Flex>
                )}
                {empty && <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="votes-empty">{option ? `Nobody has voted ${optionLabel(option)}.` : 'Nobody has voted on this proposal.'}</chakra.p>}
                {!loading && !failed && rows.map((vote) => (
                    <chakra.div
                        key={vote.voter}
                        display="grid"
                        gridTemplateColumns={COLUMNS}
                        gridTemplateAreas={{base: '"voter weight" "vote weight"', md: '"voter vote weight"'}}
                        gap={{base: '4px 12px', md: '12px'}}
                        alignItems="center"
                        py="11px"
                        borderTopWidth="1px"
                        borderColor="hg.divider"
                        fontSize="14px"
                        data-testid="vote-row"
                    >
                        <chakra.span gridArea="voter" minW="0"><AddressLine address={vote.voter} name={vote.name ?? undefined} /></chakra.span>
                        <chakra.span gridArea="vote">
                            <Pill tone={OPTION_TONE[vote.option]}><span data-testid="vote-option">{optionLabel(vote.option)}</span></Pill>
                        </chakra.span>
                        <Flex gridArea="weight" direction="column" align="flex-end" gap="2px" textAlign="right">
                            <chakra.span fontWeight="600" data-testid="vote-weight">{weightText(vote.effectiveWeight)}</chakra.span>
                            {vote.effectiveWeight !== vote.weight && <chakra.span fontSize="12px" color="hg.text.faint" data-testid="vote-reduced">{`cast with ${weightText(vote.weight)}`}</chakra.span>}
                        </Flex>
                    </chakra.div>
                ))}
            </div>
            {footer()}
        </Card>
    );
};
