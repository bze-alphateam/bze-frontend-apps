'use client';

import NextLink from 'next/link';
import {Badge, Box, Button, HStack, Link, Stack, Text, VStack} from '@chakra-ui/react';
import {LuClock} from 'react-icons/lu';
import type {GovParams} from '@bze/bze-ui-kit';
import type {OpenProposal} from '@/hooks/useGovernance';
import {kindLabel, proposalKind, proposalTitle} from '@/lib/governance/proposal';
import {quorumStatus} from '@/lib/governance/tally';
import {endsIn, formatDateTimeUtc, formatPct} from '@/lib/governance/format';
import {TallyBar, TallyLegend} from './tally-bar';

interface OpenProposalCardProps {
    item: OpenProposal;
    params: GovParams;
    bondedTokens: string;
    now: Date;
    isConnected: boolean;
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

export function OpenProposalCard({item, params, bondedTokens, now, isConnected}: OpenProposalCardProps) {
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

                {/* Your vote: the wallet-free variants. Voting power and the vote itself come with the vote flow. */}
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
                >
                    <Text hideBelow="md" fontSize="xs" fontWeight="medium" color="fg.muted">Your vote</Text>
                    {!isConnected && (
                        <Text hideBelow="md" fontSize="sm" color="fg.muted">Connect a wallet with staked BZE to vote.</Text>
                    )}
                    <Button asChild variant="outline" size={{base: 'lg', md: 'md'}}>
                        <NextLink href={href}>View proposal</NextLink>
                    </Button>
                </VStack>
            </Stack>
        </Box>
    );
}
