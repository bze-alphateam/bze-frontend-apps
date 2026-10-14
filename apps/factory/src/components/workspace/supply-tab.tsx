"use client"

import React from 'react'
import { Button, Grid, HStack, Skeleton, VStack } from '@chakra-ui/react'
import { LuArrowUpRight, LuFlame } from 'react-icons/lu'
import { getBurnerApp, prettyAmount } from '@bze/bze-ui-kit'
import { StatBox } from './stat-box'
import { SupplyActionCard } from './supply-action-card'
import type { WorkspaceTabProps } from './types'

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

/** Today's supply section of the manage page: stats, burner link, mint and burn for the admin. */
export function SupplyTab({ asset, admin, adminState, supplyDisplay, isSupplyLoading, balanceDisplay, refreshSupply }: WorkspaceTabProps) {
    return (
        <VStack align="stretch" gap={6}>
            <HStack gap={3} flexWrap="wrap" align="stretch">
                <StatBox
                    label="Total supply"
                    value={
                        isSupplyLoading
                            ? <Skeleton height="4" width="24" />
                            : `${prettyAmount(supplyDisplay)} ${asset.ticker}`
                    }
                />
                <StatBox
                    label="Your balance"
                    value={`${prettyAmount(balanceDisplay)} ${asset.ticker}`}
                />
                <StatBox
                    label="Admin"
                    value={
                        adminState === 'unknown' ? 'Unknown'
                            : adminState === 'renounced' ? 'Nobody — renounced'
                                : adminState === 'admin' ? 'You'
                                    : admin
                    }
                />
            </HStack>

            <HStack gap={2} flexWrap="wrap">
                <Button
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => openExternal(`${getBurnerApp().href}/coin?coin=${encodeURIComponent(asset.denom)}`)}
                >
                    <LuFlame /> Burn in Burner dApp <LuArrowUpRight />
                </Button>
            </HStack>

            {adminState === 'admin' && (
                <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                    <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="mint" onDone={refreshSupply} />
                    <SupplyActionCard asset={asset} currentSupply={supplyDisplay} mode="burn" onDone={refreshSupply} />
                </Grid>
            )}
        </VStack>
    )
}
