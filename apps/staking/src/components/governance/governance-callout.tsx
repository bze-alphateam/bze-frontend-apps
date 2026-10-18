'use client';

import NextLink from 'next/link';
import {Box, Button, Flex, HStack, Link, Stack, Text} from '@chakra-ui/react';
import {LuCheck, LuChevronRight, LuLandmark} from 'react-icons/lu';
import {useOpenProposalsSummary} from '@/hooks/useOpenProposalsSummary';
import {useIsPhone} from '@/hooks/useIsPhone';
import {useNow} from '@/hooks/useNow';
import {callout, GOVERNANCE_HREF, type Callout} from '@/lib/governance/summary';

// The dashboard's governance banner, under the page header and above the stat
// cards: proposals that need the wallet's vote, all voted, or (without a
// wallet) what is open. Nothing when no proposal is open or the summary
// failed, so the dashboard looks as it did. The phone layout is its own
// markup (a stacked card, or one tappable row), hence useIsPhone.

function Landmark({size}: {size: number}) {
    return (
        <Flex
            w={`${size}px`} h={`${size}px`} flex="none" borderRadius="full"
            bg="purple.subtle" color="purple.fg" align="center" justify="center"
        >
            <LuLandmark size={size / 2} aria-hidden />
        </Flex>
    );
}

function Check() {
    return (
        <Flex w="28px" h="28px" flex="none" borderRadius="full" bg="green.subtle" color="green.fg" align="center" justify="center">
            <LuCheck size={16} strokeWidth={2.5} aria-hidden />
        </Flex>
    );
}

const ALL_VOTED = "You've voted on every open proposal.";

const tinted = {bg: 'purple.500/6', borderWidth: '1px', borderColor: 'purple.500/25', borderRadius: 'lg'} as const;
const plain = {bg: 'bg.panel', borderWidth: '1px', borderColor: 'border', borderRadius: 'lg'} as const;

function Desktop({c}: {c: Callout}) {
    if (c.variant === 'voted') {
        return (
            <HStack as="section" aria-label="Governance" {...plain} px="5" py="3" gap="3" flexWrap="wrap">
                <Check />
                <Text flex="999 1 360px" fontSize="sm">
                    <Text as="strong">{ALL_VOTED}</Text>{' '}
                    <Text as="span" color="fg.muted">{c.detail}</Text>
                </Text>
                <Link asChild fontSize="sm" fontWeight="semibold" color="purple.fg">
                    <NextLink href={GOVERNANCE_HREF}>Governance →</NextLink>
                </Link>
            </HStack>
        );
    }

    return (
        <HStack as="section" aria-label="Governance" {...tinted} px="5" py="4" gap="4" flexWrap="wrap">
            <Landmark size={44} />
            <Stack flex="999 1 420px" minW="0" gap="0.5">
                <Text fontSize="md" fontWeight="bold">{c.title}</Text>
                <Text fontSize="sm" color="fg.muted">{c.detail}</Text>
                {c.variant === 'needs-vote' && <Text fontSize="xs" color="fg.muted">{c.powerLine}</Text>}
            </Stack>
            {c.variant === 'needs-vote' ? (
                <HStack gap="2" flex="none">
                    <Button asChild variant="ghost" size="sm" color="purple.fg">
                        <NextLink href={GOVERNANCE_HREF}>All proposals</NextLink>
                    </Button>
                    <Button asChild colorPalette="purple" size="sm">
                        <NextLink href={c.voteHref}>Vote now <LuChevronRight /></NextLink>
                    </Button>
                </HStack>
            ) : (
                <Button asChild variant="outline" size="sm" colorPalette="purple" color="purple.fg" borderColor="purple.500/25" flex="none">
                    <NextLink href={c.href}>See proposal</NextLink>
                </Button>
            )}
        </HStack>
    );
}

function Phone({c}: {c: Callout}) {
    if (c.variant === 'needs-vote') {
        return (
            <Stack as="section" aria-label="Governance" {...tinted} p="4" gap="3">
                <HStack align="start" gap="3">
                    <Landmark size={40} />
                    <Stack gap="0.5" minW="0">
                        <Text fontSize="15px" fontWeight="bold">{c.title}</Text>
                        <Text fontSize="13px" color="fg.muted">{c.detail}</Text>
                    </Stack>
                </HStack>
                <Button asChild colorPalette="purple" size="lg" w="full">
                    <NextLink href={c.voteHref}>Vote now</NextLink>
                </Button>
                <Link asChild alignSelf="center" fontSize="13px" fontWeight="semibold" color="purple.fg">
                    <NextLink href={GOVERNANCE_HREF}>All proposals</NextLink>
                </Link>
            </Stack>
        );
    }

    // One tappable row: to the list when all is voted, to the proposal(s) otherwise.
    const voted = c.variant === 'voted';
    return (
        <Box asChild {...(voted ? plain : tinted)} px="3.5" py="3" display="flex" alignItems="center" gap="3" color="fg">
            <NextLink href={voted ? GOVERNANCE_HREF : c.href}>
                {voted && <Check />}
                <Text as="span" flex="1" fontSize="13px">
                    <Text as="strong">{voted ? ALL_VOTED : c.title}</Text>
                    <br />
                    <Text as="span" color="fg.muted">{c.detail}</Text>
                </Text>
                <LuChevronRight size={16} aria-hidden />
            </NextLink>
        </Box>
    );
}

export function GovernanceCallout() {
    const {summary} = useOpenProposalsSummary();
    const isPhone = useIsPhone();
    const now = useNow();
    const c = callout(summary, now);
    if (!c) return null;

    return isPhone ? <Phone c={c} /> : <Desktop c={c} />;
}
