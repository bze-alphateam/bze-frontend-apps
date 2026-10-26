'use client';

import {useState} from 'react';
import {Box, chakra, Flex, Grid, IconButton, Link} from '@chakra-ui/react';
import {LuCheck, LuCopy} from 'react-icons/lu';
import {AppLink, getExplorerAccountURL, getExplorerProposalURL, truncateAddress, type GovParams, type GovProposal, type GovTally} from '@bze/bze-ui-kit';
import {coinsText, depositFate, timeline, type DenomResolver, type TimelineState} from '@/lib/governance/details';
import {Panel} from './panel';

// Timeline, proposer and deposit.

const DOT: Record<TimelineState, {bg: string; ring: string; weight: string}> = {
    done: {bg: 'hg.text.faint', ring: 'transparent', weight: '500'},
    now: {bg: 'app.solid', ring: 'app.muted', weight: '700'},
    todo: {bg: 'hg.lineStrong', ring: 'transparent', weight: '500'},
    passed: {bg: 'hg.success', ring: 'hg.success/25', weight: '700'},
    rejected: {bg: 'hg.danger', ring: 'hg.danger/25', weight: '700'},
};

function CopyAddress({address}: {address: string}) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => undefined);
    };
    return (
        <IconButton aria-label={copied ? 'Copied' : 'Copy proposer address'} size="2xs" variant="ghost" color="hg.text.faint" _hover={{color: 'fg', bg: 'hg.hoverFill'}} onClick={copy}>
            {copied ? <LuCheck /> : <LuCopy />}
        </IconButton>
    );
}

interface ProposalTimelineProps {
    proposal: GovProposal;
    tally: GovTally | null;
    params: GovParams;
    now: Date;
    resolve?: DenomResolver;
}

export function ProposalTimeline({proposal, tally, params, now, resolve}: ProposalTimelineProps) {
    const items = timeline(proposal, now);
    const deposit = `${coinsText(proposal.total_deposit, resolve)} · ${depositFate(proposal, tally, params)}`;

    return (
        <Panel headingId="time-h" title="Timeline">
            <Box as="ol" listStyleType="none" m="0" p="0" data-testid="timeline">
                {items.map((item, i) => {
                    const dot = DOT[item.state];
                    const last = i === items.length - 1;
                    return (
                        <Flex as="li" key={item.label} align="stretch" gap="12px">
                            <Flex direction="column" align="center" w="12px" flex="none" aria-hidden>
                                <Box boxSize="10px" mt="5px" borderRadius="full" bg={dot.bg} outline="3px solid" outlineColor={dot.ring} />
                                {!last && <Box flex="1" w="2px" minH="18px" bg="hg.lineStrong" />}
                            </Flex>
                            <Flex direction="column" pb={last ? '0' : '12px'}>
                                <chakra.span fontSize="14px" fontWeight={dot.weight}>{item.label}</chakra.span>
                                <chakra.span fontSize="12px" color="hg.text.faint">{item.detail}</chakra.span>
                            </Flex>
                        </Flex>
                    );
                })}
            </Box>
            <Grid as="dl" templateColumns="auto minmax(0, 1fr)" columnGap="16px" rowGap="8px" fontSize="13px" borderTopWidth="1px" borderColor="hg.divider" pt="14px" m="0">
                <chakra.dt color="hg.text.faint">Proposer</chakra.dt>
                <Box as="dd" m="0" textAlign="right">
                    {proposal.proposer ? (
                        <Flex justify="flex-end" align="center" gap="4px">
                            <Link href={getExplorerAccountURL(proposal.proposer)} target="_blank" rel="noopener noreferrer" fontFamily="mono" color="hg.link" title={proposal.proposer}>
                                {truncateAddress(proposal.proposer)}
                            </Link>
                            <CopyAddress address={proposal.proposer} />
                        </Flex>
                    ) : (
                        <chakra.span color="fg.muted">Not recorded</chakra.span>
                    )}
                </Box>
                <chakra.dt color="hg.text.faint">Deposit</chakra.dt>
                <chakra.dd m="0" textAlign="right" data-testid="deposit">{deposit}</chakra.dd>
            </Grid>
            <Box hideFrom="md" fontSize="13px">
                <AppLink app="explorer" href={getExplorerProposalURL(proposal.id)} flush>Explorer</AppLink>
            </Box>
        </Panel>
    );
}
