"use client"

import React from 'react'
import { Badge, Box, Button, CloseButton, Dialog, Grid, Portal, Text, VStack } from '@chakra-ui/react'
import { useAsset } from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
import { denomRewardHref } from '@/lib/denom-reward'
import { VOCABULARY } from '@/lib/vocabulary'

export type RewardKind = 'holder' | 'program' | 'airdrop'

const KIND_NAMES: Record<RewardKind, string> = {
    holder: VOCABULARY.holderRewards.name,
    program: VOCABULARY.stakingProgram.name,
    airdrop: 'Airdrop',
}

const KINDS: RewardKind[] = ['holder', 'program', 'airdrop']

const CARDS: { kind: RewardKind; badge: string; quote: string; text: string }[] = [
    {
        kind: 'holder',
        badge: 'Most creators start here',
        quote: 'I want people to stake my token and keep earning.',
        text: 'Holders stake whenever they like and share daily prizes. It never ends; you top it up when you want.',
    },
    {
        kind: 'program',
        badge: 'Campaigns',
        quote: 'I want a promotion that ends on a date.',
        text: 'Stake one token (often an LP token) for a set number of days, earn one prize. Good for rewarding liquidity.',
    },
    {
        kind: 'airdrop',
        badge: 'One-off',
        quote: 'I want to give tokens away, right now.',
        text: "Split an amount between the people staking a token: yours, or another community's to get noticed.",
    },
]

const COMPARISON: { label: string; values: Record<RewardKind, string> }[] = [
    { label: 'How long', values: { holder: 'No end date', program: 'A fixed number of days', airdrop: 'Once, today' } },
    {
        label: 'What people stake',
        values: {
            holder: 'The token itself',
            program: 'Any token you pick, LP tokens too',
            airdrop: 'Nothing new: goes to current holder-reward stakers',
        },
    },
    {
        label: 'Prizes',
        values: { holder: 'Several prize tokens, each paid daily', program: 'One prize token, paid daily', airdrop: 'Any token, one amount' },
    },
    { label: 'Who can add prizes', values: { holder: 'Anyone, any time', program: 'Whoever creates it, upfront', airdrop: 'Anyone' } },
    { label: 'Leaving', values: { holder: 'A short wait set by the chain', program: 'A lock you choose (0 days or more)', airdrop: '—' } },
    {
        label: 'Best for',
        values: { holder: 'Making a token worth holding', program: 'Liquidity, launches, seasons', airdrop: 'Thank-yous and reaching new people' },
    },
]

const DEFAULT_HREFS: Record<RewardKind, string> = {
    holder: '/rewards',
    program: '/reward/new',
    airdrop: '/rewards',
}

export interface RewardGuideModalProps {
    open: boolean;
    onClose: () => void;
    /** Called with the kind the creator picked; defaults to opening that kind's page. */
    onPick?: (kind: RewardKind) => void;
    /** Set when opened for one token: the footer then offers to make it stakable. */
    denom?: string;
    /** Element that gets the focus back when the dialog closes. */
    finalFocusEl?: () => HTMLElement | null;
}

function ComparisonTable() {
    return (
        <>
            {/* From md up: one table, a column per reward kind */}
            <Box display={{ base: 'none', md: 'block' }} borderWidth="1px" borderRadius="lg" overflow="hidden">
                <Grid templateColumns="minmax(0, 0.8fr) repeat(3, minmax(0, 1fr))" fontSize="sm" role="table" aria-label="Rewards compared">
                    <Box role="row" display="contents">
                        <Box role="columnheader" p={3} bg="bg.muted" />
                        {KINDS.map(kind => (
                            <Box key={kind} role="columnheader" p={3} bg="bg.muted" fontWeight="semibold">{KIND_NAMES[kind]}</Box>
                        ))}
                    </Box>
                    {COMPARISON.map(row => (
                        <Box key={row.label} role="row" display="contents">
                            <Box role="rowheader" p={3} borderTopWidth="1px" color="fg.muted">{row.label}</Box>
                            {KINDS.map(kind => (
                                <Box key={kind} role="cell" p={3} borderTopWidth="1px">{row.values[kind]}</Box>
                            ))}
                        </Box>
                    ))}
                </Grid>
            </Box>

            {/* Phones: one card per reward kind */}
            <VStack display={{ base: 'flex', md: 'none' }} align="stretch" gap={3} data-testid="reward-comparison-stacked">
                {KINDS.map(kind => (
                    <Box key={kind} borderWidth="1px" borderRadius="lg" p={3}>
                        <Text fontWeight="semibold" mb={2}>{KIND_NAMES[kind]}</Text>
                        <VStack align="stretch" gap={1.5} fontSize="sm">
                            {COMPARISON.map(row => (
                                <Box key={row.label}>
                                    <Text as="span" color="fg.muted">{row.label}: </Text>
                                    <Text as="span">{row.values[kind]}</Text>
                                </Box>
                            ))}
                        </VStack>
                    </Box>
                ))}
            </VStack>
        </>
    )
}

/** "Which reward fits?": explains the three ways to reward people. Information only, never signs. */
export function RewardGuideModal({ open, onClose, onPick, denom, finalFocusEl }: RewardGuideModalProps) {
    const { navigate } = useNavigation()
    const { asset } = useAsset(denom ?? '')

    const pick = (kind: RewardKind) => {
        onClose()
        if (onPick) {
            onPick(kind)
            return
        }
        navigate(DEFAULT_HREFS[kind])
    }

    const primary = denom
        ? { label: `Make ${asset?.ticker ?? denom} stakable`, href: denomRewardHref(denom) }
        : { label: `Browse ${VOCABULARY.holderRewards.name.toLowerCase()}`, href: DEFAULT_HREFS.holder }

    const goPrimary = () => {
        onClose()
        navigate(primary.href)
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => !e.open && onClose()}
            size="xl"
            scrollBehavior="inside"
            finalFocusEl={finalFocusEl}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: 'calc(100vw - 32px)', md: '900px' }} borderRadius="2xl">
                        <Dialog.Header flexDirection="column" alignItems="start" gap={1}>
                            <Dialog.Title fontSize="xl" fontWeight="bold">Which reward fits?</Dialog.Title>
                            <Dialog.Description color="fg.muted" fontSize="sm">
                                Three ways to reward people. Pick the sentence that sounds like you.
                            </Dialog.Description>
                            <Dialog.CloseTrigger asChild>
                                <CloseButton size="sm" aria-label="Close dialog" />
                            </Dialog.CloseTrigger>
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack align="stretch" gap={5}>
                                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap={3}>
                                    {CARDS.map(card => (
                                        <Box
                                            key={card.kind}
                                            as="button"
                                            onClick={() => pick(card.kind)}
                                            textAlign="left"
                                            p={4}
                                            borderWidth="1px"
                                            borderRadius="xl"
                                            borderColor={card.kind === 'holder' ? 'yellow.500/50' : 'border'}
                                            bg={card.kind === 'holder' ? 'yellow.500/8' : 'transparent'}
                                            _hover={{ borderColor: 'yellow.500/70' }}
                                            data-testid={`reward-guide-${card.kind}`}
                                        >
                                            <VStack align="start" gap={2}>
                                                <Badge colorPalette={card.kind === 'holder' ? 'yellow' : 'gray'} variant="surface" size="sm">
                                                    {card.badge}
                                                </Badge>
                                                <Text fontWeight="semibold">&ldquo;{card.quote}&rdquo;</Text>
                                                <Text fontSize="sm" color="fg.muted">{card.text}</Text>
                                                <Text fontSize="sm" fontWeight="semibold" color="yellow.600">→ {KIND_NAMES[card.kind]}</Text>
                                            </VStack>
                                        </Box>
                                    ))}
                                </Grid>

                                <ComparisonTable />
                            </VStack>
                        </Dialog.Body>

                        <Dialog.Footer flexWrap="wrap" justifyContent="space-between" gap={3}>
                            <Text fontSize="sm" color="fg.muted" flex="1" minW="200px">
                                Not sure? Start with holder rewards. You can add a campaign or an airdrop later.
                            </Text>
                            <Box display="flex" gap={2}>
                                <Button variant="outline" onClick={onClose}>Close</Button>
                                <Button colorPalette="yellow" onClick={goPrimary}>{primary.label}</Button>
                            </Box>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
