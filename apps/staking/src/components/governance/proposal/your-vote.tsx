'use client';

import NextLink from 'next/link';
import {Box, Button, HStack, Link, SimpleGrid, Skeleton, Stack, Text, VStack} from '@chakra-ui/react';
import {LuCheck, LuInfo} from 'react-icons/lu';
import {getExplorerProposalURL, type GovProposal} from '@bze/bze-ui-kit';
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
        <HStack align="flex-start" gap="2.5" bg="orange.500/8" borderWidth="1px" borderColor="orange.500/30" borderRadius="md" px="3" py="2.5" fontSize="13px" color="fg.muted">
            <Box color="orange.fg" mt="0.5" flexShrink={0}><LuInfo size={15} /></Box>
            <Text>
                {'You have no BZE staked, so your vote has 0 voting power. Votes are counted with the BZE you have staked '}
                <Text as="strong" color="fg">when voting ends</Text>
                {end ? `: stake before ${formatDateTimeUtc(end)} and your vote counts. ` : '. '}
                <Link asChild color="purple.fg" fontWeight="semibold"><NextLink href="/">Stake BZE</NextLink></Link>
            </Text>
        </HStack>
    );
}

function Options({onVote}: {onVote?: (choice: TallyOption) => void}) {
    return (
        <SimpleGrid columns={2} gap="2">
            {VOTE_CHOICES.map((c) => (
                <Button key={c.key} variant="outline" size={{base: 'lg', md: 'md'}} justifyContent="flex-start" onClick={() => onVote?.(c.key)}>
                    <Box aria-hidden="true" w="2.5" h="2.5" borderRadius="xs" bg={TALLY_COLORS[c.key]} flexShrink={0} />
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
                <VStack align="stretch" gap="2" aria-busy="true" aria-label="Loading your vote">
                    <Skeleton h="16px" w="70%" />
                    <Skeleton h="40px" />
                    <Skeleton h="40px" />
                </VStack>
            );
        }
        return <Text fontSize="sm" color="fg.muted">{"Your vote and voting power didn't load. Reload the page to try again."}</Text>;
    }

    const end = proposal.voting_end_time;
    const noStake = !voter.power.power.gt(0);
    const single = singleChoice(voter.vote);

    return (
        <>
            {voter.power.inactive.gt(0) && (
                <Text fontSize="13px" color="fg.muted">{`${wholeBze(voter.power.inactive)} BZE with inactive validators doesn't count.`}</Text>
            )}
            {noStake && <NoStake end={end} />}
            {voter.vote ? (
                <>
                    <HStack alignSelf="flex-start" gap="1.5" px="2.5" py="1" borderRadius="md" bg={single?.key === 'yes' ? 'green.subtle' : 'bg.muted'} color={single?.key === 'yes' ? 'green.fg' : 'fg'} fontSize="sm" fontWeight="bold">
                        <LuCheck size={14} />
                        <Text as="span">{single ? `You voted ${single.label}` : `You split your vote: ${voteSummary(voter.vote)}`}</Text>
                    </HStack>
                    <Text fontSize="13px" color="fg.muted">
                        {isSplit(voter.vote)
                            ? `Voting here replaces it with one choice${end ? `. You can change it until ${formatDateTimeUtc(end)}` : ''}.`
                            : `Your vote counts for all your staked BZE, replacing your validators' votes.${end ? ` You can change it until ${formatDateTimeUtc(end)}; your last vote is the one that counts.` : ''}`}
                    </Text>
                    <Button variant="outline" size={{base: 'lg', md: 'md'}} onClick={() => onVote?.()}>Change vote</Button>
                </>
            ) : (
                <>
                    {!noStake && <Text fontSize="sm" color="fg.muted">{"You haven't voted yet. Pick an option:"}</Text>}
                    <Options onVote={onVote} />
                </>
            )}
        </>
    );
}

export function YourVote({proposal, isConnected, voter, voterLoading, onVote}: YourVoteProps) {
    const open = isOpen(proposal);
    const highlight = open && (!isConnected || !voter?.vote);

    return (
        <Stack
            as="section"
            aria-labelledby="vote-h"
            bg="bg.panel"
            borderWidth="1px"
            borderColor={highlight ? 'purple.500/25' : 'border'}
            borderRadius="lg"
            p={{base: '4', md: '5'}}
            gap="3.5"
        >
            <HStack justify="space-between" gap="3" flexWrap="wrap">
                <Text as="h2" id="vote-h" fontSize="md" fontWeight="bold">Your vote</Text>
                {open && isConnected && voter && (
                    <Text fontSize="13px" color="fg.muted">
                        {'Voting power '}<Text as="strong" color="fg">{`${wholeBze(voter.power.power)} BZE`}</Text>
                    </Text>
                )}
            </HStack>
            {!open && (
                <>
                    {proposal.voting_end_time && (
                        <Text fontSize="sm" fontWeight="semibold">{`Voting ended on ${formatDateUtc(proposal.voting_end_time)}.`}</Text>
                    )}
                    <Text fontSize="13px" color="fg.muted">
                        {"The chain clears individual votes once a proposal is decided, so this app can't show how you voted. BZE Scan keeps every vote."}
                    </Text>
                    <Link href={getExplorerProposalURL(proposal.id)} target="_blank" rel="noopener noreferrer" fontSize="13px" fontWeight="semibold" color="purple.fg">
                        See all votes on BZE Scan ↗
                    </Link>
                </>
            )}
            {open && !isConnected && (
                <>
                    <Text fontSize="sm" color="fg.muted">Connect a wallet to vote. Your voting power is the BZE you have staked.</Text>
                    <ConnectWallet />
                </>
            )}
            {open && isConnected && (
                <Connected proposal={proposal} voter={voter} voterLoading={voterLoading} onVote={onVote} />
            )}
        </Stack>
    );
}
