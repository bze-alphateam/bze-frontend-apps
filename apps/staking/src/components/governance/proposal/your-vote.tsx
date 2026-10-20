'use client';

import NextLink from 'next/link';
import {Box, Button, chakra, Flex, Link, SimpleGrid} from '@chakra-ui/react';
import {LuCheck, LuInfo} from 'react-icons/lu';
import {AppLink, FeaturedCard, getExplorerProposalURL, HgCard, hgVariant, Notice, Shimmer, type GovProposal} from '@bze/bze-ui-kit';
import type {ProposalVoter} from '@/hooks/useVoter';
import {isOpen, wholeBze} from '@/lib/governance/details';
import {formatDateTimeUtc, formatDateUtc} from '@/lib/governance/format';
import type {TallyOption} from '@/lib/governance/tally';
import {VOTE_CHOICES, isSplit, singleChoice, voteSummary} from '@/lib/governance/voter';
import {ConnectWallet} from '../connect-wallet';
import {TALLY_COLORS} from '../tally-bar';

// "Your vote" on the proposal page. A visitor is asked to connect; a decided
// proposal points to BZE Scan; a connected wallet on an open proposal sees its
// voting power, then either the four options (not voted) or its vote and
// Change vote. Picking an option opens the vote flow on its confirm step.

interface YourVoteProps {
    proposal: GovProposal;
    isConnected: boolean;
    voter?: ProposalVoter;
    voterLoading?: boolean;
    onVote?: (choice?: TallyOption) => void;
}

function NoStake({end}: {end?: string | null}) {
    return (
        <Notice status="warning" icon={<LuInfo />}>
            {'You have no BZE staked, so your vote has 0 voting power. Votes are counted with the BZE you have staked '}
            <chakra.strong color="fg">when voting ends</chakra.strong>
            {end ? `: stake before ${formatDateTimeUtc(end)} and your vote counts. ` : '. '}
            <Link asChild color="hg.link" fontWeight="semibold"><NextLink href="/">Stake BZE</NextLink></Link>
        </Notice>
    );
}

function Options({onVote}: {onVote?: (choice: TallyOption) => void}) {
    return (
        <SimpleGrid columns={2} gap="8px">
            {VOTE_CHOICES.map((c) => (
                <Button key={c.key} variant={hgVariant('secondary')} size={{base: 'lg', md: 'md'}} justifyContent="flex-start" onClick={() => onVote?.(c.key)}>
                    <Box aria-hidden="true" boxSize="10px" borderRadius="3px" bg={TALLY_COLORS[c.key]} flexShrink={0} />
                    {c.label}
                </Button>
            ))}
        </SimpleGrid>
    );
}

function Connected({proposal, voter, voterLoading, onVote}: Omit<YourVoteProps, 'isConnected'>) {
    if (!voter) {
        if (voterLoading) {
            return (
                <Flex direction="column" gap="8px" aria-busy="true" aria-label="Loading your vote">
                    <Shimmer h="16px" w="70%" />
                    <Shimmer h="40px" borderRadius="hg.md" />
                    <Shimmer h="40px" borderRadius="hg.md" />
                </Flex>
            );
        }
        return <chakra.span fontSize="14px" color="fg.muted">{"Your vote and voting power didn't load. Reload the page to try again."}</chakra.span>;
    }

    const end = proposal.voting_end_time;
    const noStake = !voter.power.power.gt(0);
    const single = singleChoice(voter.vote);

    return (
        <>
            {voter.power.inactive.gt(0) && (
                <chakra.span fontSize="13px" color="fg.muted">{`${wholeBze(voter.power.inactive)} BZE with inactive validators doesn't count.`}</chakra.span>
            )}
            {noStake && <NoStake end={end} />}
            {voter.vote ? (
                <>
                    <Flex alignSelf="flex-start" align="center" gap="6px" px="10px" py="4px" borderRadius="8px" bg={single?.key === 'yes' ? 'hg.up/12' : 'hg.inset'} color={single?.key === 'yes' ? 'hg.up' : 'fg'} fontSize="14px" fontWeight="700">
                        <LuCheck size={14} />
                        <chakra.span>{single ? `You voted ${single.label}` : `You split your vote: ${voteSummary(voter.vote)}`}</chakra.span>
                    </Flex>
                    <chakra.span fontSize="13px" lineHeight="1.5" color="fg.muted">
                        {isSplit(voter.vote)
                            ? `Voting here replaces it with one choice${end ? `. You can change it until ${formatDateTimeUtc(end)}` : ''}.`
                            : `Your vote counts for all your staked BZE, replacing your validators' votes.${end ? ` You can change it until ${formatDateTimeUtc(end)}; your last vote is the one that counts.` : ''}`}
                    </chakra.span>
                    <Button variant={hgVariant('secondary')} size={{base: 'lg', md: 'md'}} onClick={() => onVote?.()}>Change vote</Button>
                </>
            ) : (
                <>
                    {!noStake && <chakra.span fontSize="14px" color="fg.muted">{"You haven't voted yet. Pick an option:"}</chakra.span>}
                    <Options onVote={onVote} />
                </>
            )}
        </>
    );
}

export function YourVote({proposal, isConnected, voter, voterLoading, onVote}: YourVoteProps) {
    const open = isOpen(proposal);
    const highlight = open && (!isConnected || !voter?.vote);

    const body = (
        <>
            <Flex justify="space-between" align="baseline" gap="12px" wrap="wrap">
                <chakra.h2 id="vote-h" m="0" fontSize="17px" fontWeight="700">Your vote</chakra.h2>
                {open && isConnected && voter && (
                    <chakra.span fontSize="13px" color="fg.muted">
                        {'Voting power '}<chakra.strong color="fg">{`${wholeBze(voter.power.power)} BZE`}</chakra.strong>
                    </chakra.span>
                )}
            </Flex>
            {!open && (
                <>
                    {proposal.voting_end_time && (
                        <chakra.strong fontSize="14px">{`Voting ended on ${formatDateUtc(proposal.voting_end_time)}.`}</chakra.strong>
                    )}
                    <chakra.span fontSize="13px" lineHeight="1.5" color="fg.muted">
                        {"The chain clears individual votes once a proposal is decided, so this app can't show how you voted. The Explorer keeps every vote."}
                    </chakra.span>
                    <Box fontSize="13px">
                        <AppLink app="explorer" href={getExplorerProposalURL(proposal.id)} flush>Explorer</AppLink>
                    </Box>
                </>
            )}
            {open && !isConnected && (
                <>
                    <chakra.span fontSize="14px" lineHeight="1.5" color="fg.muted">Connect a wallet to vote. Your voting power is the BZE you have staked.</chakra.span>
                    <ConnectWallet />
                </>
            )}
            {open && isConnected && (
                <Connected proposal={proposal} voter={voter} voterLoading={voterLoading} onVote={onVote} />
            )}
        </>
    );

    // The featured card while a vote is still to be cast; the plain card once voted or decided.
    const layout = {display: 'flex', flexDirection: 'column', gap: '14px', p: {base: '16px', md: '20px'}} as const;
    return (
        <Box as="section" aria-labelledby="vote-h" data-highlight={highlight || undefined}>
            {highlight ? <FeaturedCard {...layout}>{body}</FeaturedCard> : <HgCard {...layout}>{body}</HgCard>}
        </Box>
    );
}
