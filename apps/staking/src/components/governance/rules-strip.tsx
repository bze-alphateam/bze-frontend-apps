'use client';

import {useState} from 'react';
import {Box, Button, HStack, Text} from '@chakra-ui/react';
import {LuChevronDown, LuInfo} from 'react-icons/lu';
import type {GovParams} from '@bze/bze-ui-kit';
import {fractionPct, votingPeriodText} from '@/lib/governance/format';

// How voting works, from the chain's params. A strip on desktop; on phone it
// collapses behind "How voting works".

export function RulesStrip({params}: {params: GovParams}) {
    const [open, setOpen] = useState(false);
    const period = votingPeriodText(params.voting_period);

    // Every text piece is one string literal: SWC can drop the space between an
    // expression and wrapped JSX text in the production build.
    const strong = (value: string) => <Text as="strong" color="fg">{value}</Text>;
    const rules = (
        <>
            {period ? `A vote lasts ${period}. ` : ''}
            {'A proposal passes when at least '}{strong(fractionPct(params.quorum))}
            {' of staked BZE votes, more than '}{strong(fractionPct(params.threshold))}
            {' of Yes / No / Veto votes are Yes, and less than '}{strong(fractionPct(params.veto_threshold))}
            {' of all votes are No with veto.'}
        </>
    );

    return (
        <Box bg="bg.subtle" borderWidth="1px" borderRadius="lg" px="3.5" py="2.5" fontSize="sm" color="fg.muted">
            <Button
                hideFrom="md"
                variant="plain"
                size="sm"
                p="0"
                h="auto"
                fontWeight="semibold"
                color="fg"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                How voting works
                <Box as="span" transform={open ? 'rotate(180deg)' : undefined} transition="transform 0.2s"><LuChevronDown /></Box>
            </Button>
            <HStack align="flex-start" gap="2.5" display={{base: open ? 'flex' : 'none', md: 'flex'}} mt={{base: '2', md: '0'}}>
                <Box hideBelow="md" mt="0.5" flexShrink={0}><LuInfo /></Box>
                <Text data-testid="governance-rules">
                    {rules}
                    <Text as="span" hideFrom="md">{" If you don't vote, your validator's vote counts for the BZE you staked with them."}</Text>
                </Text>
            </HStack>
        </Box>
    );
}
