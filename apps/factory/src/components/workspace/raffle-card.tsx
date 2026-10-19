"use client"

import React from 'react'
import { Box, Button, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw, LuTicket } from 'react-icons/lu'
import { AppLink, type Asset, HgCard, Shimmer, formatTimeRemainingFromEpochs, getBurnerApp, hgVariant, useEpochs } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import { useTokenRaffle } from '@/hooks/useTokenRaffle'
import { burnerCoinHref, displayAmount, oneInFromChances, percentFromRatio, raffleHref } from '@/lib/raffle-new'
import { workspaceHref } from '@/lib/workspace'

interface RaffleCardProps {
    asset: Asset;
    /** Follows an internal link (the workspace's `goTo`). */
    goTo: (href: string) => void;
}

/** One raffle figure on the inset. */
function RaffleFact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align="stretch" gap="3px" bg="hg.inset" borderRadius="12px" px="12px" py="10px" minW={0}>
            <Text fontSize="11px" color="fg.muted">{label}</Text>
            <Box fontSize="13px" fontWeight="700" wordBreak="break-word">{value}</Box>
        </VStack>
    )
}

/**
 * "Burning raffle" in the Supply tab (BFE-208), for everyone: the running raffle of the token,
 * or a way to start one. A failed lookup says so and never reads as "none running".
 */
export function RaffleCard({ asset, goTo }: RaffleCardProps) {
    const { raffle, refresh } = useTokenRaffle(asset.denom)
    const { hourEpochInfo } = useEpochs()
    const ticker = asset.ticker
    const burnerHref = burnerCoinHref(getBurnerApp().href, asset.denom)
    const amount = (base: string) => `${displayAmount(base, asset.decimals)} ${ticker}`

    return (
        <HgCard as="section" aria-label="Burning raffle" p="20px" data-testid="raffle-card">
            <VStack align="stretch" gap="12px">
                <HStack gap="8px">
                    <Box color="hg.link" aria-hidden><LuTicket size={18} /></Box>
                    <Text as="h2" fontSize="16px" fontWeight="700">Burning raffle</Text>
                </HStack>

                {raffle.status === 'loading' ? (
                    <Shimmer h="40px" borderRadius="12px" />
                ) : raffle.status === 'error' ? (
                    <HStack gap="12px" wrap="wrap">
                        <Text fontSize="14px" color="fg.muted">{`Couldn't load the raffle for ${ticker}.`}</Text>
                        <Button {...softButton} size="sm" onClick={refresh}>
                            <LuRefreshCw />
                            Retry
                        </Button>
                    </HStack>
                ) : raffle.status === 'running' ? (
                    <VStack align="stretch" gap="12px">
                        <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }} gap="8px">
                            <RaffleFact label="Pot" value={amount(raffle.raffle.pot)} />
                            <RaffleFact label="Ticket price" value={amount(raffle.raffle.ticket_price)} />
                            <RaffleFact label="Win chance" value={`1 in ${oneInFromChances(raffle.raffle.chances).toLocaleString('en-US')}`} />
                            <RaffleFact label="A winner gets" value={`${percentFromRatio(raffle.raffle.ratio)} % of the pot`} />
                            <RaffleFact
                                label="Time left"
                                value={hourEpochInfo
                                    ? formatTimeRemainingFromEpochs(raffle.raffle.end_at, hourEpochInfo.current_epoch)
                                    : <Shimmer h="14px" w="64px" />}
                            />
                        </Grid>
                        <Box alignSelf="start">
                            <AppLink app="burner" href={burnerHref}>Burner</AppLink>
                        </Box>
                    </VStack>
                ) : (
                    <VStack align="start" gap="12px">
                        <Text fontSize="14px" lineHeight="1.5" color="fg.muted">
                            {"Run a raffle: people buy tickets to win from a pot you fund, and what's left at the end is burned."}
                        </Text>
                        <Box>
                            <Button
                                variant={hgVariant('primary')}
                                size="md"
                                onClick={() => goTo(raffleHref(asset.denom, { href: workspaceHref(asset.denom, 'supply'), label: ticker }))}
                            >
                                Start a burning raffle
                            </Button>
                        </Box>
                    </VStack>
                )}
            </VStack>
        </HgCard>
    )
}
