'use client';

import NextLink from 'next/link';
import {Box, Button, chakra, Flex, Link, Stack} from '@chakra-ui/react';
import {LuCheck, LuClock} from 'react-icons/lu';
import {FeaturedCard, hgVariant, Shimmer, StatusPill, type GovParams} from '@bze/bze-ui-kit';
import type {OpenProposal} from '@/hooks/useGovernance';
import type {ProposalVoter} from '@/hooks/useVoter';
import {kindLabel, proposalKind, proposalTitle} from '@/lib/governance/proposal';
import {quorumStatus} from '@/lib/governance/tally';
import {endsIn, formatDateTimeUtc, formatPct} from '@/lib/governance/format';
import {wholeBze} from '@/lib/governance/details';
import {singleChoice, validatorsSentence, voteSummary} from '@/lib/governance/voter';
import {TallyBar, TallyLegend} from './tally-bar';
import {AppPill} from './pills';

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
        <chakra.span fontSize="12px" color="hg.text.secondary" ml={{md: 'auto'}}>
            {'Turnout '}<chakra.strong color="fg">{formatPct(q.turnout)}</chakra.strong>
            {` · quorum ${formatPct(q.quorum)} `}
            {q.reached
                ? <chakra.strong color="hg.success.text">reached</chakra.strong>
                : <chakra.strong color="hg.warning.text">not reached</chakra.strong>}
        </chakra.span>
    );
}

function ViewProposal({href}: {href: string}) {
    return (
        <Button asChild variant={hgVariant('secondary')} size={{base: 'lg', md: 'md'}}>
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
                <chakra.span hideBelow="md" fontSize="14px" lineHeight="1.5" color="fg.muted">Connect a wallet with staked BZE to vote.</chakra.span>
                <ViewProposal href={href} />
            </>
        );
    }
    if (!voter) {
        return voterLoading
            ? <Flex direction="column" gap="8px" aria-busy="true" aria-label="Loading your vote"><Shimmer h="16px" w="60%" /><Shimmer h="40px" borderRadius="hg.md" /></Flex>
            : <ViewProposal href={href} />;
    }

    const noStake = !voter.power.power.gt(0);
    if (voter.vote) {
        const single = singleChoice(voter.vote);
        const voted = single ? single.label : `You split your vote: ${voteSummary(voter.vote)}`;
        return (
            <Stack direction={{base: 'row', md: 'column'}} align={{base: 'center', md: 'stretch'}} justify="space-between" gap="10px">
                <Flex direction="column" align="flex-start" gap="6px" minW="0">
                    <Flex hideBelow="md" align="center" gap="6px" fontSize="16px" fontWeight="700" color={single?.key === 'yes' ? 'hg.up' : 'fg'}>
                        <LuCheck size={16} />
                        <chakra.span>{voted}</chakra.span>
                    </Flex>
                    <chakra.span hideFrom="md" fontSize="14px" fontWeight="600">{single ? `You voted ${single.label}` : voted}</chakra.span>
                    <chakra.span hideBelow="md" fontSize="13px" lineHeight="1.5" color="fg.muted">
                        {noStake
                            ? 'It only counts once you have BZE staked. You can change it until voting ends.'
                            : `Counts for your ${wholeBze(voter.power.power)} BZE. You can change it until voting ends.`}
                    </chakra.span>
                </Flex>
                <Button variant={hgVariant('secondary')} size="md" flexShrink={0} onClick={onVote}>Change vote</Button>
            </Stack>
        );
    }
    if (noStake) {
        return (
            <>
                <chakra.strong hideBelow="md" fontSize="16px">0 voting power</chakra.strong>
                <chakra.span fontSize="13px" lineHeight="1.5" color="fg.muted">You can vote, but it only counts once you have BZE staked.</chakra.span>
                <ViewProposal href={href} />
            </>
        );
    }

    const meanwhile = validatorsSentence(voter.validators);
    return (
        <>
            <chakra.strong hideBelow="md" fontSize="16px">{"You haven't voted yet"}</chakra.strong>
            {meanwhile && <chakra.span hideBelow="md" fontSize="13px" lineHeight="1.5" color="fg.muted">{`Meanwhile: ${meanwhile}`}</chakra.span>}
            <chakra.span hideFrom="md" fontSize="13px" color="fg.muted">
                <chakra.strong color="fg">{"You haven't voted yet."}</chakra.strong>{meanwhile ? ` ${meanwhile}` : ''}
            </chakra.span>
            <Button variant={hgVariant('primary')} size={{base: 'lg', md: 'md'}} onClick={onVote}>Vote</Button>
        </>
    );
}

export function OpenProposalCard({item, params, bondedTokens, now, isConnected, voter, voterLoading, onVote}: OpenProposalCardProps) {
    const {proposal} = item;
    const href = `/governance/${proposal.id}`;
    const end = proposal.voting_end_time;

    return (
        <Box as="article">
            <FeaturedCard px={{base: '16px', md: '26px'}} py={{base: '16px', md: '22px'}}>
                <Stack direction={{base: 'column', md: 'row'}} gap={{base: '12px', md: '32px'}} align="stretch">
                    <Flex direction="column" gap={{base: '12px', md: '14px'}} flex="999 1 0" minW="0">
                        <Flex gap="8px" wrap="wrap" align="center" fontSize="12px">
                            <chakra.span fontWeight="600" color="hg.text.faint">#{proposal.id}</chakra.span>
                            <AppPill>Voting</AppPill>
                            <StatusPill tone="neutral">{kindLabel(proposalKind(proposal))}</StatusPill>
                        </Flex>
                        <Link asChild fontSize={{base: '17px', md: '20px'}} fontWeight="700" color="fg" lineHeight="1.3" _hover={{color: 'hg.link'}}>
                            <NextLink href={href}>{proposalTitle(proposal)}</NextLink>
                        </Link>
                        {end && (
                            <Flex align="center" gap="6px" fontSize="14px" color="fg.muted">
                                <Box hideBelow="md" color="hg.accent"><LuClock size={14} /></Box>
                                <chakra.span>
                                    {'Ends in '}<chakra.strong color="fg">{endsIn(end, now)}</chakra.strong>
                                    {` · ${formatDateTimeUtc(end)}`}
                                </chakra.span>
                            </Flex>
                        )}
                        <Flex direction="column" gap="8px">
                            <TallyBar tally={item.tally} />
                            <Box
                                display={{base: 'grid', md: 'flex'}}
                                gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                                flexWrap="wrap"
                                gap={{base: '4px 12px', md: '18px'}}
                                alignItems="center"
                            >
                                <TallyLegend tally={item.tally} />
                                <Box gridColumn="1 / -1" display="flex" flex={{md: '1'}}>
                                    <Turnout item={item} params={params} bondedTokens={bondedTokens} />
                                </Box>
                            </Box>
                        </Flex>
                    </Flex>

                    <Flex
                        direction="column"
                        justify="center"
                        gap="10px"
                        flex="1 1 260px"
                        maxW={{md: '320px'}}
                        borderColor="hg.divider"
                        borderLeftWidth={{base: '0', md: '1px'}}
                        borderTopWidth={{base: '1px', md: '0'}}
                        pl={{base: '0', md: '28px'}}
                        pt={{base: '12px', md: '0'}}
                        data-testid="card-vote"
                    >
                        <chakra.span hideBelow="md" fontSize="12px" fontWeight="600" color="hg.text.faint">Your vote</chakra.span>
                        <CardVote href={href} isConnected={isConnected} voter={voter} voterLoading={voterLoading} onVote={onVote} />
                    </Flex>
                </Stack>
            </FeaturedCard>
        </Box>
    );
}
