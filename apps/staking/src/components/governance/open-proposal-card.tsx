'use client';

import NextLink from 'next/link';
import {Badge, Box, Button, HStack, Link, Skeleton, Stack, Text, VStack} from '@chakra-ui/react';
import {LuCheck, LuClock} from 'react-icons/lu';
import type {GovParams} from '@bze/bze-ui-kit';
import type {OpenProposal} from '@/hooks/useGovernance';
import type {ProposalVoter} from '@/hooks/useVoter';
import {kindLabel, proposalKind, proposalTitle} from '@/lib/governance/proposal';
import {quorumStatus} from '@/lib/governance/tally';
import {endsIn, formatDateTimeUtc, formatPct} from '@/lib/governance/format';
import {wholeBze} from '@/lib/governance/details';
import {singleChoice, validatorsSentence, voteSummary} from '@/lib/governance/voter';
import {TallyBar, TallyLegend} from './tally-bar';

interface OpenProposalCardProps {
    item: OpenProposal;
    params: GovParams;
    bondedTokens: string;
    now: Date;
    isConnected: boolean;
    voter?: ProposalVoter;
    voterLoading?: boolean;
    onVote?: () => void;
}

/** Turnout against the quorum: `Turnout 74.3% · quorum 33.4% reached`. */
function Turnout({item, params, bondedTokens}: Pick<OpenProposalCardProps, 'item' | 'params' | 'bondedTokens'>) {
    const q = quorumStatus(item.tally, bondedTokens, params);
    if (q.turnout == null) return null;

    return (
        <Text as="span" fontSize="xs" color="fg.muted" ml={{md: 'auto'}}>
            {'Turnout '}<Text as="strong" color="fg">{formatPct(q.turnout)}</Text>
            {` · quorum ${formatPct(q.quorum)} `}
            {q.reached
                ? <Text as="span" color="green.fg" fontWeight="semibold">reached</Text>
                : <Text as="span" color="orange.fg" fontWeight="semibold">not reached</Text>}
        </Text>
    );
}

function ViewProposal({href}: {href: string}) {
    return (
        <Button asChild variant="outline" size={{base: 'lg', md: 'md'}}>
            <NextLink href={href}>View proposal</NextLink>
        </Button>
    );
}

/**
 * The card's "Your vote" block: a visitor is asked to connect; a wallet sees
 * its vote (Change vote), or that it hasn't voted with what its validators did
 * meanwhile (Vote), or that it has no stake.
 */
function CardVote({href, isConnected, voter, voterLoading, onVote}: Pick<OpenProposalCardProps, 'isConnected' | 'voter' | 'voterLoading' | 'onVote'> & {href: string}) {
    if (!isConnected) {
        return (
            <>
                <Text hideBelow="md" fontSize="sm" color="fg.muted">Connect a wallet with staked BZE to vote.</Text>
                <ViewProposal href={href} />
            </>
        );
    }
    if (!voter) {
        return voterLoading
            ? <VStack align="stretch" gap="2" aria-busy="true" aria-label="Loading your vote"><Skeleton h="16px" w="60%" /><Skeleton h="40px" /></VStack>
            : <ViewProposal href={href} />;
    }

    const noStake = !voter.power.power.gt(0);
    if (voter.vote) {
        const single = singleChoice(voter.vote);
        const voted = single ? single.label : `You split your vote: ${voteSummary(voter.vote)}`;
        return (
            <Stack direction={{base: 'row', md: 'column'}} align={{base: 'center', md: 'stretch'}} justify="space-between" gap="2.5">
                <VStack align="start" gap="1.5" minW="0">
                    <HStack hideBelow="md" gap="1.5" fontSize="md" fontWeight="bold" color={single?.key === 'yes' ? 'green.fg' : 'fg'}>
                        <LuCheck size={16} />
                        <Text as="span">{voted}</Text>
                    </HStack>
                    <Text hideFrom="md" fontSize="sm" fontWeight="semibold">{single ? `You voted ${single.label}` : voted}</Text>
                    <Text hideBelow="md" fontSize="13px" color="fg.muted">
                        {noStake
                            ? 'It only counts once you have BZE staked. You can change it until voting ends.'
                            : `Counts for your ${wholeBze(voter.power.power)} BZE. You can change it until voting ends.`}
                    </Text>
                </VStack>
                <Button variant="outline" size="md" flexShrink={0} onClick={onVote}>Change vote</Button>
            </Stack>
        );
    }
    if (noStake) {
        return (
            <>
                <Text hideBelow="md" fontSize="md" fontWeight="bold">0 voting power</Text>
                <Text fontSize="13px" color="fg.muted">You can vote, but it only counts once you have BZE staked.</Text>
                <ViewProposal href={href} />
            </>
        );
    }

    const meanwhile = validatorsSentence(voter.validators);
    return (
        <>
            <Text hideBelow="md" fontSize="md" fontWeight="bold">{"You haven't voted yet"}</Text>
            {meanwhile && <Text hideBelow="md" fontSize="13px" color="fg.muted">{`Meanwhile: ${meanwhile}`}</Text>}
            <Text hideFrom="md" fontSize="13px" color="fg.muted">
                <Text as="strong" color="fg">{"You haven't voted yet."}</Text>{meanwhile ? ` ${meanwhile}` : ''}
            </Text>
            <Button colorPalette="purple" size={{base: 'lg', md: 'md'}} onClick={onVote}>Vote</Button>
        </>
    );
}

export function OpenProposalCard({item, params, bondedTokens, now, isConnected, voter, voterLoading, onVote}: OpenProposalCardProps) {
    const {proposal} = item;
    const href = `/governance/${proposal.id}`;
    const end = proposal.voting_end_time;

    return (
        <Box
            as="article"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="purple.500/25"
            borderRadius="lg"
            px={{base: '4', md: '6'}}
            py={{base: '4', md: '5'}}
        >
            <Stack direction={{base: 'column', md: 'row'}} gap={{base: '3', md: '8'}} align="stretch">
                <VStack align="stretch" gap={{base: '3', md: '3.5'}} flex="999 1 0" minW="0">
                    <HStack gap="2" flexWrap="wrap" fontSize="xs">
                        <Text fontWeight="semibold" color="fg.muted">#{proposal.id}</Text>
                        <Badge colorPalette="purple" variant="subtle">Voting</Badge>
                        <Badge variant="subtle">{kindLabel(proposalKind(proposal))}</Badge>
                    </HStack>
                    <Link asChild fontSize={{base: 'md', md: 'lg'}} fontWeight="bold" color="fg" lineHeight="1.3">
                        <NextLink href={href}>{proposalTitle(proposal)}</NextLink>
                    </Link>
                    {end && (
                        <HStack gap="1.5" fontSize="sm" color="fg.muted">
                            <Box hideBelow="md"><LuClock size={14} /></Box>
                            <Text as="span">
                                {'Ends in '}<Text as="strong" color="fg">{endsIn(end, now)}</Text>
                                {` · ${formatDateTimeUtc(end)}`}
                            </Text>
                        </HStack>
                    )}
                    <VStack align="stretch" gap="2">
                        <TallyBar tally={item.tally} />
                        <Box
                            display={{base: 'grid', md: 'flex'}}
                            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                            flexWrap="wrap"
                            gap={{base: '1 3', md: '4.5'}}
                            alignItems="center"
                        >
                            <TallyLegend tally={item.tally} />
                            <Box gridColumn="1 / -1" display="flex" flex={{md: '1'}}>
                                <Turnout item={item} params={params} bondedTokens={bondedTokens} />
                            </Box>
                        </Box>
                    </VStack>
                </VStack>

                <VStack
                    align="stretch"
                    justify="center"
                    gap="2.5"
                    flex="1 1 260px"
                    maxW={{md: '320px'}}
                    borderLeftWidth={{base: '0', md: '1px'}}
                    borderTopWidth={{base: '1px', md: '0'}}
                    pl={{base: '0', md: '7'}}
                    pt={{base: '3', md: '0'}}
                    data-testid="card-vote"
                >
                    <Text hideBelow="md" fontSize="xs" fontWeight="medium" color="fg.muted">Your vote</Text>
                    <CardVote href={href} isConnected={isConnected} voter={voter} voterLoading={voterLoading} onVote={onVote} />
                </VStack>
            </Stack>
        </Box>
    );
}
