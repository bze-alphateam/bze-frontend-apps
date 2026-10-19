'use client';

import NextLink from 'next/link';
import {Box, Button, chakra, Flex, Grid, Link} from '@chakra-ui/react';
import {AppLink, getExplorerProposalsURL, HgCard, hgVariant} from '@bze/bze-ui-kit';
import type {ListedProposal} from '@/lib/governance/scan';
import {kindLabel, proposalKind, proposalTitle, statusInfo} from '@/lib/governance/proposal';
import {yesShare} from '@/lib/governance/tally';
import {formatDateUtc, formatPct} from '@/lib/governance/format';
import {TALLY_COLORS} from './tally-bar';
import {ProposalStatusPill} from './pills';

// The finished proposals: a table on desktop, stacked cards on phone (one
// grid that rearranges its areas), with "Show older proposals" and the link
// to the full history on BZE Scan.

const COLUMNS = '64px minmax(0, 1fr) 180px 104px 130px 170px';

const rowAreas = {
    base: `"id result ended" "title title title" "type tally tally"`,
    md: `"id title type result ended tally"`,
};

interface FinishedProposalsProps {
    proposals: ListedProposal[];
    hasOlder: boolean;
    isLoadingOlder: boolean;
    olderError: boolean;
    onLoadOlder: () => void;
}

function FinalTally({proposal}: {proposal: ListedProposal}) {
    const yes = yesShare(proposal.final_tally_result);
    if (yes == null) {
        return <chakra.span fontSize="12px" color="hg.text.faint">No votes</chakra.span>;
    }
    const text = `Yes ${formatPct(yes)}`;

    return (
        <Flex align="center" gap="8px" fontSize="12px" color="hg.text.secondary" w="full">
            <Box role="img" aria-label={text} flex="1" h={{base: '4px', md: '6px'}} borderRadius="full" bg="hg.inset" overflow="hidden">
                <Box h="full" w={`${yes.toFixed(4)}%`} bg={TALLY_COLORS.yes} />
            </Box>
            <chakra.span whiteSpace="nowrap">{text}</chakra.span>
        </Flex>
    );
}

function FinishedRow({proposal}: {proposal: ListedProposal}) {
    const status = statusInfo(proposal.status);

    return (
        <Link
            asChild
            display="grid"
            gridTemplateColumns={{base: 'auto auto 1fr', md: COLUMNS}}
            gridTemplateAreas={rowAreas}
            gap={{base: '6px 8px', md: '16px'}}
            alignItems="center"
            px={{base: '14px', md: '20px'}}
            py={{base: '12px', md: '13px'}}
            fontSize="14px"
            color="fg"
            textDecoration="none"
            bg={{base: 'hg.card', md: 'transparent'}}
            borderColor={{base: 'hg.hairline', md: 'hg.divider'}}
            borderWidth={{base: '1px', md: '0 0 1px 0'}}
            borderRadius={{base: 'hg.lg', md: '0'}}
            _hover={{bg: 'hg.hoverFill', textDecoration: 'none'}}
        >
            <NextLink href={`/governance/${proposal.id}`}>
                <chakra.span gridArea="id" fontSize={{base: '12px', md: '14px'}} fontWeight="600" color="hg.text.faint">#{proposal.id}</chakra.span>
                <chakra.span gridArea="title" fontWeight="600" fontSize={{base: '15px', md: '14px'}} lineClamp={{base: 3, md: 1}}>
                    {proposalTitle(proposal)}
                </chakra.span>
                <chakra.span gridArea="type" fontSize={{base: '12px', md: '14px'}} color="hg.text.secondary">{kindLabel(proposalKind(proposal))}</chakra.span>
                <Box gridArea="result">
                    <ProposalStatusPill tone={status.tone}>{status.text}</ProposalStatusPill>
                </Box>
                <chakra.span gridArea="ended" fontSize={{base: '12px', md: '14px'}} color="hg.text.secondary" justifySelf={{base: 'end', md: 'start'}}>
                    {proposal.voting_end_time ? formatDateUtc(proposal.voting_end_time) : ''}
                </chakra.span>
                <Box gridArea="tally" minW="0">
                    <FinalTally proposal={proposal} />
                </Box>
            </NextLink>
        </Link>
    );
}

export function FinishedProposals({proposals, hasOlder, isLoadingOlder, olderError, onLoadOlder}: FinishedProposalsProps) {
    const scanLink = (
        <Box fontSize="14px">
            <AppLink app="explorer" href={getExplorerProposalsURL()}>Explorer</AppLink>
        </Box>
    );

    return (
        <Flex as="section" aria-labelledby="finished-h" direction="column" gap="14px">
            <Flex justify="space-between" align="baseline" gap="16px" wrap="wrap">
                <chakra.h2 id="finished-h" m="0" fontSize={{base: '18px', md: '20px'}} fontWeight="700">Finished</chakra.h2>
                <Box hideBelow="md">{scanLink}</Box>
            </Flex>

            {proposals.length === 0 && olderError ? (
                <HgCard display="flex" flexDirection="column" alignItems="center" gap="8px">
                    <chakra.span fontSize="14px" color="hg.danger.text">Couldn&apos;t load finished proposals.</chakra.span>
                    <Button variant={hgVariant('secondary')} size={{base: 'lg', md: 'sm'}} w={{base: 'full', md: 'auto'}} loading={isLoadingOlder} onClick={onLoadOlder}>
                        Try again
                    </Button>
                </HgCard>
            ) : proposals.length === 0 ? (
                <HgCard borderStyle="dashed" textAlign="center">
                    <chakra.span fontSize="14px" color="fg.muted">No finished proposals yet.</chakra.span>
                </HgCard>
            ) : (
                <Box
                    bg={{md: 'hg.card'}}
                    borderWidth={{base: '0', md: '1px'}}
                    borderColor="hg.hairline"
                    borderRadius="hg.lg"
                    boxShadow={{md: 'hg.card'}}
                    overflow="hidden"
                    display="flex"
                    flexDirection="column"
                    gap={{base: '10px', md: '0'}}
                >
                    <Grid
                        hideBelow="md"
                        templateColumns={COLUMNS}
                        gap="16px"
                        px="20px"
                        py="10px"
                        fontSize="12px"
                        fontWeight="600"
                        color="hg.text.faint"
                        bg="hg.cardHeader"
                        borderBottomWidth="1px"
                        borderColor="hg.divider"
                    >
                        <span>ID</span><span>Proposal</span><span>Type</span><span>Result</span><span>Ended</span><span>Final tally</span>
                    </Grid>
                    {proposals.map((p) => <FinishedRow key={p.id} proposal={p} />)}
                    {(hasOlder || olderError) && (
                        <Flex direction="column" align="center" p={{base: '0', md: '14px'}} gap="8px">
                            {olderError && (
                                <chakra.span fontSize="14px" color="hg.danger.text">Couldn&apos;t load older proposals.</chakra.span>
                            )}
                            <Button
                                variant={hgVariant('secondary')}
                                size={{base: 'lg', md: 'sm'}}
                                w={{base: 'full', md: 'auto'}}
                                loading={isLoadingOlder}
                                onClick={onLoadOlder}
                            >
                                {olderError ? 'Try again' : 'Show older proposals'}
                            </Button>
                        </Flex>
                    )}
                </Box>
            )}

            <Box hideFrom="md" alignSelf="center">{scanLink}</Box>
        </Flex>
    );
}
