"use client"

import React from 'react'
import { Box, Button, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import { LuInfo, LuRefreshCw } from 'react-icons/lu'
import { AppLink, HgCard, Shimmer, getBurnerApp, isLpDenom, prettyAmount, truncateAddress } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
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
    const text = state === 'renounced'
        ? `Supply is fixed forever. Nobody can mint ${ticker}, you included.`
        : state === 'not-admin'
            ? `Minting is controlled by ${admin}.`
            : `Couldn't load who controls ${ticker}. Mint and burn stay hidden until it loads.`

    return (
        <HgCard px="16px" py="14px" borderRadius="14px" display="flex" flexDirection="column" gap="10px">
            <HStack align="start" gap="10px">
                <Box color="hg.link" mt="3px" flexShrink={0} aria-hidden><LuInfo size={16} /></Box>
                <Text fontSize="14px" lineHeight="1.5" overflowWrap="anywhere">{text}</Text>
            </HStack>
            {state === 'unknown' && (
                <Box>
                    <Button {...softButton} size="sm" onClick={onRetry}>
                        <LuRefreshCw />
                        Retry
                    </Button>
                </Box>
            )}
        </HgCard>
    )
}

/** Supply facts, mint more and burn for the admin, and the Burner app for everyone. */
export function SupplyTab({ asset, admin, adminState, supplyDisplay, isSupplyLoading, balanceDisplay, refreshSupply, refreshAdmins, goTo }: WorkspaceTabProps) {
    const ticker = asset.ticker
    const burnerHref = `${getBurnerApp().href}/coin?coin=${encodeURIComponent(asset.denom)}`

    return (
        <VStack align="stretch" gap="28px">
            <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }} gap={{ base: '12px', md: '16px' }}>
                <StatBox
                    minW="0"
                    label="Total supply"
                    value={isSupplyLoading ? <Shimmer h="18px" w="96px" /> : `${prettyAmount(supplyDisplay)} ${ticker}`}
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
                <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
                    <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="mint" onDone={refreshSupply} />
                    <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="burn" onDone={refreshSupply} />
                </Grid>
            ) : (
                <Box data-testid="supply-notice">
                    <StateNotice state={adminState} admin={admin} ticker={ticker} onRetry={() => void refreshAdmins()} />
                </Box>
            )}

            <HgCard px="20px" py="18px" display="flex" flexDirection="column" alignItems="flex-start" gap="10px">
                <AppLink app="burner" href={burnerHref}>Burner</AppLink>
                <Text fontSize="14px" color="fg.muted">
                    {`Anyone can burn ${ticker} they hold in the Burner app, and see the burn history there.`}
                </Text>
            </HgCard>

            {/* Halted tokens are worthless and LP shares can't be raffled. */}
            {!asset.halted && !isLpDenom(asset.denom) && <RaffleCard asset={asset} goTo={goTo} />}
        </VStack>
    )
}
