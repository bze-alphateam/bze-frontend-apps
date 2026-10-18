'use client';

import {useState} from 'react';
import {Box, Grid, HStack, IconButton, Link, Stack, Text} from '@chakra-ui/react';
import {LuCheck, LuCopy} from 'react-icons/lu';
import {AppLink, getExplorerAccountURL, getExplorerProposalURL, truncateAddress, type GovParams, type GovProposal, type GovTally} from '@bze/bze-ui-kit';
import {coinsText, depositFate, timeline, type DenomResolver, type TimelineState} from '@/lib/governance/details';

// Timeline, proposer and deposit.

const DOT: Record<TimelineState, {bg: string; ring: string; weight: string}> = {
    done: {bg: 'fg.muted', ring: 'transparent', weight: 'medium'},
    now: {bg: 'purple.600', ring: 'purple.subtle', weight: 'bold'},
    todo: {bg: 'border', ring: 'transparent', weight: 'medium'},
    passed: {bg: 'green.600', ring: 'green.subtle', weight: 'bold'},
    rejected: {bg: 'red.600', ring: 'red.subtle', weight: 'bold'},
};

function CopyAddress({address}: {address: string}) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => undefined);
    };
    return (
        <IconButton aria-label={copied ? 'Copied' : 'Copy proposer address'} size="2xs" variant="ghost" onClick={copy}>
            {copied ? <LuCheck /> : <LuCopy />}
        </IconButton>
    );
}

interface ProposalTimelineProps {
    proposal: GovProposal;
    tally: GovTally | null;
    params: GovParams;
    now: Date;
    resolve?: DenomResolver;
}

export function ProposalTimeline({proposal, tally, params, now, resolve}: ProposalTimelineProps) {
    const items = timeline(proposal, now);
    const deposit = `${coinsText(proposal.total_deposit, resolve)} · ${depositFate(proposal, tally, params)}`;

    return (
        <Stack as="section" aria-labelledby="time-h" bg="bg.panel" borderWidth="1px" borderRadius="lg" p={{base: '4', md: '5'}} gap="3.5">
            <Text as="h2" id="time-h" fontSize="md" fontWeight="bold">Timeline</Text>
            <Box as="ol" listStyleType="none" m="0" p="0" data-testid="timeline">
                {items.map((item, i) => {
                    const dot = DOT[item.state];
                    const last = i === items.length - 1;
                    return (
                        <HStack as="li" key={item.label} align="stretch" gap="3">
                            <Stack align="center" gap="0" w="3" flex="none" aria-hidden>
                                <Box w="2.5" h="2.5" mt="1.5" borderRadius="full" bg={dot.bg} outline="3px solid" outlineColor={dot.ring} />
                                {!last && <Box flex="1" w="2px" minH="5" bg="border" />}
                            </Stack>
                            <Stack gap="0" pb={last ? '0' : '3'}>
                                <Text fontSize="sm" fontWeight={dot.weight}>{item.label}</Text>
                                <Text fontSize="xs" color="fg.muted">{item.detail}</Text>
                            </Stack>
                        </HStack>
                    );
                })}
            </Box>
            <Grid as="dl" templateColumns="auto minmax(0, 1fr)" columnGap="4" rowGap="2" fontSize="13px" borderTopWidth="1px" pt="3.5" m="0">
                <Text as="dt" color="fg.muted">Proposer</Text>
                <Box as="dd" m="0" textAlign="right">
                    {proposal.proposer ? (
                        <HStack justify="flex-end" gap="1">
                            <Link href={getExplorerAccountURL(proposal.proposer)} target="_blank" rel="noopener noreferrer" fontFamily="mono" color="purple.fg" title={proposal.proposer}>
                                {truncateAddress(proposal.proposer)}
                            </Link>
                            <CopyAddress address={proposal.proposer} />
                        </HStack>
                    ) : (
                        <Text as="span" color="fg.muted">Not recorded</Text>
                    )}
                </Box>
                <Text as="dt" color="fg.muted">Deposit</Text>
                <Text as="dd" m="0" textAlign="right" data-testid="deposit">{deposit}</Text>
            </Grid>
            <Box hideFrom="md" fontSize="13px">
                <AppLink app="explorer" href={getExplorerProposalURL(proposal.id)}>View on Explorer</AppLink>
            </Box>
        </Stack>
    );
}
