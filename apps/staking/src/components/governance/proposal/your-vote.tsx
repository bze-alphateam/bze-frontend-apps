'use client';

import {Box, Link, Stack, Text} from '@chakra-ui/react';
import {getExplorerProposalURL, type GovProposal} from '@bze/bze-ui-kit';
import {isOpen} from '@/lib/governance/details';
import {formatDateUtc} from '@/lib/governance/format';
import {ConnectWallet} from '../connect-wallet';

// "Your vote", the variants that need no wallet data: a visitor is asked to
// connect, a decided proposal points to BZE Scan. A connected wallet on an
// open proposal gets the slot the vote flow fills.

export function YourVote({proposal, isConnected}: {proposal: GovProposal; isConnected: boolean}) {
    const open = isOpen(proposal);

    return (
        <Stack
            as="section"
            aria-labelledby="vote-h"
            bg="bg.panel"
            borderWidth="1px"
            borderColor={open ? 'purple.500/25' : 'border'}
            borderRadius="lg"
            p={{base: '4', md: '5'}}
            gap="3.5"
        >
            <Text as="h2" id="vote-h" fontSize="md" fontWeight="bold">Your vote</Text>
            {!open && (
                <>
                    {proposal.voting_end_time && (
                        <Text fontSize="sm" fontWeight="semibold">{`Voting ended on ${formatDateUtc(proposal.voting_end_time)}.`}</Text>
                    )}
                    <Text fontSize="13px" color="fg.muted">
                        {"The chain clears individual votes once a proposal is decided, so this app can't show how you voted. BZE Scan keeps every vote."}
                    </Text>
                    <Link href={getExplorerProposalURL(proposal.id)} target="_blank" rel="noopener noreferrer" fontSize="13px" fontWeight="semibold" color="purple.fg">
                        See all votes on BZE Scan ↗
                    </Link>
                </>
            )}
            {open && !isConnected && (
                <>
                    <Text fontSize="sm" color="fg.muted">Connect a wallet to vote. Your voting power is the BZE you have staked.</Text>
                    <ConnectWallet />
                </>
            )}
            {/* BFE-222 puts the voting power, the user's vote and the vote options here. */}
            {open && isConnected && (
                <Box data-testid="vote-slot">
                    <Text fontSize="sm" color="fg.muted">Voting from this page comes with the next update.</Text>
                </Box>
            )}
        </Stack>
    );
}
