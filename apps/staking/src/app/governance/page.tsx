'use client';

import {useMemo, useState} from 'react';
import NextLink from 'next/link';
import {Box, Button, Container, HStack, Link, Skeleton, Stack, Text, VStack} from '@chakra-ui/react';
import {LuCircleAlert, LuLandmark} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {getChainName, type GovProposal, type GovVote} from '@bze/bze-ui-kit';
import {useGovernance} from '@/hooks/useGovernance';
import {useNow} from '@/hooks/useNow';
import {useVoter} from '@/hooks/useVoter';
import type {VotingPower} from '@/lib/governance/voter';
import {wholeBze} from '@/lib/governance/details';
import {RulesStrip} from '@/components/governance/rules-strip';
import {OpenProposalCard} from '@/components/governance/open-proposal-card';
import {FinishedProposals} from '@/components/governance/finished-proposals';
import {ConnectWallet} from '@/components/governance/connect-wallet';
import {VoteFlow} from '@/components/governance/vote-flow';

/** The voting power card: a visitor is asked to connect; a wallet sees its power. */
function VotingPowerCard({isConnected, isLoading, power, failed}: {isConnected: boolean; isLoading: boolean; power?: VotingPower; failed?: boolean}) {
    if (isLoading || (isConnected && !power && !failed)) {
        return <Skeleton hideBelow={isConnected ? undefined : 'md'} flex="1 1 300px" maxW={{md: '360px'}} h="76px" borderRadius="lg" />;
    }

    const count = power?.validators.length ?? 0;
    const noStake = !!power && !power.power.gt(0);

    return (
        <Box
            flex="1 1 300px"
            maxW={{md: '360px'}}
            bg={{base: isConnected ? 'bg.panel' : undefined, md: 'bg.panel'}}
            borderWidth={{base: isConnected ? '1px' : '0', md: '1px'}}
            borderRadius="lg"
            px={{base: isConnected ? '4' : '0', md: '4.5'}}
            py={{base: isConnected ? '3' : '0', md: '3.5'}}
            data-testid="voting-power"
        >
            {isConnected && !power && (
                <Text fontSize="sm" color="fg.muted">{"Your voting power didn't load. Reload the page to try again."}</Text>
            )}
            {power && (
                <VStack align="start" gap="0.5">
                    <Text fontSize="xs" fontWeight="medium" color="fg.muted">Your voting power</Text>
                    <Text fontSize="xl" fontWeight="bold">{`${wholeBze(power.power)} BZE`}</Text>
                    <Text fontSize="xs" color="fg.muted">
                        {noStake ? 'You have no BZE staked.' : `Staked with ${count} ${count === 1 ? 'validator' : 'validators'}`}
                    </Text>
                    {power.inactive.gt(0) && (
                        <Text fontSize="xs" color="fg.muted">{`${wholeBze(power.inactive)} BZE with inactive validators doesn't count.`}</Text>
                    )}
                    {noStake && (
                        <Link asChild mt="1" fontSize="sm" fontWeight="semibold" color="purple.fg">
                            <NextLink href="/">Stake BZE to get voting power →</NextLink>
                        </Link>
                    )}
                </VStack>
            )}
            {!isConnected && (
                <VStack align="stretch" gap="2.5">
                    <Text hideBelow="md" fontSize="sm" color="fg.muted">Connect your wallet to see your voting power and vote.</Text>
                    <ConnectWallet phoneLabel="Connect Wallet to vote" />
                </VStack>
            )}
        </Box>
    );
}

function LoadingState() {
    return (
        <VStack aria-busy="true" aria-label="Loading proposals" align="stretch" gap="4">
            <Skeleton w="200px" h="22px" />
            <Skeleton h={{base: '300px', md: '168px'}} borderRadius="lg" />
            <Skeleton w="120px" h="22px" mt="4" />
            {[1, 2, 3].map((i) => <Skeleton key={i} h={{base: '88px', md: '56px'}} borderRadius="lg" />)}
        </VStack>
    );
}

function ErrorState({onRetry}: {onRetry: () => void}) {
    return (
        <Stack
            role="alert"
            direction={{base: 'column', md: 'row'}}
            bg="red.subtle"
            borderWidth="1px"
            borderColor="red.500/30"
            borderRadius="lg"
            p={{base: '4', md: '6'}}
            gap={{base: '2', md: '4'}}
            align={{base: 'stretch', md: 'flex-start'}}
        >
            <Box hideBelow="md" color="red.fg" mt="0.5"><LuCircleAlert size={20} /></Box>
            <VStack align="start" gap="1" flex="1">
                <Text fontWeight="bold" color="red.fg">Couldn&apos;t load proposals</Text>
                <Text fontSize="sm" color="fg.muted">
                    {"The BeeZee node didn't answer. Your stake and your votes are not affected. Try again in a moment."}
                </Text>
            </VStack>
            <Button variant="outline" colorPalette="red" size={{base: 'lg', md: 'sm'}} onClick={onRetry}>Try again</Button>
        </Stack>
    );
}

function EmptyState() {
    return (
        <VStack bg="bg.panel" borderWidth="1px" borderStyle="dashed" borderRadius="lg" py={{base: '10', md: '14'}} px="6" gap="2" textAlign="center">
            <Box hideBelow="md" w="12" h="12" borderRadius="full" bg="purple.subtle" color="purple.fg" display="flex" alignItems="center" justifyContent="center">
                <LuLandmark size={22} />
            </Box>
            <Text fontSize="lg" fontWeight="bold">No proposals yet</Text>
            <Text fontSize="sm" color="fg.muted" maxW="420px">
                When a proposal is put to a vote, it shows up here and you can vote with your staked BZE.
            </Text>
        </VStack>
    );
}

function NoneOpen() {
    return (
        <VStack bg="bg.panel" borderWidth="1px" borderStyle="dashed" borderRadius="lg" py={{base: '6', md: '8'}} px="6" gap="1" textAlign="center">
            <Text fontWeight="bold">No proposals are open for voting right now</Text>
            <Text fontSize="sm" color="fg.muted">
                {"New proposals show up here as soon as voting starts. We'll flag them on your dashboard too."}
            </Text>
        </VStack>
    );
}

export default function GovernancePage() {
    const {address, status} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {data, isLoading, error, reload, refreshTallies, loadOlder, hasOlder, isLoadingOlder, olderError} = useGovernance();
    const now = useNow();
    const openIdsKey = data?.open.map((o) => o.proposal.id).join(',') ?? '';
    const openIds = useMemo(() => (openIdsKey ? openIdsKey.split(',') : []), [openIdsKey]);
    const voter = useVoter(isConnected ? address : undefined, openIds);
    // The flow keeps what it opened with, so it stays put if the list reloads under it.
    const [flow, setFlow] = useState<{proposal: GovProposal; power: BigNumber; vote: GovVote | null} | null>(null);

    const showLoading = isLoading && !data;
    const showError = !showLoading && !!error;
    const isEmpty = !!data && data.open.length === 0 && data.finished.length === 0 && !hasOlder;
    const showData = !showLoading && !showError && !!data && !isEmpty;

    return (
        <Container maxW="7xl" py="6" pb="12">
            <VStack align="stretch" gap={{base: '5', md: '8'}}>
                <Stack direction={{base: 'column', md: 'row'}} justify="space-between" align={{base: 'stretch', md: 'flex-start'}} gap={{base: '5', md: '6'}}>
                    <VStack align="start" gap={{base: '1.5', md: '2'}} flex="999 1 520px">
                        <Text as="h1" fontSize={{base: 'xl', md: '2xl'}} fontWeight="bold">Governance</Text>
                        <Text fontSize="sm" color="fg.muted" maxW="640px">
                            {'Vote on proposals that change the BeeZee network. Your staked BZE is your voting power.'}
                            <Text as="span" hideBelow="md">{" If you don't vote, your validator's vote counts for the BZE you staked with them."}</Text>
                        </Text>
                    </VStack>
                    {!showError && (
                        <VotingPowerCard isConnected={isConnected} isLoading={showLoading || (isConnected && voter.isLoading)} power={voter.power} failed={voter.failed} />
                    )}
                </Stack>

                {showData && <RulesStrip params={data.params} />}

                {showError && <ErrorState onRetry={reload} />}
                {!showLoading && !showError && isEmpty && <EmptyState />}
                {showLoading && <LoadingState />}

                {showData && (
                    <>
                        <VStack as="section" aria-labelledby="open-h" align="stretch" gap={{base: '3', md: '4'}}>
                            <HStack as="h2" id="open-h" fontSize={{base: 'md', md: 'lg'}} fontWeight="bold" gap="1.5">
                                <Text as="span">Open for voting</Text>
                                <Text as="span" color="fg.muted" fontWeight="medium">{data.open.length}</Text>
                            </HStack>
                            {data.open.length === 0 ? <NoneOpen /> : data.open.map((item) => {
                                const forProposal = voter.voterFor(item.proposal.id);
                                return (
                                    <OpenProposalCard
                                        key={item.proposal.id}
                                        item={item}
                                        params={data.params}
                                        bondedTokens={data.bondedTokens}
                                        now={now}
                                        isConnected={isConnected}
                                        voter={forProposal}
                                        voterLoading={voter.isLoading}
                                        onVote={() => forProposal && setFlow({proposal: item.proposal, power: forProposal.power.power, vote: forProposal.vote})}
                                    />
                                );
                            })}
                        </VStack>

                        <FinishedProposals
                            proposals={data.finished}
                            hasOlder={hasOlder}
                            isLoadingOlder={isLoadingOlder}
                            olderError={olderError}
                            onLoadOlder={loadOlder}
                        />
                    </>
                )}
            </VStack>
            {flow && data && (
                <VoteFlow
                    proposal={flow.proposal}
                    params={data.params}
                    power={flow.power}
                    currentVote={flow.vote}
                    onClose={() => setFlow(null)}
                    onVoted={() => {
                        voter.refresh(flow.proposal.id);
                        refreshTallies();
                    }}
                    onEnded={reload}
                />
            )}
        </Container>
    );
}
