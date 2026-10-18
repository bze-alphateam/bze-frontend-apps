'use client';

import NextLink from 'next/link';
import {Badge, Box, Button, Grid, HStack, Link, Text, VStack} from '@chakra-ui/react';
import {LuExternalLink} from 'react-icons/lu';
import {getExplorerProposalsURL} from '@bze/bze-ui-kit';
import type {ListedProposal} from '@/lib/governance/scan';
import {kindLabel, proposalKind, proposalTitle, statusInfo} from '@/lib/governance/proposal';
import {yesShare} from '@/lib/governance/tally';
import {formatDateUtc, formatPct} from '@/lib/governance/format';
import {TALLY_COLORS} from './tally-bar';

// The finished proposals: a table on desktop, stacked cards on phone (one
// grid that rearranges its areas), with "Show older proposals" and the link
// to the full history on BZE Scan.

const COLUMNS = '64px minmax(0, 1fr) 180px 96px 130px 150px';

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
        return <Text fontSize="xs" color="fg.muted">No votes</Text>;
    }
    const text = `Yes ${formatPct(yes)}`;

    return (
        <HStack gap="2" fontSize="xs" color="fg.muted" w="full">
            <Box role="img" aria-label={text} flex="1" h={{base: '1', md: '1.5'}} borderRadius="full" bg="bg.muted" overflow="hidden">
                <Box h="full" w={`${yes.toFixed(4)}%`} bg={TALLY_COLORS.yes} />
            </Box>
            <Text as="span" whiteSpace="nowrap">{text}</Text>
        </HStack>
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
            gap={{base: '1.5 2', md: '4'}}
            alignItems="center"
            px={{base: '3.5', md: '5'}}
            py={{base: '3', md: '3.5'}}
            fontSize="sm"
            color="fg"
            textDecoration="none"
            bg={{base: 'bg.panel', md: 'transparent'}}
            borderWidth={{base: '1px', md: '0 0 1px 0'}}
            borderRadius={{base: 'lg', md: '0'}}
            _hover={{bg: 'bg.subtle', textDecoration: 'none'}}
        >
            <NextLink href={`/governance/${proposal.id}`}>
                <Text gridArea="id" fontSize={{base: 'xs', md: 'sm'}} fontWeight="semibold" color="fg.muted">#{proposal.id}</Text>
                <Text gridArea="title" fontWeight="semibold" fontSize={{base: 'md', md: 'sm'}} lineClamp={{base: 3, md: 1}}>
                    {proposalTitle(proposal)}
                </Text>
                <Text gridArea="type" fontSize={{base: 'xs', md: 'sm'}} color="fg.muted">{kindLabel(proposalKind(proposal))}</Text>
                <Box gridArea="result">
                    <Badge colorPalette={status.tone} variant="subtle">{status.text}</Badge>
                </Box>
                <Text gridArea="ended" fontSize={{base: 'xs', md: 'sm'}} color="fg.muted" justifySelf={{base: 'end', md: 'start'}}>
                    {proposal.voting_end_time ? formatDateUtc(proposal.voting_end_time) : ''}
                </Text>
                <Box gridArea="tally" minW="0">
                    <FinalTally proposal={proposal} />
                </Box>
            </NextLink>
        </Link>
    );
}

export function FinishedProposals({proposals, hasOlder, isLoadingOlder, olderError, onLoadOlder}: FinishedProposalsProps) {
    const scanLink = (
        <Link
            href={getExplorerProposalsURL()}
            target="_blank"
            rel="noopener noreferrer"
            fontSize="sm"
            fontWeight="semibold"
            color="purple.fg"
        >
            Full history on BZE Scan <LuExternalLink />
        </Link>
    );

    return (
        <VStack as="section" aria-labelledby="finished-h" align="stretch" gap="3">
            <HStack justify="space-between" align="baseline" gap="4" flexWrap="wrap">
                <Text as="h2" id="finished-h" fontSize={{base: 'md', md: 'lg'}} fontWeight="bold">Finished</Text>
                <Box hideBelow="md">{scanLink}</Box>
            </HStack>

            {proposals.length === 0 && olderError ? (
                <VStack bg="bg.panel" borderWidth="1px" borderRadius="lg" p="6" gap="2">
                    <Text fontSize="sm" color="red.fg">Couldn&apos;t load finished proposals.</Text>
                    <Button variant="outline" size={{base: 'lg', md: 'sm'}} w={{base: 'full', md: 'auto'}} loading={isLoadingOlder} onClick={onLoadOlder}>
                        Try again
                    </Button>
                </VStack>
            ) : proposals.length === 0 ? (
                <Box bg="bg.panel" borderWidth="1px" borderStyle="dashed" borderRadius="lg" p="6" textAlign="center">
                    <Text fontSize="sm" color="fg.muted">No finished proposals yet.</Text>
                </Box>
            ) : (
                <Box
                    bg={{md: 'bg.panel'}}
                    borderWidth={{base: '0', md: '1px'}}
                    borderRadius="lg"
                    overflow="hidden"
                    display="flex"
                    flexDirection="column"
                    gap={{base: '2.5', md: '0'}}
                >
                    <Grid
                        hideBelow="md"
                        templateColumns={COLUMNS}
                        gap="4"
                        px="5"
                        py="2.5"
                        fontSize="xs"
                        fontWeight="semibold"
                        color="fg.muted"
                        bg="bg.subtle"
                        borderBottomWidth="1px"
                    >
                        <Text>ID</Text><Text>Proposal</Text><Text>Type</Text><Text>Result</Text><Text>Ended</Text><Text>Final tally</Text>
                    </Grid>
                    {proposals.map((p) => <FinishedRow key={p.id} proposal={p} />)}
                    {(hasOlder || olderError) && (
                        <VStack p={{base: '0', md: '3'}} gap="2">
                            {olderError && (
                                <Text fontSize="sm" color="red.fg">Couldn&apos;t load older proposals.</Text>
                            )}
                            <Button
                                variant="outline"
                                size={{base: 'lg', md: 'sm'}}
                                w={{base: 'full', md: 'auto'}}
                                loading={isLoadingOlder}
                                onClick={onLoadOlder}
                            >
                                {olderError ? 'Try again' : 'Show older proposals'}
                            </Button>
                        </VStack>
                    )}
                </Box>
            )}

            <Box hideFrom="md" alignSelf="center">{scanLink}</Box>
        </VStack>
    );
}
