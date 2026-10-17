'use client';

import {Box, Button, Container, HStack, Skeleton, Stack, Text, VStack} from '@chakra-ui/react';
import {LuCircleAlert, LuLandmark} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import {getChainName} from '@bze/bze-ui-kit';
import {useGovernance} from '@/hooks/useGovernance';
import {useNow} from '@/hooks/useNow';
import {RulesStrip} from '@/components/governance/rules-strip';
import {OpenProposalCard} from '@/components/governance/open-proposal-card';
import {FinishedProposals} from '@/components/governance/finished-proposals';
import {ConnectWallet} from '@/components/governance/connect-wallet';

/** The voting power card, wallet-free variant: a visitor is asked to connect. */
function VotingPowerCard({isConnected, isLoading}: {isConnected: boolean; isLoading: boolean}) {
    if (isConnected) return null;
    if (isLoading) {
        return <Skeleton hideBelow="md" flex="1 1 300px" maxW="360px" h="76px" borderRadius="lg" />;
    }

    return (
        <Box
            flex="1 1 300px"
            maxW={{md: '360px'}}
            bg={{md: 'bg.panel'}}
            borderWidth={{base: '0', md: '1px'}}
            borderRadius="lg"
            px={{base: '0', md: '4.5'}}
            py={{base: '0', md: '3.5'}}
        >
            <VStack align="stretch" gap="2.5">
                <Text hideBelow="md" fontSize="sm" color="fg.muted">Connect your wallet to see your voting power and vote.</Text>
                <ConnectWallet phoneLabel="Connect Wallet to vote" />
            </VStack>
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
    const {status} = useChain(getChainName());
    const isConnected = status === WalletState.Connected;
    const {data, isLoading, error, reload, loadOlder, hasOlder, isLoadingOlder, olderError} = useGovernance();
    const now = useNow();

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
                    {!showError && <VotingPowerCard isConnected={isConnected} isLoading={showLoading} />}
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
                            {data.open.length === 0 ? <NoneOpen /> : data.open.map((item) => (
                                <OpenProposalCard
                                    key={item.proposal.id}
                                    item={item}
                                    params={data.params}
                                    bondedTokens={data.bondedTokens}
                                    now={now}
                                    isConnected={isConnected}
                                />
                            ))}
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
        </Container>
    );
}
