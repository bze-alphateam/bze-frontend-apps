"use client"

import React from 'react'
import { Badge, Box, Button, chakra, Grid, Text, VStack } from '@chakra-ui/react'
import { hgVariant, useAsset } from '@bze/bze-ui-kit'
import { FactoryDialog } from '@/components/ui/factory-dialog'
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
            <Box display={{ base: 'none', md: 'block' }} borderWidth="1px" borderColor="hg.divider" borderRadius="14px" overflow="hidden">
                <Grid templateColumns="minmax(0, 0.8fr) repeat(3, minmax(0, 1fr))" fontSize="13px" role="table" aria-label="Rewards compared">
                    <Box role="row" display="contents">
                        <Box role="columnheader" p="12px" bg="hg.cardHeader" />
                        {KINDS.map(kind => (
                            <Box key={kind} role="columnheader" p="12px" bg="hg.cardHeader" fontWeight="700">{KIND_NAMES[kind]}</Box>
                        ))}
                    </Box>
                    {COMPARISON.map(row => (
                        <Box key={row.label} role="row" display="contents">
                            <Box role="rowheader" px="12px" py="11px" borderTopWidth="1px" borderColor="hg.divider" color="hg.text.muted">{row.label}</Box>
                            {KINDS.map(kind => (
                                <Box key={kind} role="cell" px="12px" py="11px" borderTopWidth="1px" borderColor="hg.divider">{row.values[kind]}</Box>
                            ))}
                        </Box>
                    ))}
                </Grid>
            </Box>

            {/* Phones: one card per reward kind */}
            <VStack display={{ base: 'flex', md: 'none' }} align="stretch" gap="12px" data-testid="reward-comparison-stacked">
                {KINDS.map(kind => (
                    <Box key={kind} borderWidth="1px" borderColor="hg.divider" borderRadius="14px" bg="hg.inset" p="14px">
                        <Text fontWeight="700" mb="8px">{KIND_NAMES[kind]}</Text>
                        <VStack align="stretch" gap="6px" fontSize="13px">
                            {COMPARISON.map(row => (
                                <Box key={row.label}>
                                    <Text as="span" color="hg.text.muted">{row.label}: </Text>
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
        <FactoryDialog
            open={open}
            onClose={onClose}
            title="Which reward fits?"
            description="Three ways to reward people. Pick the sentence that sounds like you."
            width="900px"
            titleSize="lg"
            closeLabel="Close dialog"
            finalFocusEl={finalFocusEl}
            footer={(
                <>
                    <Text fontSize="14px" color="hg.text.muted" flex="1" minW="200px">
                        Not sure? Start with holder rewards. You can add a campaign or an airdrop later.
                    </Text>
                    <Box display="flex" gap="10px" flexWrap="wrap">
                        <Button variant={hgVariant('secondary')} size="lg" onClick={onClose}>Close</Button>
                        <Button variant={hgVariant('primary')} size="lg" onClick={goPrimary}>{primary.label}</Button>
                    </Box>
                </>
            )}
        >
            <VStack align="stretch" gap="20px">
                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap="12px">
                    {CARDS.map(card => {
                        const lead = card.kind === 'holder'
                        return (
                            <Box
                                key={card.kind}
                                as="button"
                                onClick={() => pick(card.kind)}
                                textAlign="start"
                                p="16px"
                                borderWidth="1px"
                                borderRadius="16px"
                                borderColor={lead ? 'app.border' : 'hg.hairline'}
                                bg={lead ? 'app.subtle' : 'transparent'}
                                cursor="pointer"
                                transition="border-color 0.15s"
                                _hover={{ borderColor: 'app.focusRing' }}
                                focusVisibleRing="outside"
                                data-testid={`reward-guide-${card.kind}`}
                            >
                                <VStack align="start" gap="10px">
                                    {lead ? (
                                        <chakra.span fontSize="11px" fontWeight="700" px="8px" py="3px" borderRadius="hg.pill" bgImage="app" color="hg.buttonText">
                                            {card.badge}
                                        </chakra.span>
                                    ) : (
                                        <Badge variant={hgVariant('neutral')} size="sm" borderRadius="hg.pill">{card.badge}</Badge>
                                    )}
                                    <Text fontSize="15px" fontWeight="700" lineHeight="1.4">&ldquo;{card.quote}&rdquo;</Text>
                                    <Text fontSize="13px" lineHeight="1.5" color="hg.text.muted">{card.text}</Text>
                                    <Text fontSize="14px" fontWeight="700" color="hg.link">→ {KIND_NAMES[card.kind]}</Text>
                                </VStack>
                            </Box>
                        )
                    })}
                </Grid>

                <ComparisonTable />
            </VStack>
        </FactoryDialog>
    )
}
