'use client';

import NextLink from 'next/link';
import {Box, Button, chakra, Flex, Grid, Link, Stack} from '@chakra-ui/react';
import {LuCheck, LuChevronRight, LuLandmark} from 'react-icons/lu';
import {FeaturedCard, HgCard, hgVariant, IconTile} from '@bze/bze-ui-kit';
import {useOpenProposalsSummary} from '@/hooks/useOpenProposalsSummary';
import {useIsPhone} from '@/hooks/useIsPhone';
import {useNow} from '@/hooks/useNow';
import {callout, GOVERNANCE_HREF, type Callout} from '@/lib/governance/summary';
import {softButton} from '@/components/ui/staking/parts';

// The dashboard's governance card, on the right of the hero: proposals that
// need the wallet's vote, all voted, or (without a wallet) what is open.
// Nothing when no proposal is open or the summary failed, so the hero stands
// alone. The phone layout is its own markup (a stacked card, or one tappable
// row), hence useIsPhone.

function Check() {
    return (
        <Flex as="span" boxSize="28px" flex="none" borderRadius="full" bg="hg.success/12" color="hg.success" align="center" justify="center">
            <LuCheck size={16} strokeWidth={2.5} aria-hidden />
        </Flex>
    );
}

const ALL_VOTED = "You've voted on every open proposal.";

function Desktop({c}: {c: Callout}) {
    if (c.variant === 'voted') {
        return (
            <HgCard as="section" aria-label="Governance" display="flex" alignItems="center" gap="12px" flexWrap="wrap" px="20px" py="16px">
                <Check />
                <chakra.p m="0" flex="999 1 240px" fontSize="14px" lineHeight="1.5">
                    <chakra.strong>{ALL_VOTED}</chakra.strong>{' '}
                    <chakra.span color="fg.muted">{c.detail}</chakra.span>
                </chakra.p>
                <Link asChild fontSize="14px" fontWeight="600" color="hg.link">
                    <NextLink href={GOVERNANCE_HREF}>Governance →</NextLink>
                </Link>
            </HgCard>
        );
    }

    return (
        <Box as="section" aria-label="Governance">
            <FeaturedCard display="flex" flexDirection="column" gap="18px">
                <Flex align="flex-start" gap="14px">
                    <IconTile icon={<LuLandmark />} size={44} />
                    <Stack gap="4px" minW="0">
                        <chakra.strong fontSize="16px">{c.title}</chakra.strong>
                        <chakra.span fontSize="14px" lineHeight="1.5" color="fg.muted">{c.detail}</chakra.span>
                        {c.variant === 'needs-vote' && (
                            <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">{c.powerLine}</chakra.span>
                        )}
                    </Stack>
                </Flex>
                {c.variant === 'needs-vote' ? (
                    <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="10px">
                        <Button asChild variant="ghost" size="lg" color="hg.link">
                            <NextLink href={GOVERNANCE_HREF}>All proposals</NextLink>
                        </Button>
                        <Button asChild variant={hgVariant('primary')} size="lg">
                            <NextLink href={c.voteHref}>Vote now <LuChevronRight /></NextLink>
                        </Button>
                    </Grid>
                ) : (
                    <Button asChild size="lg" {...softButton} color="fg">
                        <NextLink href={c.href}>See proposal</NextLink>
                    </Button>
                )}
            </FeaturedCard>
        </Box>
    );
}

function Phone({c}: {c: Callout}) {
    if (c.variant === 'needs-vote') {
        return (
            <Box as="section" aria-label="Governance">
                <FeaturedCard p="16px" display="flex" flexDirection="column" gap="12px">
                    <Flex align="flex-start" gap="12px">
                        <IconTile icon={<LuLandmark />} size={40} />
                        <Stack gap="3px" minW="0">
                            <chakra.strong fontSize="15px">{c.title}</chakra.strong>
                            <chakra.span fontSize="13px" lineHeight="1.45" color="fg.muted">{c.detail}</chakra.span>
                        </Stack>
                    </Flex>
                    <Button asChild variant={hgVariant('primary')} size="xl" w="full">
                        <NextLink href={c.voteHref}>Vote now</NextLink>
                    </Button>
                    <Link asChild alignSelf="center" fontSize="13px" fontWeight="600" color="hg.link" px="10px" py="6px">
                        <NextLink href={GOVERNANCE_HREF}>All proposals</NextLink>
                    </Link>
                </FeaturedCard>
            </Box>
        );
    }

    // One tappable row: to the list when all is voted, to the proposal(s) otherwise.
    const voted = c.variant === 'voted';
    return (
        <Box
            asChild
            display="flex"
            alignItems="center"
            gap="12px"
            p="14px"
            borderRadius="hg.lg"
            bg="hg.card"
            borderWidth="1px"
            borderColor={voted ? 'hg.hairline' : 'app.border'}
            boxShadow={voted ? 'hg.card' : 'hg.featured'}
            color="fg"
            textDecoration="none"
        >
            <NextLink href={voted ? GOVERNANCE_HREF : c.href}>
                {voted ? <Check /> : <IconTile icon={<LuLandmark />} size={36} />}
                <chakra.span flex="1" fontSize="13px" lineHeight="1.45">
                    <chakra.strong fontSize="14px">{voted ? ALL_VOTED : c.title}</chakra.strong>
                    <br />
                    <chakra.span color="fg.muted">{c.detail}</chakra.span>
                </chakra.span>
                <Box as="span" color="hg.accent" display="inline-flex"><LuChevronRight size={16} aria-hidden /></Box>
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
