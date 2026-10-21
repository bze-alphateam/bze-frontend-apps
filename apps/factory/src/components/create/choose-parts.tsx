"use client"

import React, { Suspense } from 'react'
import NextLink from 'next/link'
import { Box, Button, chakra, Flex, Grid, HStack, Link, Text, VStack } from '@chakra-ui/react'
import { LuArrowRight, LuCheck, LuTriangleAlert } from 'react-icons/lu'
import {
    type FeeCoin,
    HgCard,
    PageContainer,
    Shimmer,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
} from '@bze/bze-ui-kit'

// The building blocks of the three Choose screens (BFE-260, canvas A3–A5): the page frame with
// its "Create / <Thing>" breadcrumb, the option cards and the creation fee line.

/** A small outlined label: an option's chips and a card's tag. */
export function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'gold' }) {
    return (
        <Text
            as="span"
            display="inline-flex"
            alignItems="center"
            h="24px"
            px="9px"
            borderRadius="hg.pill"
            borderWidth="1px"
            borderColor={tone === 'gold' ? 'app.border' : 'hg.lineStrong'}
            bg={tone === 'gold' ? 'app.subtle' : 'hg.secondaryFill'}
            color={tone === 'gold' ? 'app.fg' : 'hg.text.secondary'}
            fontSize="12px"
            fontWeight="600"
            whiteSpace="nowrap"
        >
            {children}
        </Text>
    )
}

export function ChipRow({ chips }: { chips: string[] }) {
    if (chips.length === 0) return null
    return (
        <HStack gap="6px" flexWrap="wrap">
            {chips.map(chip => <Chip key={chip}>{chip}</Chip>)}
        </HStack>
    )
}

/**
 * "Creation fee 25,000 BZE + network fee", from the chain params. While they load: a shimmer.
 * A fee the chain didn't give is "Fee unavailable", never free.
 */
export function CreationFeeLine({ fee, isLoading }: { fee?: FeeCoin; isLoading?: boolean }) {
    const { asset } = useAsset(fee?.denom ?? '')
    let text: string
    if (fee && asset) {
        text = `Creation fee ${prettyAmount(uAmountToBigNumberAmount(fee.amount, asset.decimals))} ${asset.ticker} + network fee`
    } else if (isLoading) {
        return <Shimmer h="20px" w="220px" data-testid="fee-line" />
    } else {
        text = 'Fee unavailable'
    }
    return <Text fontSize="13px" color="fg.muted" data-testid="fee-line">{text}</Text>
}

/** The amber "needs care" line of an option. */
export function CareLine({ children }: { children: React.ReactNode }) {
    return (
        <Flex gap="8px" align="flex-start" fontSize="13px" lineHeight="1.45" color="hg.warning.text">
            <Box as="span" mt="2px" flex="none"><LuTriangleAlert size={14} aria-hidden /></Box>
            <Text>{children}</Text>
        </Flex>
    )
}

export function Points({ points }: { points: string[] }) {
    return (
        <chakra.ul m="0" p="0" listStyleType="none" display="flex" flexDirection="column" gap="6px">
            {points.map(point => (
                <chakra.li key={point} display="flex" gap="8px" alignItems="flex-start" fontSize="14px" lineHeight="1.45">
                    <Box as="span" mt="3px" flex="none" color="app.fg"><LuCheck size={14} aria-hidden /></Box>
                    {point}
                </chakra.li>
            ))}
        </chakra.ul>
    )
}

/** Label-value facts of an option, two columns from `sm` up. */
export function Facts({ facts }: { facts: [string, string][] }) {
    return (
        <chakra.dl m="0" display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', sm: '120px minmax(0, 1fr)' }} columnGap="12px" rowGap="6px" fontSize="14px">
            {facts.map(([label, value]) => (
                <React.Fragment key={label}>
                    <chakra.dt color="fg.muted" fontSize="13px">{label}</chakra.dt>
                    <chakra.dd m="0" mb={{ base: '4px', sm: 0 }}>{value}</chakra.dd>
                </React.Fragment>
            ))}
        </chakra.dl>
    )
}

interface OptionCardProps {
    /** Region name and h2. */
    title: string;
    line: string;
    /** A gold edge and a tag ("Most common first step"). */
    featuredTag?: string;
    tag?: React.ReactNode;
    children?: React.ReactNode;
    /** The card's one action. */
    action: { label: string; href: string };
}

/** One option on a Choose screen: what it is, how it works, what to watch, what it costs, the way in. */
export function OptionCard({ title, line, featuredTag, tag, children, action }: OptionCardProps) {
    return (
        <HgCard
            as="section"
            aria-label={title}
            p={{ base: '18px', md: '24px' }}
            borderRadius="18px"
            borderColor={featuredTag ? 'app.border' : undefined}
            borderWidth={featuredTag ? '1.5px' : undefined}
            display="flex"
            flexDirection="column"
            gap="14px"
            minW={0}
            data-testid="option-card"
        >
            <VStack align="stretch" gap="6px">
                {(featuredTag || tag) && (
                    <HStack gap="6px" flexWrap="wrap">
                        {featuredTag && <Chip tone="gold">{featuredTag}</Chip>}
                        {tag}
                    </HStack>
                )}
                <Text as="h2" fontSize="20px" fontWeight="700">{title}</Text>
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted">{line}</Text>
            </VStack>
            {children}
            <Box flex="1" />
            <Button asChild variant={hgVariant(featuredTag ? 'primary' : 'secondary')} size="lg" w={{ base: 'full', sm: 'auto' }} alignSelf="flex-start">
                <NextLink href={action.href}>{action.label} <LuArrowRight aria-hidden /></NextLink>
            </Button>
        </HgCard>
    )
}

/** A whole-card link with a title, one line and chips (Grow a community, Work on something that exists). */
export function LinkCard({ title, line, chips = [], href, level = 'h3', children }: { title: string; line: string; chips?: string[]; href?: string; level?: 'h2' | 'h3'; children?: React.ReactNode }) {
    const body = (
        <VStack align="stretch" gap="8px" minW={0}>
            <Text as={level} fontSize="16px" fontWeight="700">{title}</Text>
            <Text fontSize="14px" lineHeight="1.45" color="fg.muted">{line}</Text>
            <ChipRow chips={chips} />
            {children}
        </VStack>
    )
    if (!href) {
        return <HgCard p="18px" borderRadius="16px" minW={0}>{body}</HgCard>
    }
    return (
        <HgCard asChild interactive p="18px" borderRadius="16px" color="fg" textDecoration="none" minW={0} focusVisibleRing="outside">
            <NextLink href={href}>{body}</NextLink>
        </HgCard>
    )
}

export function CardGrid({ children, columns = 2 }: { children: React.ReactNode; columns?: 2 | 3 | 4 }) {
    const md = columns === 4 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${columns}, minmax(0, 1fr))`
    return (
        <Grid templateColumns={{ base: 'minmax(0, 1fr)', md }} gap="16px" alignItems="stretch">
            {children}
        </Grid>
    )
}

interface ChoosePageProps {
    /** The last breadcrumb: "DEX market", "Staking rewards", "Community". */
    crumb: string;
    title: React.ReactNode;
    intro: string;
    children: React.ReactNode;
}

/** A Choose screen: breadcrumb "Create / <Thing>", the question as h1, one sentence, the options. */
export function ChoosePage({ crumb, title, intro, children }: ChoosePageProps) {
    return (
        <PageContainer as="main" pt={{ base: '16px', md: '28px' }} pb={{ base: '40px', md: '64px' }}>
            <VStack align="stretch" gap={{ base: '20px', md: '28px' }}>
                <VStack align="stretch" gap="10px">
                    <chakra.nav aria-label="Breadcrumb">
                        <chakra.ol display="flex" alignItems="center" flexWrap="wrap" gap="6px" m="0" p="0" listStyleType="none" fontSize="14px">
                            <chakra.li display="inline-flex">
                                <Link asChild color="hg.link" fontWeight="600" minH={{ base: '44px', md: '28px' }} display="inline-flex" alignItems="center" _hover={{ color: 'hg.link.hover' }}>
                                    <NextLink href="/">Create</NextLink>
                                </Link>
                            </chakra.li>
                            <chakra.li display="inline-flex" alignItems="center" gap="6px" color="fg.muted">
                                <span aria-hidden>/</span>
                                <span aria-current="page">{crumb}</span>
                            </chakra.li>
                        </chakra.ol>
                    </chakra.nav>
                    <Text as="h1" fontSize={{ base: '28px', md: '36px' }} fontWeight="800" lineHeight="1.15" letterSpacing="-0.02em">{title}</Text>
                    <Text fontSize={{ base: '15px', md: '16px' }} lineHeight="1.55" color="fg.muted" maxW="720px">{intro}</Text>
                </VStack>
                {children}
            </VStack>
        </PageContainer>
    )
}

/** Choose screens read the query (pass-through), so they render inside a Suspense boundary. */
export function ChooseFrame({ children }: { children: React.ReactNode }) {
    return (
        <Box minH="100vh">
            <Suspense fallback={<PageContainer pt="28px"><Shimmer h="384px" borderRadius="hg.lg" /></PageContainer>}>
                {children}
            </Suspense>
        </Box>
    )
}
