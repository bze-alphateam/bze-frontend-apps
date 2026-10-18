"use client"

import React from 'react'
import { Box, Button, Card, Grid, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw, LuTicket } from 'react-icons/lu'
import { AppLink, type Asset, formatTimeRemainingFromEpochs, getBurnerApp, useEpochs } from '@bze/bze-ui-kit'
import { useTokenRaffle } from '@/hooks/useTokenRaffle'
import { burnerCoinHref, displayAmount, oneInFromChances, percentFromRatio, raffleHref } from '@/lib/raffle-new'
import { workspaceHref } from '@/lib/workspace'
import { StatBox } from './stat-box'

interface RaffleCardProps {
    asset: Asset;
    /** Follows an internal link (the workspace's `goTo`). */
    goTo: (href: string) => void;
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
        <Card.Root variant="outline" p="4" data-testid="raffle-card">
            <VStack align="stretch" gap={3}>
                <HStack gap={2}>
                    <LuTicket />
                    <Text fontWeight="semibold">Burning raffle</Text>
                </HStack>

                {raffle.status === 'loading' ? (
                    <Skeleton height="10" />
                ) : raffle.status === 'error' ? (
                    <HStack gap={3} wrap="wrap">
                        <Text fontSize="sm" color="fg.muted">{`Couldn't load the raffle for ${ticker}.`}</Text>
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={refresh}>
                            <LuRefreshCw />
                            Retry
                        </Button>
                    </HStack>
                ) : raffle.status === 'running' ? (
                    <VStack align="stretch" gap={3}>
                        <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }} gap={3}>
                            <StatBox minW="0" label="Pot" value={amount(raffle.raffle.pot)} />
                            <StatBox minW="0" label="Ticket price" value={amount(raffle.raffle.ticket_price)} />
                            <StatBox minW="0" label="Win chance" value={`1 in ${oneInFromChances(raffle.raffle.chances).toLocaleString('en-US')}`} />
                            <StatBox minW="0" label="A winner gets" value={`${percentFromRatio(raffle.raffle.ratio)} % of the pot`} />
                            <StatBox
                                minW="0"
                                label="Time left"
                                value={hourEpochInfo
                                    ? formatTimeRemainingFromEpochs(raffle.raffle.end_at, hourEpochInfo.current_epoch)
                                    : <Skeleton height="4" width="16" />}
                            />
                        </Grid>
                        <Box fontSize="sm" alignSelf="start">
                            <AppLink app="burner" href={burnerHref}>Burner</AppLink>
                        </Box>
                    </VStack>
                ) : (
                    <VStack align="start" gap={3}>
                        <Text fontSize="sm" color="fg.muted">
                            {"Run a raffle: people buy tickets to win from a pot you fund, and what's left at the end is burned."}
                        </Text>
                        <Box>
                            <Button
                                size="sm"
                                colorPalette="yellow"
                                onClick={() => goTo(raffleHref(asset.denom, { href: workspaceHref(asset.denom, 'supply'), label: ticker }))}
                            >
                                Start a burning raffle
                            </Button>
                        </Box>
                    </VStack>
                )}
            </VStack>
        </Card.Root>
    )
}
