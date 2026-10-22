"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, chakra, Flex, Grid, HStack, Link, Text, VStack } from '@chakra-ui/react'
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
import { PickUpSection, StartList } from '@/components/home/pick-up'
import { useHomeSuggestions } from '@/hooks/useHomeSuggestions'
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

const HOW_IT_WORKS = [
    { title: 'Pick', line: 'A starting point and, if asked, the option that fits.' },
    { title: 'Fill in', line: 'A few short steps. No wallet needed yet.' },
    { title: 'Review', line: 'What leaves your wallet, what you get, what is permanent.' },
    { title: 'Done', line: 'Your new thing, with the next step ready to go.' },
]

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <VStack align="stretch" gap="4px">
            <Text as="h2" fontSize="20px" fontWeight="700">{title}</Text>
            {subtitle && <Text fontSize="14px" color="fg.muted">{subtitle}</Text>}
        </VStack>
    )
}

function WorkOnExisting() {
    return (
        <VStack as="section" aria-label="Work on something that exists" align="stretch" gap="14px">
            <SectionTitle
                title="Work on something that exists"
                subtitle="For any token or reward on BeeZee. You don't have to be the one who created it."
            />
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

function HowItWorks() {
    return (
        <VStack as="section" aria-label="How it works" align="stretch" gap="14px">
            <SectionTitle title="How it works" />
            <chakra.ol m="0" p="0" listStyleType="none" display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }} gap="12px">
                {HOW_IT_WORKS.map((step, i) => (
                    <chakra.li key={step.title} display="flex" gap="12px" alignItems="flex-start" p="14px" borderRadius="14px" bg="hg.inset" minW={0}>
                        <Flex as="span" boxSize="28px" flex="none" align="center" justify="center" borderRadius="8px" bgImage="app" color="hg.buttonText" fontSize="13px" fontWeight="800" aria-hidden>
                            {i + 1}
                        </Flex>
                        <VStack align="stretch" gap="2px" minW={0}>
                            <Text as="h3" fontSize="15px" fontWeight="700">{step.title}</Text>
                            <Text fontSize="13px" lineHeight="1.45" color="fg.muted">{step.line}</Text>
                        </VStack>
                    </chakra.li>
                ))}
            </chakra.ol>
        </VStack>
    )
}

function Footer() {
    return (
        <Flex as="footer" direction={{ base: 'column', sm: 'row' }} align={{ base: 'flex-start', sm: 'center' }} justify="space-between" gap="8px" pt="20px" borderTopWidth="1px" borderColor="hg.divider" fontSize="14px">
            <Text color="fg.muted">Everything here reads straight from the chain.</Text>
            <Link href={DOCS_HREF} target="_blank" rel="noopener noreferrer" color="hg.link" fontWeight="600" display="inline-flex" alignItems="center" gap="6px" _hover={{ color: 'hg.link.hover' }}>
                Guides and strategies on docs.getbze.com <LuExternalLink size={12} aria-hidden />
            </Link>
        </Flex>
    )
}

/**
 * The Factory home (BFE-260, canvas A1 / E1): six starting points, then work on what exists. With a
 * wallet connected (BFE-275, canvas A2) it greets the user and, when there is something to pick up,
 * shows those cards above a compact list of the starting points.
 */
export default function FactoryHomePage() {
    const { cards, pending, isConnected } = useHomeSuggestions()
    const hasPickUp = cards.length > 0 || pending > 0

    return (
        <Box position="relative" minH="100vh">
            <HeroGlow />
            <PageContainer as="main" position="relative" pt={{ base: '40px', md: '72px' }} pb="64px">
                <VStack align="stretch" gap={{ base: '36px', md: '48px' }}>
                    {isConnected ? (
                        <HomeHero
                            align="center"
                            eyebrow={<Eyebrow app="factory">BeeZee Factory</Eyebrow>}
                            title={<>{"Welcome back. What's "}<GradientText>next</GradientText>?</>}
                            subtitle="Drafts from this browser, and suggestions for tokens you created, read from the chain."
                        />
                    ) : (
                        <HomeHero
                            align="center"
                            eyebrow={<Eyebrow app="factory">BeeZee Factory</Eyebrow>}
                            title={<>What are you <GradientText>building</GradientText> today?</>}
                            subtitle="Pick a starting point. We guide you step by step, show you exactly what happens before you sign, and suggest what to do next."
                        />
                    )}

                    {hasPickUp ? (
                        <>
                            <PickUpSection cards={cards} pending={pending} />
                            <StartList points={STARTING_POINTS} />
                            <WorkOnExisting />
                        </>
                    ) : (
                        <>
                            <Grid
                                as="section"
                                aria-label="Starting points"
                                templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }}
                                gap="16px"
                            >
                                {STARTING_POINTS.map(point => <StartTile key={point.id} point={point} />)}
                            </Grid>
                            <WorkOnExisting />
                            <HowItWorks />
                        </>
                    )}

                    <Footer />
                </VStack>
            </PageContainer>
        </Box>
    )
}
