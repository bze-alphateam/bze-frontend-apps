"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, Flex, Grid, HStack, Link, Text, VStack } from '@chakra-ui/react'
import {
    LuArrowLeftRight,
    LuCoins,
    LuExternalLink,
    LuLandmark,
    LuSprout,
    LuTrophy,
    LuUsers,
} from 'react-icons/lu'
import {
    AppLink,
    Eyebrow,
    GradientText,
    HeroGlow,
    HgCard,
    HomeHero,
    IconTile,
    PageContainer,
    getDexApp,
} from '@bze/bze-ui-kit'
import { Chip, ChipRow, LinkCard } from '@/components/create/choose-parts'
import { ContinueHint } from '@/components/home/continue-hint'
import { useLastWizard } from '@/hooks/useLastWizard'
import { DOCS_HREF, STARTING_POINTS, type StartingPoint, dexPoolsHref } from '@/lib/create-routes'

const ICONS: Record<StartingPoint['id'], React.ReactNode> = {
    token: <LuCoins />,
    market: <LuArrowLeftRight />,
    rewards: <LuSprout />,
    grow: <LuUsers />,
    dao: <LuLandmark />,
    contest: <LuTrophy />,
}

/** One starting point; without a target it is a dashed "Coming soon" tile and not a link. */
function StartTile({ point }: { point: StartingPoint }) {
    const body = (
        <VStack align="stretch" gap="12px" h="full">
            <HStack justify="space-between" align="flex-start" gap="8px">
                <IconTile icon={ICONS[point.id]} variant={point.href ? 'filled' : 'outline'} size={40} />
                {point.featured && <Chip tone="gold">Start here</Chip>}
                {!point.href && <Chip>Coming soon</Chip>}
            </HStack>
            <VStack align="stretch" gap="4px">
                <Text as="h2" fontSize="18px" fontWeight="700">{point.title}</Text>
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted">{point.line}</Text>
            </VStack>
            <ChipRow chips={point.chips} />
        </VStack>
    )

    const tile = {
        p: { base: '18px', md: '22px' },
        borderRadius: '18px',
        minW: 0,
        'data-testid': `start-${point.id}`,
    }

    if (!point.href) {
        return (
            <HgCard {...tile} as="section" aria-label={point.title} borderStyle="dashed" borderColor="hg.lineStrong" boxShadow="none" bg="transparent" opacity={0.8}>
                {body}
            </HgCard>
        )
    }
    return (
        <HgCard
            {...tile}
            asChild
            interactive
            color="fg"
            textDecoration="none"
            focusVisibleRing="outside"
            borderColor={point.featured ? 'app.border' : undefined}
            borderWidth={point.featured ? '1.5px' : undefined}
        >
            <NextLink href={point.href}>{body}</NextLink>
        </HgCard>
    )
}

function WorkOnExisting() {
    return (
        <VStack as="section" aria-label="Work on something that exists" align="stretch" gap="14px">
            <Text as="h2" fontSize="20px" fontWeight="700">Work on something that exists</Text>
            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }} gap="16px">
                <LinkCard title="Extend or fund a reward" line="Add days, a daily prize or an airdrop to any reward." href="/rewards" />
                <LinkCard title="Manage a token" line="Mint, edit details, logo, permissions. Admins only, checked live." href="/tokens" />
                <LinkCard title="Add or remove liquidity" line="Both live on the DEX, on each pool's page.">
                    <Box>
                        <AppLink app="dex" href={dexPoolsHref(getDexApp().href)} flush>DEX</AppLink>
                    </Box>
                </LinkCard>
            </Grid>
        </VStack>
    )
}

function Footer() {
    return (
        <Flex as="footer" align="center" pt="20px" borderTopWidth="1px" borderColor="hg.divider" fontSize="14px">
            <Link href={DOCS_HREF} target="_blank" rel="noopener noreferrer" color="hg.link" fontWeight="600" display="inline-flex" alignItems="center" gap="6px" _hover={{ color: 'hg.link.hover' }}>
                Guides and strategies on docs.getbze.com <LuExternalLink size={12} aria-hidden />
            </Link>
        </Flex>
    )
}

/**
 * The Factory home (BFE-260, canvas A1 / E1): six starting points, then work on what exists. It looks
 * the same whatever the user did before; the only extra is one slim line on top pointing back to the
 * last wizard with a finished step.
 */
export default function FactoryHomePage() {
    const { hint, dismiss } = useLastWizard()

    return (
        <Box position="relative" minH="100vh">
            <HeroGlow />
            <PageContainer as="main" position="relative" pt={{ base: '40px', md: '72px' }} pb="64px">
                <VStack align="stretch" gap={{ base: '36px', md: '48px' }}>
                    {hint && <ContinueHint hint={hint} onDismiss={dismiss} />}
                    <HomeHero
                        align="center"
                        eyebrow={<Eyebrow app="factory">BeeZee Factory</Eyebrow>}
                        title={<>What are you <GradientText>building</GradientText> today?</>}
                    />
                    <Grid
                        as="section"
                        aria-label="Starting points"
                        templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }}
                        gap="16px"
                    >
                        {STARTING_POINTS.map(point => <StartTile key={point.id} point={point} />)}
                    </Grid>
                    <WorkOnExisting />
                    <Footer />
                </VStack>
            </PageContainer>
        </Box>
    )
}
