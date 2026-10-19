'use client';

import {useCallback, useMemo, useState} from 'react';
import NextLink from 'next/link';
import {useParams} from 'next/navigation';
import {Box, Button, chakra, Flex, Link} from '@chakra-ui/react';
import {LuArrowLeft, LuCircleAlert, LuClock} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {AppLink, getChainName, getExplorerProposalURL, HeroGlow, HgCard, hgVariant, Notice, PageContainer, PageState, Shimmer, StatusPill, useAssets, useValidatorLogos, type GovProposal, type GovVote} from '@bze/bze-ui-kit';
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
import {ProposalStatusPill} from '@/components/governance/pills';

// One proposal: what it does, its description, the tally, the timeline, the
// vote panel and (connected, open) the wallet's validators' votes. Desktop has
// a content column and a side column; on a phone the columns dissolve
// (`display: contents`) and `order` puts the vote first, then the validators'
// votes, what it does, the description, the tally and the timeline.

function BackLink() {
    return (
        <Link asChild alignSelf="flex-start" fontSize="14px" fontWeight="500" color="hg.text.secondary" _hover={{color: 'fg'}}>
            <NextLink href="/governance"><LuArrowLeft />All proposals</NextLink>
        </Link>
    );
}

function LoadingState() {
    return (
        <Flex direction="column" gap="16px" aria-busy="true" aria-label="Loading proposal">
            <Shimmer w="220px" h="18px" />
            <Shimmer w="520px" maxW="full" h="32px" />
            <Flex gap="24px" wrap="wrap" mt="12px">
                <Shimmer flex="999 1 560px" h={{base: '240px', md: '520px'}} borderRadius="hg.lg" />
                <Shimmer flex="1 1 360px" maxW={{md: '400px'}} h={{base: '200px', md: '520px'}} borderRadius="hg.lg" />
            </Flex>
        </Flex>
    );
}

function Problem({title, text, onRetry}: {title: string; text: string; onRetry?: () => void}) {
    return (
        <HgCard role="alert" p="0" borderStyle="dashed" borderColor={onRetry ? 'hg.danger/35' : 'hg.hairline'}>
            <PageState
                kind="not-found"
                icon={onRetry ? <LuCircleAlert /> : undefined}
                title={title}
                description={text}
                action={
                    <Flex direction={{base: 'column', md: 'row'}} gap="8px">
                        {onRetry && <Button variant={hgVariant('secondary')} size={{base: 'lg', md: 'md'}} onClick={onRetry}>Try again</Button>}
                        <Button asChild variant={hgVariant('primary')} size={{base: 'lg', md: 'md'}}>
                            <NextLink href="/governance">All proposals</NextLink>
                        </Button>
                    </Flex>
                }
            />
        </HgCard>
    );
}

function Header({proposal, now}: {proposal: GovProposal; now: Date}) {
    const status = statusInfo(proposal.status);
    const end = proposal.voting_end_time;
    const open = isOpen(proposal);

    return (
        <Flex justify="space-between" align={{base: 'stretch', md: 'flex-end'}} gap="24px" wrap="wrap">
            <Flex direction="column" gap="12px" flex="999 1 560px" minW="0">
                <Flex gap="8px" wrap="wrap" align="center" fontSize="12px">
                    <chakra.span fontWeight="600" color="hg.text.faint">#{proposal.id}</chakra.span>
                    <ProposalStatusPill tone={status.tone}>{status.text}</ProposalStatusPill>
                    <StatusPill tone="neutral">{kindLabel(proposalKind(proposal))}</StatusPill>
                </Flex>
                <chakra.h1 m="0" textStyle="pageTitle" fontSize={{base: '26px', md: '36px'}} lineHeight="1.15" wordBreak="break-word">
                    {proposalTitle(proposal)}
                </chakra.h1>
                {end && (
                    <Flex align="center" gap="6px" fontSize="14px" color="fg.muted">
                        <Box hideBelow="md" color="hg.accent"><LuClock size={14} /></Box>
                        <chakra.span>
                            {open
                                ? `Voting ends in ${endsIn(end, now)} · ${formatDateTimeUtc(end)}`
                                : `Voting ended ${formatDateTimeUtc(end)}`}
                        </chakra.span>
                    </Flex>
                )}
                {proposal.status === 'PROPOSAL_STATUS_FAILED' && (
                    <Box data-testid="failed-reason">
                        <Notice status="danger" title="It passed, but the chain couldn't carry it out.">
                            {proposal.failed_reason && <chakra.span wordBreak="break-word">{proposal.failed_reason}</chakra.span>}
                        </Notice>
                    </Box>
                )}
            </Flex>
            <Box hideBelow="md" fontSize="14px">
                <AppLink app="explorer" href={getExplorerProposalURL(proposal.id)}>Explorer</AppLink>
            </Box>
        </Flex>
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

    const ready = !showLoading && !notFound && !error && !!data;

    return (
        <Box>
            <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
                <HeroGlow strength="inner" />
                <PageContainer position="relative" zIndex="1" pt={{base: '20px', md: '28px'}} pb={{base: '24px', md: '32px'}} display="flex" flexDirection="column" gap="18px">
                    <BackLink />
                    {ready && data && <Header proposal={data.proposal} now={now} />}
                </PageContainer>
            </Box>

            <PageContainer as="main" pt={{base: '20px', md: '28px'}} pb={{base: '48px', md: '64px'}}>
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

                {ready && data && (
                    <>
                        <Flex direction={{base: 'column', md: 'row'}} gap={{base: '16px', md: '24px'}} align={{md: 'flex-start'}}>
                            <Flex display={{base: 'contents', md: 'flex'}} direction="column" gap="20px" flex="999 1 560px" minW="0">
                                <Box order={{base: 3, md: 0}}>
                                    <WhatItDoes proposal={data.proposal} resolve={resolve} />
                                </Box>
                                <Box order={{base: 4, md: 0}}>
                                    <ProposalDescription summary={proposalSummary(data.proposal)} />
                                </Box>
                            </Flex>
                            <Flex as="aside" display={{base: 'contents', md: 'flex'}} direction="column" gap="20px" flex="1 1 360px" maxW={{md: '400px'}} minW="0">
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
            </PageContainer>
        </Box>
    );
}
