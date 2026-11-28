'use client';

import type {ReactNode} from 'react';
import {Button, chakra, Flex, SimpleGrid} from '@chakra-ui/react';
import {LuCheck} from 'react-icons/lu';
import {hgVariant, Shimmer} from '@bze/bze-ui-kit';
import type {AsyncValue} from '@/hooks/useAsync';
import {notCountedLine, noWeightReason, optionLabel, type MyVote} from '@/lib/proposal-loader';
import type {ProposalModel} from '@/lib/proposal-model';
import type {VoteChoice} from '@/lib/proposal-actions';
import {sourceLabel} from '@/lib/proposal-votes';
import type {ProposalActions} from './actions-slot';
import {Pill, Rows, Small} from './ui';
import {tallyWithYes, type PageTone} from '@/lib/proposal-view';

interface Props {
    actions: ProposalActions;
    model: ProposalModel;
    /** The wallet's ballot and eligible weight, read once by the page. */
    mine: AsyncValue<MyVote>;
    formatWeight: (amount: string) => string;
    /** Opens the wallet connection (the header's Connect). */
    onConnect: () => void;
}

const ZERO = /^0+$/;

/** The card itself: featured on the page (accent edge and glow), 20 px radius. */
const Shell = ({pill, children, featured}: {pill: ReactNode; children: ReactNode; featured: boolean}) => (
    <chakra.section
        aria-labelledby="your-vote-title"
        data-testid="your-vote"
        bg={featured ? undefined : 'hg.card'}
        bgImage={featured ? 'linear-gradient(160deg, color-mix(in srgb, var(--chakra-colors-hg-accent) 10%, transparent), var(--chakra-colors-hg-card) 55%)' : undefined}
        borderWidth="1px"
        borderColor={featured ? 'hg.accent/40' : 'hg.hairline'}
        borderRadius={featured ? '20px' : '16px'}
        boxShadow={featured ? 'hg.featured' : undefined}
        p={{base: '16px', md: '24px'}}
        display="flex"
        flexDirection="column"
        gap={{base: '10px', md: '12px'}}
        minW="0"
    >
        <Flex gap="16px" align="center" justify="space-between" wrap="wrap">
            <chakra.h2 id="your-vote-title" m="0" fontSize="17px" fontWeight="700">Your vote</chakra.h2>
            {pill}
        </Flex>
        {children}
    </chakra.section>
);

const Text = ({children, testId, strong}: {children: ReactNode; testId?: string; strong?: boolean}) => (
    <chakra.p m="0" fontSize={strong ? '15px' : '13px'} lineHeight="1.55" color={strong ? 'fg' : 'hg.text.secondary'} data-testid={testId}>{children}</chakra.p>
);

/** "Your vote counts for 30,000 HONEY", the accent box. */
const WeightBox = ({weight}: {weight: string}) => (
    <Flex justify="space-between" gap="8px" px="12px" py="10px" borderRadius="12px" bg="hg.accent/6" borderWidth="1px" borderColor="hg.accent/30" fontSize="13px" data-testid="vote-weight-note">
        <chakra.span color="fg.muted">Your vote counts for</chakra.span>
        <strong>{weight}</strong>
    </Flex>
);

const PILL_OF: Record<VoteChoice, PageTone> = {YES: 'success', NO: 'danger', ABSTAIN: 'neutral'};
const VOTE_LABEL: Partial<Record<string, string>> = {YES: 'yes', NO: 'no', ABSTAIN: 'abstain'};

/**
 * E2 / E4 "Your vote": what the connected wallet can do on this proposal, in one of the board's states (not
 * connected, no BZE for fees, can't vote / not a member, voted, not voted, vote and settle), the stake that
 * does not count here, the proposer's cancel and the Ledger line. The buttons open the vote dialogs.
 */
export const YourVoteCard = ({actions, model, mine, formatWeight, onConnect}: Props) => {
    const {view, wallet, gas, blocked, flow} = actions;
    const vote = view.vote;
    const locked = flow.locked;
    const notCounted = mine.data?.notCounted ?? [];
    const ballot = mine.data?.ballot ?? null;
    const memberList = model.daoType === 'DAO_TYPE_STATIC_LIST';

    const notCountedLines = notCounted.map((n) => <Small key={n.source} testId="not-counted">{notCountedLine(formatWeight(n.amount), sourceLabel(n.source))}</Small>);
    const ledger = wallet && <Small testId="ledger-note">DAO transactions are signed in direct mode, which a Ledger cannot approve yet. Use a software wallet for these.</Small>;
    const cancel = view.cancel && (
        <chakra.button type="button" alignSelf="flex-start" fontSize="13px" fontWeight="600" color="hg.danger.text" cursor="pointer" disabled={!view.cancel.enabled || locked} _disabled={{opacity: 0.5, cursor: 'not-allowed'}} onClick={() => actions.open({kind: 'cancel'})} data-testid="cancel-button">
            Cancel this proposal
        </chakra.button>
    );
    const ballotRows = ballot && (
        <Rows
            labelWidth="1fr"
            size="13px"
            py="5px"
            rows={[
                {label: 'Weight', value: formatWeight(ballot.weight)},
                ...ballot.shares.map((s) => ({label: sourceLabel(s.source), value: formatWeight(s.amount), testId: 'my-ballot-share'})),
                ...notCounted.map((n) => ({label: sourceLabel(n.source), value: '0 (joined after it started)'})),
            ]}
        />
    );
    const votedPill = ballot && (VOTE_LABEL[ballot.option] ? <Pill tone={PILL_OF[ballot.option as VoteChoice]} testId="my-ballot-pill">{`Voted ${VOTE_LABEL[ballot.option]}`}</Pill> : null);

    // voting is over (or the proposal is archived): only what the wallet did
    if (!vote) {
        if (!wallet || model.archived) return null;
        if (mine.loading) return <Shell featured={false} pill={null}><Shimmer h="40px" borderRadius="12px" aria-hidden /></Shell>;
        if (ballot) return <Shell featured={false} pill={votedPill}>{ballotRows && <div data-testid="my-ballot">{ballotRows}</div>}</Shell>;
        return (
            <Shell featured={false} pill={<Pill tone="neutral">Didn&apos;t vote</Pill>}>
                <Text testId="not-voted">{mine.error ? 'Your vote could not be read from the chain right now.' : 'You did not vote on this proposal.'}</Text>
            </Shell>
        );
    }

    if (!wallet) {
        return (
            <Shell featured={false} pill={<Pill tone="neutral">Not connected</Pill>}>
                <Text testId="actions-blocked">Connect a wallet to see your voting power and vote.</Text>
                <Button variant={hgVariant('primary')} w="100%" h="40px" onClick={onConnect} data-testid="your-vote-connect">Connect</Button>
            </Shell>
        );
    }

    if (mine.loading) return <Shell featured pill={null}><Shimmer h="40px" borderRadius="12px" aria-hidden /></Shell>;

    if (vote.current) {
        return (
            <Shell featured={false} pill={<Pill tone={PILL_OF[vote.current]} testId="my-ballot-pill">{`Voted ${optionLabel(vote.current).toLowerCase()}`}</Pill>}>
                {ballotRows && <div data-testid="my-ballot">{ballotRows}</div>}
                {notCountedLines}
                <Button variant={hgVariant('secondary')} w="100%" h="40px" disabled={!vote.enabled || locked} onClick={() => actions.open({kind: 'vote', option: null})} data-testid="change-vote">Change vote</Button>
                {blocked && <Small testId="actions-blocked">{blocked}</Small>}
                {cancel}
                {ledger}
            </Shell>
        );
    }

    if (mine.error || !mine.data || vote.weight === null) {
        return (
            <Shell featured={false} pill={<Pill tone="warning">Not read</Pill>}>
                <Text testId="vote-disabled-reason">{vote.reason || 'Your voting power could not be read from the chain, so a vote is not offered. Reload to try again.'}</Text>
                {cancel}
                {ledger}
            </Shell>
        );
    }

    if (ZERO.test(vote.weight)) {
        return (
            <Shell featured={false} pill={<Pill tone="neutral">{memberList ? 'Not a member' : "Can't vote"}</Pill>}>
                <Text testId="vote-disabled-reason">{noWeightReason(model.daoType, model.daoName)}</Text>
                {notCountedLines}
                {cancel}
            </Shell>
        );
    }

    if (gas.state === 'none') {
        return (
            <Shell featured={false} pill={<Pill tone="warning">No BZE for fees</Pill>}>
                <Text testId="actions-blocked">{`${gas.reason} You need a little BZE to pay the network fee.`}</Text>
                <Button variant={hgVariant('secondary')} w="100%" h="40px" disabled data-testid="vote-open">Vote</Button>
                {notCountedLines}
                {cancel}
            </Shell>
        );
    }

    const weight = formatWeight(vote.weight);
    const buttonsOff = !vote.enabled || locked;
    const optionButton = (option: VoteChoice, label: string) => (
        <Button
            key={option}
            variant={hgVariant('secondary')}
            w="100%"
            h="40px"
            px="8px"
            disabled={buttonsOff}
            onClick={() => actions.open({kind: 'vote', option})}
            data-testid={`vote-option-${option.toLowerCase()}`}
        >
            {label}
        </Button>
    );

    if (view.voteAndSettle) {
        const after = tallyWithYes(model.tally, ballot, view.voteAndSettle.weight);
        return (
            <Shell featured pill={<Pill tone="accent">{memberList ? 'Member' : 'Staker'}</Pill>}>
                <Text strong testId="vote-and-settle">
                    {memberList && after
                        ? `Your yes makes it ${after.yes} of ${after.denominator}: it meets the expedite bars, so this proposal can pass right now.`
                        : `Your yes, counted at ${weight}, meets the expedite bars, so this proposal can pass right now.`}
                </Text>
                <Button variant={hgVariant('primary')} w="100%" h="48px" disabled={!view.voteAndSettle.enabled || locked} onClick={() => actions.open({kind: 'vote-settle'})} data-testid="vote-and-settle-button">
                    <LuCheck aria-hidden /> Vote yes and settle now
                </Button>
                <Small>{model.msgs.length > 0 ? 'One transaction: your vote, then the settle, which runs its actions straight away.' : 'One transaction: your vote, then the settle.'}</Small>
                <SimpleGrid columns={3} gap="8px">
                    {optionButton('YES', 'Just vote yes')}
                    {optionButton('NO', 'No')}
                    {optionButton('ABSTAIN', 'Abstain')}
                </SimpleGrid>
                {notCountedLines}
                {cancel}
                {ledger}
            </Shell>
        );
    }

    return (
        <Shell featured pill={<Pill tone="warning" testId="not-voted">Not voted</Pill>}>
            <WeightBox weight={weight} />
            {notCountedLines}
            <SimpleGrid columns={3} gap="8px">
                {optionButton('YES', 'Yes')}
                {optionButton('NO', 'No')}
                {optionButton('ABSTAIN', 'Abstain')}
            </SimpleGrid>
            {blocked ? <Small testId="actions-blocked">{blocked}</Small> : <Small>You can change your vote until voting ends.</Small>}
            {cancel}
            {ledger}
        </Shell>
    );
};
