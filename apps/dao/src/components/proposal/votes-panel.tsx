'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {Notice, SegmentedTabs, Shimmer} from '@bze/bze-ui-kit';
import {AddressLine, Panel} from '@/components/dao/page/panel';
import {useAsync} from '@/hooks/useAsync';
import {formatDateTime} from '@/lib/format';
import {loadVotes, optionLabel, type ProposalDeps, type VoteFilter, type VotesCursor} from '@/lib/proposal-loader';

type Filter = 'all' | VoteFilter;

interface PageProps {
    deps: ProposalDeps;
    proposalId: string;
    filter: VoteFilter | null;
    cursor: VotesCursor | null;
    first: boolean;
    formatWeight: (amount: string) => string;
}

/** One page of the votes; "Load more" mounts the next page below it. */
const VotesPageView = ({deps, proposalId, filter, cursor, first, formatWeight}: PageProps) => {
    const [more, setMore] = useState(false);
    const [retry, setRetry] = useState(0);
    const page = useAsync(`${proposalId}:${filter ?? 'all'}:${cursor?.key ?? 'first'}:${retry}`, () => loadVotes(deps, proposalId, filter, cursor));

    if (page.loading) return <Shimmer h="56px" borderRadius="12px" aria-hidden />;
    if (page.error || !page.data) {
        return (
            <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="votes-error">
                <span>The votes could not be loaded.</span>
                <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setRetry((n) => n + 1)}>Retry</chakra.button>
            </Flex>
        );
    }

    const {rows, next, source} = page.data;
    return (
        <>
            {first && source === 'chain' && <Notice status="info">BZE Scan is not answering, so the votes are read from the chain: in voter order, without names.</Notice>}
            {first && rows.length === 0 && !next && <chakra.p m="0" color="fg.muted" data-testid="votes-empty">{filter ? `Nobody has voted ${optionLabel(filter)}.` : 'Nobody has voted on this proposal.'}</chakra.p>}
            {rows.map((vote) => (
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
            {next && !more && (
                <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontWeight="600" cursor="pointer" onClick={() => setMore(true)} data-testid="votes-more">Load more</chakra.button>
            )}
            {next && more && <VotesPageView deps={deps} proposalId={proposalId} filter={filter} cursor={next} first={false} formatWeight={formatWeight} />}
        </>
    );
};

/** Who voted and with what weight (the effective one, after later reductions), filterable by option. */
export const VotesPanel = ({deps, proposalId, formatWeight}: {deps: ProposalDeps; proposalId: string; formatWeight: (amount: string) => string}) => {
    const [filter, setFilter] = useState<Filter>('all');

    return (
        <Panel id="votes" title="Votes" testId="votes-panel">
            <SegmentedTabs
                aria-label="Filter the votes"
                value={filter}
                onChange={setFilter}
                options={[{value: 'all', label: 'All'}, {value: 'YES', label: 'Yes'}, {value: 'NO', label: 'No'}, {value: 'ABSTAIN', label: 'Abstain'}]}
            />
            <Flex direction="column" gap="0">
                <VotesPageView key={filter} deps={deps} proposalId={proposalId} filter={filter === 'all' ? null : filter} cursor={null} first formatWeight={formatWeight} />
            </Flex>
        </Panel>
    );
};
