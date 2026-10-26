'use client';

import {useMemo, useState} from 'react';
import NextLink from 'next/link';
import {Box, Button, chakra, Flex, Link} from '@chakra-ui/react';
import {LuLandmark} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import {WalletState} from '@interchain-kit/core';
import BigNumber from 'bignumber.js';
import {getChainName, HgCard, hgVariant, PageContainer, PageState, Shimmer, type GovProposal, type GovVote} from '@bze/bze-ui-kit';
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
import {InnerHero} from '@/components/ui/layout/inner-hero';

/** The voting power card: a visitor is asked to connect; a wallet sees its power. */
function VotingPowerCard({isConnected, isLoading, power, failed}: {isConnected: boolean; isLoading: boolean; power?: VotingPower; failed?: boolean}) {
    if (isLoading || (isConnected && !power && !failed)) {
        return (
            <HgCard hideBelow={isConnected ? undefined : 'md'} px="18px" py="16px" display="flex" flexDirection="column" gap="10px" aria-hidden>
                <Shimmer h="10px" w="40%" />
                <Shimmer h="22px" w="60%" />
                <Shimmer h="10px" w="50%" />
            </HgCard>
        );
    }

    const count = power?.validators.length ?? 0;
    const noStake = !!power && !power.power.gt(0);

    return (
        <HgCard
            bg={{base: isConnected ? 'hg.card' : 'transparent', md: 'hg.card'}}
            borderWidth={{base: isConnected ? '1px' : '0', md: '1px'}}
            boxShadow={{base: isConnected ? 'hg.card' : 'none', md: 'hg.card'}}
            px={{base: isConnected ? '16px' : '0', md: '18px'}}
            py={{base: isConnected ? '14px' : '0', md: '16px'}}
            data-testid="voting-power"
        >
            {isConnected && !power && (
                <chakra.span fontSize="14px" color="fg.muted">{"Your voting power didn't load. Reload the page to try again."}</chakra.span>
            )}
            {power && (
                <Flex direction="column" align="flex-start" gap="4px">
                    <chakra.span fontSize="12px" fontWeight="600" color="hg.text.faint">Your voting power</chakra.span>
                    <chakra.span fontSize="24px" fontWeight="700">{`${wholeBze(power.power)} BZE`}</chakra.span>
                    <chakra.span fontSize="12px" color="hg.text.faint">
                        {noStake ? 'You have no BZE staked.' : `Staked with ${count} ${count === 1 ? 'validator' : 'validators'}`}
                    </chakra.span>
                    {power.inactive.gt(0) && (
                        <chakra.span fontSize="12px" color="hg.text.faint">{`${wholeBze(power.inactive)} BZE with inactive validators doesn't count.`}</chakra.span>
                    )}
                    {noStake && (
                        <Link asChild mt="4px" fontSize="14px" fontWeight="600" color="hg.link">
                            <NextLink href="/">Stake BZE to get voting power →</NextLink>
                        </Link>
                    )}
                </Flex>
            )}
            {!isConnected && (
                <Flex direction="column" gap="12px">
                    <chakra.span hideBelow="md" fontSize="14px" lineHeight="1.5" color="fg.muted">Connect your wallet to see your voting power and vote.</chakra.span>
                    <ConnectWallet phoneLabel="Connect Wallet to vote" />
                </Flex>
            )}
        </HgCard>
    );
}

function LoadingState() {
    return (
        <Flex direction="column" gap="16px" aria-busy="true" aria-label="Loading proposals">
            <Shimmer w="200px" h="20px" />
            <Shimmer h={{base: '300px', md: '168px'}} borderRadius="hg.lg" />
            <Shimmer w="120px" h="20px" mt="16px" />
            {[1, 2, 3].map((i) => <Shimmer key={i} h={{base: '88px', md: '52px'}} borderRadius="hg.md" />)}
        </Flex>
    );
}

function ErrorState({onRetry}: {onRetry: () => void}) {
    return (
        <HgCard p="0" borderColor="hg.danger/35">
            <PageState
                kind="error"
                title="Couldn't load proposals"
                description="The BeeZee node didn't answer. Your stake and your votes are not affected. Try again in a moment."
                action={<Button variant={hgVariant('secondary')} size={{base: 'lg', md: 'md'}} onClick={onRetry}>Try again</Button>}
            />
        </HgCard>
    );
}

function EmptyState() {
    return (
        <HgCard p="0" borderStyle="dashed">
            <PageState
                kind="empty"
                icon={<LuLandmark />}
                title="No proposals yet"
                description="When a proposal is put to a vote, it shows up here and you can vote with your staked BZE."
            />
        </HgCard>
    );
}

function NoneOpen() {
    return (
        <HgCard borderStyle="dashed" display="flex" flexDirection="column" alignItems="center" gap="4px" textAlign="center" py={{base: '24px', md: '32px'}}>
            <chakra.strong fontSize="15px">No proposals are open for voting right now</chakra.strong>
            <chakra.span fontSize="14px" color="fg.muted">
                {"New proposals show up here as soon as voting starts. We'll flag them on your dashboard too."}
            </chakra.span>
        </HgCard>
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
    const isEmpty = !!data && data.open.length === 0 && data.finished.length === 0 && !hasOlder && !olderError;
    const showData = !showLoading && !showError && !!data && !isEmpty;

    return (
        <Box>
            <InnerHero
                title="Governance"
                subtitle={
                    <>
                        {'Vote on proposals that change the BeeZee network. Your staked BZE is your voting power.'}
                        <chakra.span hideBelow="md">{" If you don't vote, your validator's vote counts for the BZE you staked with them."}</chakra.span>
                    </>
                }
                aside={!showError && (
                    <VotingPowerCard isConnected={isConnected} isLoading={showLoading || (isConnected && voter.isLoading)} power={voter.power} failed={voter.failed} />
                )}
            />

            <PageContainer as="main" pt={{base: '24px', md: '32px'}} pb={{base: '48px', md: '64px'}} display="flex" flexDirection="column" gap={{base: '24px', md: '32px'}}>
                {showData && <RulesStrip params={data.params} />}

                {showError && <ErrorState onRetry={reload} />}
                {!showLoading && !showError && isEmpty && <EmptyState />}
                {showLoading && <LoadingState />}

                {showData && (
                    <>
                        <Flex as="section" aria-labelledby="open-h" direction="column" gap={{base: '12px', md: '14px'}}>
                            <chakra.h2 id="open-h" m="0" fontSize={{base: '18px', md: '20px'}} fontWeight="700" display="flex" gap="6px">
                                <span>Open for voting</span>
                                <chakra.span color="hg.text.faint" fontWeight="500">{data.open.length}</chakra.span>
                            </chakra.h2>
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
                        </Flex>

                        <FinishedProposals
                            proposals={data.finished}
                            hasOlder={hasOlder}
                            isLoadingOlder={isLoadingOlder}
                            olderError={olderError}
                            onLoadOlder={loadOlder}
                        />
                    </>
                )}
            </PageContainer>
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
        </Box>
    );
}
