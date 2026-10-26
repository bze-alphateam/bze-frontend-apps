'use client';

import {useState} from 'react';
import {Box, Button, chakra, Flex} from '@chakra-ui/react';
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
    const strong = (value: string) => <chakra.strong color="fg">{value}</chakra.strong>;
    const rules = (
        <>
            {period ? `Voting lasts ${period}. ` : ''}
            {'To pass, at least '}{strong(fractionPct(params.quorum))}
            {' of staked BZE must vote, Yes must win more than '}{strong(fractionPct(params.threshold))}
            {" of the votes that aren't Abstain, and No with veto must stay at or below "}{strong(fractionPct(params.veto_threshold))}
            {' of all votes.'}
        </>
    );

    return (
        <Box bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="14px" px={{base: '14px', md: '16px'}} py="12px" fontSize="14px" lineHeight="1.55" color="fg.muted">
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
            <Flex align="flex-start" gap="10px" display={{base: open ? 'flex' : 'none', md: 'flex'}} mt={{base: '8px', md: '0'}}>
                <Box hideBelow="md" mt="3px" flexShrink={0} color="hg.accent"><LuInfo /></Box>
                <chakra.p m="0" data-testid="governance-rules">
                    {rules}
                    <chakra.span hideFrom="md">{" If you don't vote, your validator's vote counts for the BZE you staked with them."}</chakra.span>
                </chakra.p>
            </Flex>
        </Box>
    );
}
