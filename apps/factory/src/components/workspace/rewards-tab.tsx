"use client"

import React from 'react'
import { Text, VStack } from '@chakra-ui/react'
import { withReturn } from '@/components/guided/return-to'
import { HolderRewardsPanel } from '@/components/rewards/holder-rewards-panel'
import { StakingProgramsList } from '@/components/rewards/staking-programs-list'
import { workspaceHref } from '@/lib/workspace'
import type { WorkspaceTabProps } from './types'

/**
 * Not admin actions: anyone may create and fund a token's compounded reward, and anyone may run or
 * extend a simple reward with it.
 */
export function RewardsTab({ asset }: WorkspaceTabProps) {
    const backHere = { href: workspaceHref(asset.denom, 'rewards'), label: asset.ticker }

    return (
        <VStack align="stretch" gap={8}>
            <HolderRewardsPanel asset={asset} returnTo={backHere} />

            <VStack as="section" aria-label={`Simple rewards with ${asset.ticker}`} align="stretch" gap={3}>
                <VStack align="start" gap={1}>
                    <Text fontSize="lg" fontWeight="semibold">{`Simple rewards with ${asset.ticker}`}</Text>
                    <Text fontSize="sm" color="fg.muted">
                        {`Programs where people stake ${asset.ticker} or a ${asset.ticker} LP token, or earn ${asset.ticker}.`}
                    </Text>
                </VStack>
                <StakingProgramsList
                    involving={asset.denom}
                    newProgramHref={withReturn(`/reward/new?staking=${encodeURIComponent(asset.denom)}`, backHere)}
                />
            </VStack>
        </VStack>
    )
}
