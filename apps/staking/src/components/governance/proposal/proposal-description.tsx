'use client';

import {useState} from 'react';
import {Box, Button, chakra} from '@chakra-ui/react';
import {hgVariant} from '@bze/bze-ui-kit';
import {Markdown} from '../markdown';
import {Panel} from './panel';

/** Summaries longer than this start collapsed. */
const LONG_SUMMARY = 600;

export function ProposalDescription({summary}: {summary: string}) {
    const [expanded, setExpanded] = useState(false);
    const long = summary.length > LONG_SUMMARY;
    const collapsed = long && !expanded;

    return (
        <Panel headingId="desc-h" title="Description" px={{base: '16px', md: '24px'}} py={{base: '16px', md: '22px'}}>
            {summary === '' ? (
                <chakra.span fontSize="14px" color="fg.muted">This proposal has no description.</chakra.span>
            ) : (
                <Box position="relative" maxH={collapsed ? {base: '180px', md: '320px'} : undefined} overflow={collapsed ? 'hidden' : undefined} data-collapsed={collapsed}>
                    <Markdown text={summary} />
                    {collapsed && (
                        <Box position="absolute" left="0" right="0" bottom="0" h="12" bgGradient="to-b" gradientFrom="transparent" gradientTo="hg.card" />
                    )}
                </Box>
            )}
            {long && (
                <Button variant={hgVariant('secondary')} size="sm" alignSelf={{base: 'stretch', md: 'flex-start'}} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                    {expanded ? 'Show less' : (
                        <>
                            <Box as="span" hideBelow="md">Show full description</Box>
                            <Box as="span" hideFrom="md">Read full description</Box>
                        </>
                    )}
                </Button>
            )}
        </Panel>
    );
}
