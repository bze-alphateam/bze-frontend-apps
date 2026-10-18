'use client';

import {useCallback, useMemo, useState} from 'react';
import NextLink from 'next/link';
import {useParams} from 'next/navigation';
import {Badge, Box, Button, Container, Flex, HStack, Link, Skeleton, Stack, Text, VStack} from '@chakra-ui/react';
import {LuArrowLeft, LuCircleAlert, LuClock} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {AppLink, getChainName, getExplorerProposalURL, useAssets, useValidatorLogos, type GovProposal, type GovVote} from '@bze/bze-ui-kit';
import {useProposal} from '@/hooks/useProposal';
import {useNow} from '@/hooks/useNow';
import {useVoter} from '@/hooks/useVoter';
import {kindLabel, proposalKind, proposalSummary, proposalTitle, statusInfo} from '@/lib/governance/proposal';
import {endsIn, formatDateTimeUtc} from '@/lib/governance/format';
import {isOpen, type DenomResolver} from '@/lib/governance/details';
import type {TallyOption} from '@/lib/governance/tally';
import {WhatItDoes} from '@/components/governance/proposal/what-it-does';
import {ProposalDescription} from '@/components/governance/proposal/proposal-description';
import {ProposalTally} from '@/components/governance/proposal/proposal-tally';
import {ProposalTimeline} from '@/components/governance/proposal/proposal-timeline';
import {YourVote} from '@/components/governance/proposal/your-vote';
import {ValidatorVotes} from '@/components/governance/proposal/validator-votes';
import {VoteFlow} from '@/components/governance/vote-flow';

// One proposal: what it does, its description, the tally, the timeline, the
// vote panel and (connected, open) the wallet's validators' votes. Desktop has
// a content column and a side column; on a phone the columns dissolve
// (`display: contents`) and `order` puts the vote first, then the validators'
// votes, what it does, the description, the tally and the timeline.

const BADGE_PALETTE = {purple: 'purple', green: 'green', red: 'red', gray: 'gray'} as const;

function BackLink() {
    return (
        <Link asChild alignSelf="flex-start" fontSize="sm" fontWeight="medium" color="fg.muted">
            <NextLink href="/governance"><LuArrowLeft />All proposals</NextLink>
        </Link>
    );
}

function LoadingState() {
    return (
        <VStack aria-busy="true" aria-label="Loading proposal" align="stretch" gap="4">
            <Skeleton w="220px" h="20px" />
            <Skeleton w="520px" maxW="full" h="32px" />
            <Flex gap="6" wrap="wrap" mt="3">
                <Skeleton flex="999 1 560px" h={{base: '240px', md: '520px'}} borderRadius="lg" />
                <Skeleton flex="1 1 360px" maxW={{md: '400px'}} h={{base: '200px', md: '520px'}} borderRadius="lg" />
            </Flex>
        </VStack>
    );
}

function Problem({title, text, onRetry}: {title: string; text: string; onRetry?: () => void}) {
    return (
        <VStack role="alert" bg="bg.panel" borderWidth="1px" borderStyle="dashed" borderRadius="lg" py={{base: '10', md: '14'}} px="6" gap="2" textAlign="center">
            <Box hideBelow="md" color="fg.muted"><LuCircleAlert size={22} /></Box>
            <Text fontSize="lg" fontWeight="bold">{title}</Text>
            <Text fontSize="sm" color="fg.muted" maxW="460px">{text}</Text>
            <Stack direction={{base: 'column', md: 'row'}} gap="2" mt="2" w={{base: 'full', md: 'auto'}}>
                {onRetry && <Button variant="outline" size={{base: 'lg', md: 'sm'}} onClick={onRetry}>Try again</Button>}
                <Button asChild colorPalette="purple" size={{base: 'lg', md: 'sm'}}>
                    <NextLink href="/governance">All proposals</NextLink>
                </Button>
            </Stack>
        </VStack>
    );
}

function Header({proposal, now}: {proposal: GovProposal; now: Date}) {
    const status = statusInfo(proposal.status);
    const end = proposal.voting_end_time;
    const open = isOpen(proposal);

    return (
        <Stack direction={{base: 'column', md: 'row'}} justify="space-between" align={{base: 'stretch', md: 'flex-end'}} gap="4">
            <VStack align="stretch" gap="2.5" flex="999 1 560px" minW="0">
                <HStack gap="2" flexWrap="wrap" fontSize="xs">
                    <Text fontWeight="semibold" color="fg.muted">#{proposal.id}</Text>
                    <Badge colorPalette={BADGE_PALETTE[status.tone]} variant="subtle">{status.text}</Badge>
                    <Badge variant="subtle">{kindLabel(proposalKind(proposal))}</Badge>
                </HStack>
                <Text as="h1" fontSize={{base: 'xl', md: '3xl'}} fontWeight="bold" lineHeight="1.2" wordBreak="break-word">
                    {proposalTitle(proposal)}
                </Text>
                {end && (
                    <HStack gap="1.5" fontSize="sm" color="fg.muted">
                        <Box hideBelow="md"><LuClock size={14} /></Box>
                        <Text as="span">
                            {open
                                ? `Voting ends in ${endsIn(end, now)} · ${formatDateTimeUtc(end)}`
                                : `Voting ended ${formatDateTimeUtc(end)}`}
                        </Text>
                    </HStack>
                )}
                {proposal.status === 'PROPOSAL_STATUS_FAILED' && (
                    <Box bg="red.subtle" borderWidth="1px" borderColor="red.500/30" borderRadius="lg" px="3.5" py="2.5" fontSize="sm" data-testid="failed-reason">
                        <Text fontWeight="semibold" color="red.fg">It passed, but the chain couldn&apos;t carry it out.</Text>
                        {proposal.failed_reason && <Text color="fg.muted" wordBreak="break-word">{proposal.failed_reason}</Text>}
                    </Box>
                )}
            </VStack>
            <Box hideBelow="md" fontSize="13px">
                <AppLink app="explorer" href={getExplorerProposalURL(proposal.id)}>View on Explorer</AppLink>
            </Box>
        </Stack>
    );
}

export default function ProposalPage() {
    const params = useParams<{id: string}>();
    const id = params?.id ?? '';
    const {address, status} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {data, isLoading, notFound, error, reload, refreshTally} = useProposal(id);
    const now = useNow();
    const {getAsset} = useAssets();
    const resolve: DenomResolver = useCallback((denom: string) => {
        const asset = getAsset(denom);
        return asset ? {ticker: asset.ticker, decimals: asset.decimals} : undefined;
    }, [getAsset]);

    const openId = data && isOpen(data.proposal) ? data.proposal.id : null;
    const voterIds = useMemo(() => (openId ? [openId] : []), [openId]);
    const {voterFor, isLoading: voterLoading, refresh: refreshVote} = useVoter(isConnected ? address : undefined, voterIds);
    const voter = openId ? voterFor(openId) : undefined;
    const delegated = useMemo(() => voter?.validators.map((v) => v.validator) ?? [], [voter]);
    const {logos} = useValidatorLogos(delegated);
    // The flow keeps the power and vote it opened with, so it stays put if the proposal reloads under it.
    const [flow, setFlow] = useState<{choice?: TallyOption; power: BigNumber; vote: GovVote | null} | null>(null);
    const openFlow = (choice?: TallyOption) => voter && setFlow({choice, power: voter.power.power, vote: voter.vote});

    const showLoading = isLoading && !data;

    return (
        <Container maxW="7xl" py="5" pb="12">
            <VStack align="stretch" gap="5">
                <BackLink />

                {showLoading && <LoadingState />}
                {!showLoading && notFound && (
                    <Problem
                        title={`Proposal #${id} not found`}
                        text="It doesn't exist yet, or it is still waiting for its deposit."
                    />
                )}
                {!showLoading && !notFound && !!error && (
                    <Problem
                        title={`We couldn't load proposal #${id}`}
                        text="The BeeZee node didn't answer. Try again in a moment."
                        onRetry={reload}
                    />
                )}

                {!showLoading && !notFound && !error && data && (
                    <>
                        <Header proposal={data.proposal} now={now} />
                        <Flex direction={{base: 'column', md: 'row'}} gap={{base: '4', md: '6'}} align={{md: 'flex-start'}}>
                            <Flex display={{base: 'contents', md: 'flex'}} direction="column" gap="5" flex="999 1 560px" minW="0">
                                <Box order={{base: 3, md: 0}}>
                                    <WhatItDoes proposal={data.proposal} resolve={resolve} />
                                </Box>
                                <Box order={{base: 4, md: 0}}>
                                    <ProposalDescription summary={proposalSummary(data.proposal)} />
                                </Box>
                            </Flex>
                            <Flex as="aside" display={{base: 'contents', md: 'flex'}} direction="column" gap="5" flex="1 1 360px" maxW={{md: '400px'}} minW="0">
                                <Box order={{base: 1, md: 0}}>
                                    <YourVote
                                        proposal={data.proposal}
                                        isConnected={isConnected}
                                        voter={voter}
                                        voterLoading={voterLoading}
                                        onVote={openFlow}
                                    />
                                </Box>
                                <Box order={{base: 5, md: 0}}>
                                    <ProposalTally proposal={data.proposal} tally={data.tally} params={data.params} bondedTokens={data.bondedTokens} />
                                </Box>
                                {isConnected && voter && voter.validators.length > 0 && (
                                    <Box order={{base: 2, md: 0}}>
                                        <ValidatorVotes voter={voter} logos={logos} />
                                    </Box>
                                )}
                                <Box order={{base: 6, md: 0}}>
                                    <ProposalTimeline proposal={data.proposal} tally={data.tally} params={data.params} now={now} resolve={resolve} />
                                </Box>
                            </Flex>
                        </Flex>
                        {flow && (
                            <VoteFlow
                                proposal={data.proposal}
                                params={data.params}
                                power={flow.power}
                                currentVote={flow.vote}
                                initialChoice={flow.choice}
                                resolve={resolve}
                                onClose={() => setFlow(null)}
                                onVoted={() => {
                                    refreshVote(data.proposal.id);
                                    refreshTally();
                                }}
                                onEnded={reload}
                            />
                        )}
                    </>
                )}
            </VStack>
        </Container>
    );
}
