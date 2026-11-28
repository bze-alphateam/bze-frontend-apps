'use client';

import {chakra, Flex} from '@chakra-ui/react';
import {Notice, Shimmer} from '@bze/bze-ui-kit';
import {Panel} from '@/components/dao/page/panel';
import type {AsyncValue} from '@/hooks/useAsync';
import {notCountedLine, noWeightReason, optionLabel, type MyVote} from '@/lib/proposal-loader';
import type {ProposalModel} from '@/lib/proposal-model';
import {sourceLabel} from '@/lib/proposal-votes';

interface Props {
    model: ProposalModel;
    /** The wallet's ballot and eligible weight, read once by the page. */
    mine: AsyncValue<MyVote>;
    formatWeight: (amount: string) => string;
}

/**
 * The connected wallet's ballot (weight and per-source shares), what a vote of it would count and, in a stake
 * DAO, the stake it holds that does not count here because it joined or added to it after the proposal started.
 */
export const MyVotePanel = ({model, mine, formatWeight}: Props) => {
    const {ballot, eligibleWeight, notCounted} = mine.data ?? {ballot: null, eligibleWeight: null, notCounted: []};

    return (
        <Panel id="my-vote" title="My vote" testId="my-vote-panel">
            {mine.loading && <Shimmer h="40px" borderRadius="12px" aria-hidden />}
            {!mine.loading && !!mine.error && <Notice status="warning">Your vote could not be read from the chain right now.</Notice>}
            {mine.data && ballot && (
                <Flex direction="column" gap="6px" data-testid="my-ballot">
                    <chakra.p m="0" fontWeight="600">{`You voted ${optionLabel(ballot.option)} with ${formatWeight(ballot.weight)}`}</chakra.p>
                    {ballot.shares.length > 0 && (
                        <Flex direction="column" gap="2px" fontSize="13px" color="fg.muted">
                            {ballot.shares.map((s) => <span key={s.source} data-testid="my-ballot-share">{`${sourceLabel(s.source)}: ${formatWeight(s.amount)}`}</span>)}
                        </Flex>
                    )}
                </Flex>
            )}
            {mine.data && !ballot && <chakra.p m="0" color="fg.muted" data-testid="not-voted">{model.status === 'VOTING' ? 'You have not voted on this proposal.' : 'You did not vote on this proposal.'}</chakra.p>}
            {mine.data && model.status === 'VOTING' && eligibleWeight !== null && (
                /^0+$/.test(eligibleWeight)
                    ? <chakra.p m="0" fontSize="14px" color="fg.muted" data-testid="eligible-none">{`Your vote would count 0. ${noWeightReason(model.daoType)}`}</chakra.p>
                    : <chakra.p m="0" fontSize="14px" data-testid="eligible">{`A vote of yours would count ${formatWeight(eligibleWeight)}.`}</chakra.p>
            )}
            {mine.data && notCounted.map((n) => (
                <chakra.p key={n.source} m="0" fontSize="13px" color="fg.muted" data-testid="not-counted">{notCountedLine(formatWeight(n.amount), sourceLabel(n.source))}</chakra.p>
            ))}
        </Panel>
    );
};
