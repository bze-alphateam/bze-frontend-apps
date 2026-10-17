'use client';

import {useState} from 'react';
import {Box, Button, Stack, Text} from '@chakra-ui/react';
import {Markdown} from '../markdown';

/** Summaries longer than this start collapsed. */
const LONG_SUMMARY = 600;

export function ProposalDescription({summary}: {summary: string}) {
    const [expanded, setExpanded] = useState(false);
    const long = summary.length > LONG_SUMMARY;
    const collapsed = long && !expanded;

    return (
        <Stack as="section" aria-labelledby="desc-h" bg="bg.panel" borderWidth="1px" borderRadius="lg" px={{base: '4', md: '6'}} py={{base: '4', md: '5'}} gap="3">
            <Text as="h2" id="desc-h" fontSize="md" fontWeight="bold">Description</Text>
            {summary === '' ? (
                <Text fontSize="sm" color="fg.muted">This proposal has no description.</Text>
            ) : (
                <Box position="relative" maxH={collapsed ? {base: '180px', md: '320px'} : undefined} overflow={collapsed ? 'hidden' : undefined} data-collapsed={collapsed}>
                    <Markdown text={summary} />
                    {collapsed && (
                        <Box position="absolute" left="0" right="0" bottom="0" h="12" bgGradient="to-b" gradientFrom="transparent" gradientTo="bg.panel" />
                    )}
                </Box>
            )}
            {long && (
                <Button variant="outline" size="sm" alignSelf={{base: 'stretch', md: 'flex-start'}} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                    {expanded ? 'Show less' : (
                        <>
                            <Box as="span" hideBelow="md">Show full description</Box>
                            <Box as="span" hideFrom="md">Read full description</Box>
                        </>
                    )}
                </Button>
            )}
        </Stack>
    );
}
