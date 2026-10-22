"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, Button, Flex, Grid, HStack, Link, Text, VStack } from '@chakra-ui/react'
import { LuArrowRight, LuChevronRight } from 'react-icons/lu'
import { HgCard, Shimmer, TokenLogo, hgVariant } from '@bze/bze-ui-kit'
import type { HomeCard } from '@/lib/home-suggestions'
import type { StartingPoint } from '@/lib/create-routes'
import { tokensHref } from '@/lib/tokens-directory'

// The connected home's parts (BFE-275, canvas A2): the "Pick up where you left off" cards and the
// compact "Start something new" list.

function Avatar({ ticker, logo }: HomeCard['avatar']) {
    if (logo) return <TokenLogo src={logo} symbol={ticker} size="10" circular={true} />
    return (
        <Flex boxSize="40px" flex="none" align="center" justify="center" borderRadius="full" bgImage="app" color="hg.buttonText" fontSize="16px" fontWeight="800" aria-hidden>
            {ticker.slice(0, 1).toUpperCase() || '?'}
        </Flex>
    )
}

function Progress({ step, total }: NonNullable<HomeCard['progress']>) {
    return (
        <HStack gap="4px" role="img" aria-label={`Step ${step} of ${total}`} data-testid="draft-progress">
            {Array.from({ length: total }, (_, i) => (
                <Box key={i} flex="1" h="4px" borderRadius="full" bgImage={i < step ? 'app' : undefined} bg={i < step ? undefined : 'hg.inset'} />
            ))}
        </HStack>
    )
}

export function PickUpCard({ card }: { card: HomeCard }) {
    return (
        <HgCard
            as="article"
            aria-label={card.subject}
            data-testid={`pickup-${card.kind}`}
            p="18px"
            borderRadius="16px"
            minW={0}
            borderColor={card.primary ? 'app.border' : undefined}
            borderWidth={card.primary ? '1.5px' : undefined}
        >
            <VStack align="stretch" gap="12px" h="full">
                <HStack gap="12px" align="center" minW={0}>
                    <Avatar {...card.avatar} />
                    <VStack align="stretch" gap="2px" minW={0}>
                        <Text as="h3" fontSize="16px" fontWeight="700" overflowWrap="anywhere">{card.subject}</Text>
                        <Text fontSize="13px" color="fg.muted">{card.state}</Text>
                    </VStack>
                </HStack>
                {card.progress && <Progress {...card.progress} />}
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted" flex="1">{card.why}</Text>
                <Button asChild variant={hgVariant(card.primary ? 'primary' : 'secondary')} size="sm" alignSelf="flex-start" maxW="full" whiteSpace="normal" textAlign="left" h="auto" minH="36px" py="8px">
                    <NextLink href={card.action.href}>{card.action.label}</NextLink>
                </Button>
            </VStack>
        </HgCard>
    )
}

function PickUpShimmer() {
    return (
        <HgCard p="18px" borderRadius="16px" minW={0} data-testid="pickup-shimmer">
            <VStack align="stretch" gap="12px">
                <HStack gap="12px">
                    <Shimmer boxSize="40px" borderRadius="full" />
                    <VStack align="stretch" gap="6px" flex="1">
                        <Shimmer h="16px" w="60%" />
                        <Shimmer h="13px" w="80%" />
                    </VStack>
                </HStack>
                <Shimmer h="40px" />
                <Shimmer h="36px" w="160px" borderRadius="10px" />
            </VStack>
        </HgCard>
    )
}

export function PickUpSection({ cards, pending }: { cards: HomeCard[]; pending: number }) {
    return (
        <VStack as="section" aria-label="Pick up where you left off" align="stretch" gap="14px">
            <Flex justify="space-between" align="baseline" gap="12px" flexWrap="wrap">
                <Text as="h2" fontSize="20px" fontWeight="700">Pick up where you left off</Text>
                <Link asChild color="hg.link" fontWeight="600" fontSize="14px" _hover={{ color: 'hg.link.hover' }}>
                    <NextLink href={tokensHref({ filter: 'mine' })}>
                        Tokens you created <LuArrowRight size={14} aria-hidden />
                    </NextLink>
                </Link>
            </Flex>
            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }} gap="16px" alignItems="stretch">
                {cards.map(card => <PickUpCard key={card.key} card={card} />)}
                {Array.from({ length: pending }, (_, i) => <PickUpShimmer key={`shimmer-${i}`} />)}
            </Grid>
        </VStack>
    )
}

/** One starting point as a row: title, options line, chevron. Coming soon is dashed and not a link. */
function StartRow({ point }: { point: StartingPoint }) {
    const body = (
        <Flex align="center" gap="12px" minW={0}>
            <VStack align="stretch" gap="2px" flex="1" minW={0}>
                <Text as="h3" fontSize="15px" fontWeight="700">{point.title}</Text>
                <Text fontSize="13px" color="fg.muted">{point.href ? point.options : 'Coming soon'}</Text>
            </VStack>
            {point.href && <Box color="app.fg" flex="none"><LuChevronRight size={18} aria-hidden /></Box>}
        </Flex>
    )
    const row = { p: '14px 16px', borderRadius: '14px', minW: 0, 'data-testid': `start-${point.id}` }
    if (!point.href) {
        return (
            <HgCard {...row} as="section" aria-label={point.title} borderStyle="dashed" borderColor="hg.lineStrong" boxShadow="none" bg="transparent" opacity={0.8}>
                {body}
            </HgCard>
        )
    }
    return (
        <HgCard {...row} asChild interactive color="fg" textDecoration="none" focusVisibleRing="outside">
            <NextLink href={point.href}>{body}</NextLink>
        </HgCard>
    )
}

export function StartList({ points }: { points: StartingPoint[] }) {
    return (
        <VStack as="section" aria-label="Start something new" align="stretch" gap="14px">
            <Text as="h2" fontSize="20px" fontWeight="700">Start something new</Text>
            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }} gap="12px">
                {points.map(point => <StartRow key={point.id} point={point} />)}
            </Grid>
        </VStack>
    )
}
