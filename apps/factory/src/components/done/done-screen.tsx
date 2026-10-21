"use client"

import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { Box, Button, chakra, Circle, Code, Flex, Grid, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import { Global, css } from '@emotion/react'
import {
    LuArrowLeft,
    LuArrowLeftRight,
    LuArrowRight,
    LuBadgeCheck,
    LuCalendarPlus,
    LuCheck,
    LuCoins,
    LuCopy,
    LuDownload,
    LuDroplets,
    LuFlame,
    LuGift,
    LuHandshake,
    LuListOrdered,
    LuMedal,
    LuPalette,
    LuRefreshCw,
    LuSend,
    LuShare2,
    LuTrophy,
    LuUsers,
} from 'react-icons/lu'
import { AppLink, GradientText, HeroGlow, Shimmer, TokenLogo, hgVariant, useToast, type AppKey } from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
import type { NextAction, NextIcon, NextTarget } from '@/lib/next-actions'

export interface DoneAvatar {
    ticker: string;
    logo?: string;
}

export interface DoneLink {
    label: string;
    href: string;
    /** A BZE app's page: rendered as that app's ghost AppLink (new tab). Without it, a Factory route. */
    app?: AppKey;
}

export interface DoneScreenProps {
    /** The token, or the two tokens of a pair (overlapping). */
    avatar: DoneAvatar | [DoneAvatar, DoneAvatar];
    /** One sentence; the word wrapped in **…** gets the gradient: "HONEY is **live**." */
    title: string;
    text: React.ReactNode;
    /** A value worth keeping (denom, pool id) with Copy; no value yet shows a skeleton. */
    code?: { label: string; value?: string };
    links?: DoneLink[];
    /** For the "What's next for <subject>" heading, e.g. "HONEY" or "HONEY/BZE". */
    subject: string;
    /** An amber note between the hero and the next steps, e.g. "No prizes funded yet." */
    notice?: React.ReactNode;
    /** From nextActions(); undefined when everything is already done. */
    recommended?: NextAction;
    /** 0–3 more actions (from nextActions()). */
    more?: NextAction[];
    /** "Not now? Every one of these waits for you on " + link "HONEY's token page" + "." */
    footnote?: { text: string; link?: { label: string; href: string }; after?: string };
    /** Decorative confetti behind the hero, only for token creation. Static under reduced motion. */
    celebrate?: boolean;
    /** Where the wizard was opened from (useReturnTo): a secondary "Back to <label>" button. */
    back?: { label: string; href: string };
}

const ICONS: Record<NextIcon, React.ReactNode> = {
    pool: <LuArrowLeftRight />,
    stake: <LuRefreshCw />,
    registry: <LuBadgeCheck />,
    brand: <LuPalette />,
    market: <LuListOrdered />,
    liquidity: <LuDroplets />,
    reward: <LuCoins />,
    share: <LuShare2 />,
    prize: <LuTrophy />,
    airdrop: <LuGift />,
    partner: <LuHandshake />,
    reach: <LuUsers />,
    extend: <LuCalendarPlus />,
    download: <LuDownload />,
    send: <LuSend />,
    contest: <LuMedal />,
    raffle: <LuFlame />,
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeMotion(onChange: () => void) {
    const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : undefined
    mq?.addEventListener?.('change', onChange)
    return () => mq?.removeEventListener?.('change', onChange)
}

function useReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribeMotion,
        () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches,
        () => true,
    )
}

const CONFETTI_COLOURS = ['#FFC933', '#E09B00', '#FFE8A8', '#34D399', '#12C1E1', '#B57EDC']
const CONFETTI_SPOTS = [[18, 10], [24, 22], [31, 7], [38, 18], [62, 9], [68, 20], [75, 6], [82, 16], [14, 30], [86, 30], [44, 4], [56, 26], [28, 34], [72, 34]]
const CONFETTI_CLASS = 'done-confetti-fall'

const confettiStyles = css`
    @keyframes done-confetti-fall { from { opacity: 0; transform: translateY(-40px) rotate(0deg); } to { opacity: 0.85; } }
    .${CONFETTI_CLASS} { animation: done-confetti-fall 1.1s cubic-bezier(.2,.8,.2,1) both; }
    @media (prefers-reduced-motion: reduce) { .${CONFETTI_CLASS} { animation: none; } }
`

function Confetti() {
    const reducedMotion = useReducedMotion()
    return (
        <Box aria-hidden position="absolute" inset="0" pointerEvents="none" data-testid="done-confetti">
            <Global styles={confettiStyles} />
            {CONFETTI_SPOTS.map(([x, y], i) => (
                <chakra.span
                    key={i}
                    className={reducedMotion ? undefined : CONFETTI_CLASS}
                    data-animated={reducedMotion ? 'false' : 'true'}
                    position="absolute"
                    left={`${x}%`}
                    top={`${y * 12}px`}
                    w={i % 3 === 0 ? '6px' : '10px'}
                    h={i % 3 === 0 ? '14px' : '6px'}
                    borderRadius="3px"
                    bg={CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]}
                    opacity={0.85}
                    transform={`rotate(${(i * 37) % 90 - 45}deg)`}
                    style={{ animationDelay: `${(i % 5) * 0.08}s` }}
                />
            ))}
        </Box>
    )
}

/** "HONEY is **live**." → "HONEY is ", <GradientText>live</GradientText>, "." */
function titleParts(title: string): React.ReactNode[] {
    return title.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 === 1 ? <GradientText key={i}>{part}</GradientText> : part))
}

function Avatar({ avatar }: { avatar: DoneScreenProps['avatar'] }) {
    const tokens = Array.isArray(avatar) ? avatar : [avatar]
    return (
        <Box position="relative" display="inline-flex" data-testid="done-avatar">
            {tokens.map((t, i) => (
                <Box
                    key={`${t.ticker}-${i}`}
                    ms={i > 0 ? '-22px' : 0}
                    borderRadius="full"
                    boxShadow="0 0 0 8px {colors.app.subtle}, 0 24px 60px -16px {colors.app.border}"
                >
                    <TokenLogo src={t.logo} symbol={t.ticker} size="80px" />
                </Box>
            ))}
            <Circle
                position="absolute"
                right="-4px"
                bottom="-4px"
                size="32px"
                bg="hg.success"
                color="hg.buttonText"
                borderWidth="3px"
                borderColor="hg.ground"
                aria-hidden
            >
                <LuCheck size={15} strokeWidth={3.2} />
            </Circle>
        </Box>
    )
}

/** Runs an action's target: navigate, copy (with a toast) or a callback. App targets are links, not buttons. */
function useRunTarget() {
    const { navigate } = useNavigation()
    const { toast } = useToast()
    return async (target: NextTarget) => {
        if ('copy' in target) {
            await navigator.clipboard.writeText(target.copy)
            toast.success('Copied', `${target.copied} copied to clipboard.`)
        } else if ('onClick' in target) {
            target.onClick()
        } else if (!('app' in target)) {
            navigate(target.href)
        }
    }
}

function ActionButton({ action, primary }: { action: NextAction; primary?: boolean }) {
    const run = useRunTarget()
    const { target } = action
    if ('app' in target && !action.disabledReason) {
        return <AppLink app={target.app} href={target.href}>{action.cta}</AppLink>
    }
    const copies = 'copy' in target
    return (
        <Button
            variant={primary ? hgVariant('primary') : 'ghost'}
            size={primary ? 'lg' : 'sm'}
            color={primary ? undefined : 'hg.link'}
            px={primary ? undefined : '6px'}
            ms={primary ? undefined : '-6px'}
            w={primary ? { base: 'full', md: 'auto' } : undefined}
            _hover={primary ? undefined : { bg: 'app.subtle' }}
            disabled={Boolean(action.disabledReason)}
            onClick={() => run(target)}
        >
            {copies && <LuCopy />}
            {action.cta}
            {primary && !copies && <LuArrowRight />}
        </Button>
    )
}

function RecommendedCard({ action }: { action: NextAction }) {
    return (
        <Flex
            as="article"
            aria-label="Recommended next"
            direction={{ base: 'column', md: 'row' }}
            align={{ base: 'stretch', md: 'center' }}
            gap={{ base: '12px', md: '20px' }}
            p={{ base: '20px', md: '26px' }}
            borderRadius="20px"
            borderWidth="1px"
            borderColor="app.border"
            bgColor="hg.card"
            bgImage="linear-gradient(120deg, {colors.app.subtle}, transparent 60%)"
            data-testid="done-recommended"
        >
            <Circle
                display={{ base: 'none', md: 'inline-flex' }}
                size="56px"
                borderRadius="16px"
                bgImage="app"
                color="hg.buttonText"
                flexShrink={0}
                fontSize="26px"
                aria-hidden
            >
                {ICONS[action.icon]}
            </Circle>
            <VStack align="start" gap="6px" flex="1" minW={0}>
                <Text fontSize="12px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color="hg.link">Recommended next</Text>
                <chakra.h3 m="0" fontSize={{ base: '19px', md: '22px' }} fontWeight="700">{action.title}</chakra.h3>
                <Text fontSize={{ base: '14px', md: '15px' }} lineHeight="1.5" color="fg.muted">{action.text}</Text>
                {action.disabledReason && <Text fontSize="13px" color="hg.text.faint">{action.disabledReason}</Text>}
            </VStack>
            <HStack gap="8px" flexShrink={0} wrap="wrap" w={{ base: 'full', md: 'auto' }}>
                <ActionButton action={action} primary />
                {action.alsoApp && <AppLink app={action.alsoApp.app} href={action.alsoApp.href}>{action.alsoApp.label}</AppLink>}
            </HStack>
        </Flex>
    )
}

function MoreCard({ action }: { action: NextAction }) {
    return (
        <VStack
            as="article"
            aria-label={action.title}
            align="stretch"
            gap="10px"
            p="20px"
            borderRadius="18px"
            borderWidth="1px"
            borderColor="hg.hairline"
            bg="hg.card"
            opacity={action.disabledReason ? 0.7 : 1}
            data-disabled={action.disabledReason ? 'true' : undefined}
        >
            <Circle size="40px" borderRadius="12px" bg="app.subtle" color="hg.link" fontSize="20px" aria-hidden>
                {ICONS[action.icon]}
            </Circle>
            <chakra.h3 m="0" fontSize="16px" fontWeight="700">{action.title}</chakra.h3>
            <Text fontSize="14px" lineHeight="1.45" color="fg.muted" flex="1">{action.disabledReason ?? action.text}</Text>
            <HStack gap="4px" wrap="wrap">
                <ActionButton action={action} />
                {action.alsoApp && <AppLink app={action.alsoApp.app} href={action.alsoApp.href}>{action.alsoApp.label}</AppLink>}
            </HStack>
        </VStack>
    )
}

/**
 * The end of every wizard (BFE-259, canvas B3 / C2 / C4 / E3): a centred hero that celebrates the
 * result, then "What's next for <subject>" with one gold Recommended next card and up to three
 * more cards (one column on phones). The heading takes the focus on mount so screen readers
 * announce the result.
 */
export function DoneScreen({
    avatar,
    title,
    text,
    code,
    links = [],
    subject,
    notice,
    recommended,
    more = [],
    footnote,
    celebrate,
    back,
}: DoneScreenProps) {
    const { navigate } = useNavigation()
    const { toast } = useToast()
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    const copyCode = async () => {
        if (!code?.value) return
        await navigator.clipboard.writeText(code.value)
        toast.success('Copied', `${code.label} copied to clipboard.`)
    }

    const hasNext = Boolean(recommended) || more.length > 0
    const footLink = footnote?.link

    return (
        <Box position="relative" overflow="hidden" data-testid="done-screen">
            <HeroGlow strength="inner" />
            {celebrate && <Confetti />}
            <VStack
                position="relative"
                align="stretch"
                gap={{ base: '24px', md: '40px' }}
                maxW="1040px"
                mx="auto"
                px={{ base: '16px', md: '24px' }}
                pt={{ base: '40px', md: '56px' }}
                pb={{ base: '40px', md: '64px' }}
            >
                <VStack as="section" aria-label="Done" align="center" textAlign="center" gap={{ base: '12px', md: '16px' }}>
                    <Avatar avatar={avatar} />
                    <chakra.h1
                        ref={headingRef}
                        tabIndex={-1}
                        m="0"
                        mt="8px"
                        fontSize={{ base: '44px', md: '56px' }}
                        lineHeight="1.05"
                        fontWeight="800"
                        letterSpacing="-0.03em"
                        wordBreak="break-word"
                        outline="none"
                    >
                        {titleParts(title)}
                    </chakra.h1>
                    <Text m="0" fontSize={{ base: '15px', md: '18px' }} color="fg.muted" maxW="640px">{text}</Text>
                    {(code || links.length > 0) && (
                        <Flex align="center" gap="12px" wrap="wrap" justify="center" mt="4px" maxW="100%">
                            {code && (code.value ? (
                                <HStack gap="6px" ps="12px" pe="4px" minH="36px" maxW="100%" borderRadius="10px" borderWidth="1px" borderColor="hg.hairline" bg="hg.inset">
                                    <Code bg="transparent" fontSize="13px" color="hg.text.secondary" wordBreak="break-all" whiteSpace="normal" textAlign="start" aria-label={code.label}>
                                        {code.value}
                                    </Code>
                                    <IconButton aria-label={`Copy ${code.label}`} size="xs" variant="ghost" color="hg.link" onClick={copyCode}>
                                        <LuCopy />
                                    </IconButton>
                                </HStack>
                            ) : (
                                <Shimmer h="36px" w="240px" maxW="100%" borderRadius="10px" data-testid="code-loading" />
                            ))}
                            {links.map(l => l.app ? (
                                <AppLink key={l.href} app={l.app} href={l.href}>{l.label}</AppLink>
                            ) : (
                                <Button key={l.href} variant="ghost" size="sm" color="hg.link" _hover={{ bg: 'app.subtle' }} onClick={() => navigate(l.href)}>
                                    {l.label}
                                </Button>
                            ))}
                        </Flex>
                    )}
                </VStack>

                {notice && (
                    <Box role="status" p="14px 16px" borderRadius="14px" borderWidth="1px" borderColor="hg.warning/40" bg="hg.warning/10" fontSize="14px" lineHeight="1.5">
                        {notice}
                    </Box>
                )}

                {hasNext && (
                    <VStack as="section" aria-label="What's next" align="stretch" gap="16px">
                        <chakra.h2 m="0" fontSize="20px" fontWeight="700">{`What's next for ${subject}`}</chakra.h2>
                        {recommended && <RecommendedCard action={recommended} />}
                        {more.length > 0 && (
                            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }} gap={{ base: '8px', md: '16px' }} data-testid="done-more">
                                {more.map(a => <MoreCard key={a.key} action={a} />)}
                            </Grid>
                        )}
                    </VStack>
                )}

                {(footnote || back) && (
                    <VStack gap="16px">
                        {footnote && (
                            <Text m="0" fontSize="14px" color="hg.text.faint" textAlign="center">
                                {footnote.text}
                                {footLink && (
                                    <>
                                        {' '}
                                        <chakra.a
                                            href={footLink.href}
                                            color="hg.link"
                                            fontWeight="600"
                                            _hover={{ color: 'hg.link.hover' }}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                navigate(footLink.href)
                                            }}
                                        >
                                            {footLink.label}
                                        </chakra.a>
                                    </>
                                )}
                                {footnote.after}
                            </Text>
                        )}
                        {back && (
                            <Button variant={hgVariant('secondary')} onClick={() => navigate(back.href)}>
                                <LuArrowLeft />
                                {`Back to ${back.label}`}
                            </Button>
                        )}
                    </VStack>
                )}
            </VStack>
        </Box>
    )
}
