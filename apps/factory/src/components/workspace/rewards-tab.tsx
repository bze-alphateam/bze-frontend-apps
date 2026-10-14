"use client"

import React from 'react'
import { Text, VStack } from '@chakra-ui/react'
import { DenomRewardCard } from '@/components/manage/denom-reward-card'
import { withReturn } from '@/components/guided/return-to'
import { StakingProgramsList } from '@/components/rewards/staking-programs-list'
import { workspaceHref } from '@/lib/workspace'
import type { WorkspaceTabProps } from './types'

/**
 * Not admin actions: anyone may create and fund a token's denom reward, and anyone may run or
 * extend a staking program with it.
 */
export function RewardsTab({ asset }: WorkspaceTabProps) {
    const backHere = { href: workspaceHref(asset.denom, 'rewards'), label: asset.ticker }

    return (
        <VStack align="stretch" gap={8}>
            <DenomRewardCard asset={asset} />

            <VStack as="section" aria-label={`Staking programs with ${asset.ticker}`} align="stretch" gap={3}>
                <VStack align="start" gap={1}>
                    <Text fontSize="lg" fontWeight="semibold">{`Staking programs with ${asset.ticker}`}</Text>
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
