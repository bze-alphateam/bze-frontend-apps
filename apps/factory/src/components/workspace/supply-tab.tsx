"use client"

import React from 'react'
import { Box, Button, Card, Grid, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { AppLink, getBurnerApp, isLpDenom, prettyAmount, truncateAddress } from '@bze/bze-ui-kit'
import { InfoBox } from '@/components/ui/info-box'
import { shareOfSupply } from '@/lib/supply'
import type { AdminState } from '@/lib/workspace'
import { RaffleCard } from './raffle-card'
import { StatBox } from './stat-box'
import { SupplyActionCard } from './supply-action-card'
import type { WorkspaceTabProps } from './types'

function whoCanMint(state: AdminState, admin: string | undefined): string {
    switch (state) {
        case 'admin': return 'You'
        case 'renounced': return 'Nobody, supply is fixed'
        case 'not-admin': return truncateAddress(admin ?? '')
        default: return 'Unknown'
    }
}

/** Why mint and burn are hidden, for everyone but the admin. */
function StateNotice({ state, admin, ticker, onRetry }: { state: AdminState; admin?: string; ticker: string; onRetry: () => void }) {
    if (state === 'renounced') {
        return <InfoBox>{`Supply is fixed forever. Nobody can mint ${ticker}, you included.`}</InfoBox>
    }
    if (state === 'not-admin') {
        return <InfoBox><Text as="span" overflowWrap="anywhere">{`Minting is controlled by ${admin}.`}</Text></InfoBox>
    }
    return (
        <VStack align="stretch" gap={3}>
            <InfoBox>{`Couldn't load who controls ${ticker}. Mint and burn stay hidden until it loads.`}</InfoBox>
            <Box>
                <Button size="sm" variant="outline" colorPalette="yellow" onClick={onRetry}>
                    <LuRefreshCw />
                    Retry
                </Button>
            </Box>
        </VStack>
    )
}

/** Supply facts, mint more and burn for the admin, and the Burner app for everyone. */
export function SupplyTab({ asset, admin, adminState, supplyDisplay, isSupplyLoading, balanceDisplay, refreshSupply, refreshAdmins, goTo }: WorkspaceTabProps) {
    const ticker = asset.ticker
    const burnerHref = `${getBurnerApp().href}/coin?coin=${encodeURIComponent(asset.denom)}`

    return (
        <VStack align="stretch" gap={6}>
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }} gap={3}>
                <StatBox
                    minW="0"
                    label="Total supply"
                    value={isSupplyLoading ? <Skeleton height="4" width="24" /> : `${prettyAmount(supplyDisplay)} ${ticker}`}
                />
                <StatBox
                    minW="0"
                    label="In your wallet"
                    value={`${prettyAmount(balanceDisplay)} ${ticker}`}
                    hint={shareOfSupply(balanceDisplay, supplyDisplay)}
                />
                <StatBox minW="0" label="Who can mint" value={<span data-testid="who-can-mint">{whoCanMint(adminState, admin)}</span>} />
            </Grid>

            {adminState === 'admin' ? (
                <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap={4}>
                    <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="mint" onDone={refreshSupply} />
                    <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="burn" onDone={refreshSupply} />
                </Grid>
            ) : (
                <Box data-testid="supply-notice">
                    <StateNotice state={adminState} admin={admin} ticker={ticker} onRetry={() => void refreshAdmins()} />
                </Box>
            )}

            <Card.Root variant="outline" p="4">
                <VStack align="start" gap={2}>
                    <AppLink app="burner" href={burnerHref}>Burner</AppLink>
                    <Text fontSize="sm" color="fg.muted">
                        {`Anyone can burn ${ticker} they hold in the Burner app, and see the burn history there.`}
                    </Text>
                </VStack>
            </Card.Root>

            {/* Halted tokens are worthless and LP shares can't be raffled. */}
            {!asset.halted && !isLpDenom(asset.denom) && <RaffleCard asset={asset} goTo={goTo} />}
        </VStack>
    )
}
