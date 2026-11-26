"use client"

import React, { useMemo } from 'react'
import NextLink from 'next/link'
import { Box, Button, Link, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { Shimmer, prettyAmount, uAmountToBigNumberAmount, type Dao, type DenomReward } from '@bze/bze-ui-kit'
import { withReturn } from '@/components/guided/return-to'
import { softButton } from '@/components/ui/soft-button'
import type { DaoParamsState } from '@/hooks/useDaoParams'
import { compoundedNewHref } from '@/lib/denom-reward'
import { simpleRewardHref } from '@/lib/create-routes'
import { type StakingRewardLike, leftOutLine, nobodyStakesLine, pickTokenElectorate, tokenDaoHref, votersLine } from '@/lib/token-dao'
import { ActionItem, ItemLink, type GroupProps } from './action-group'

interface CreateDaoItemProps extends Pick<GroupProps, 'asset' | 'back'> {
    params: DaoParamsState & { retry: () => void };
    /** The token's staking rewards as the group already loaded them. */
    staking: { rewards: ReadonlyArray<StakingRewardLike>; isLoading: boolean; hasError: boolean };
    /** The token's compounded reward as the group already loaded it. */
    denomReward: { value?: DenomReward; isLoading: boolean; hasError: boolean };
    /** The DAO that is the token's admin, when it is one (BFE-387). */
    daoAdmin?: Pick<Dao, 'id' | 'name'>;
}

/**
 * "Create a DAO for <TICKER>" (BFE-388): a stake DAO voted by the token's stakers. For anyone. Hidden on
 * a node without x/dao and while the rewards load or failed (the group has its own retry for those).
 */
export function CreateDaoItem({ asset, back, params, staking, denomReward, daoAdmin }: CreateDaoItemProps) {
    const ticker = asset.ticker
    const ready = params.status === 'ready' ? params.params : undefined
    const electorate = useMemo(
        () => ready && !staking.isLoading && !staking.hasError && !denomReward.isLoading && !denomReward.hasError
            ? pickTokenElectorate({ denom: asset.denom, rewards: staking.rewards, denomReward: denomReward.value, params: ready })
            : undefined,
        [ready, asset.denom, staking.rewards, staking.isLoading, staking.hasError, denomReward.value, denomReward.isLoading, denomReward.hasError],
    )

    if (params.status === 'unsupported') return null
    if (params.status === 'loading') return <Box py="14px" borderTopWidth="1px" borderColor="hg.divider" aria-busy="true" data-testid="create-dao-loading"><Shimmer h="16px" w="160px" /></Box>
    if (params.status === 'error') {
        return (
            <ActionItem
                testId="create-dao-item"
                title={`Create a DAO for ${ticker}`}
                line="Couldn't check whether this network supports DAOs."
                action={<Button {...softButton} size="sm" h="36px" onClick={params.retry}><LuRefreshCw /> Retry</Button>}
            />
        )
    }
    if (!electorate) return null

    const stakedText = `${prettyAmount(uAmountToBigNumberAmount(electorate.totalStaked.toFixed(0), asset.decimals))} ${ticker}`

    if (!electorate.hasSources) {
        const why = electorate.ineligible.length > 0
            ? `${electorate.ineligible.map(i => `${i.label}: ${i.reason}`).join('; ')}. A DAO needs rewards with at least ${electorate.minLock} days of lock.`
            : `A DAO is voted by the people who stake ${ticker}, in rewards with at least ${electorate.minLock} days of lock.`
        return (
            <ActionItem
                testId="create-dao-item"
                title={`Create a DAO for ${ticker}`}
                line={(
                    <VStack align="start" gap="4px">
                        <Text>{`No reward of ${ticker} can vote yet. ${why}`}</Text>
                        <Link asChild color="hg.link" fontWeight="600"><NextLink href={withReturn(compoundedNewHref(asset.denom), back)}>{`Make ${ticker} stakable`}</NextLink></Link>
                        <Link asChild color="hg.link" fontWeight="600"><NextLink href={withReturn(simpleRewardHref({ staking: asset.denom }), back)}>{`Create a simple reward with at least ${electorate.minLock} days of lock`}</NextLink></Link>
                    </VStack>
                )}
            />
        )
    }

    return (
        <ActionItem
            testId="create-dao-item"
            title={`Create a DAO for ${ticker}`}
            line={(
                <VStack align="start" gap="2px">
                    {daoAdmin && <Text data-testid="create-dao-existing">{`This token is run by DAO ${daoAdmin.name}.`}</Text>}
                    <Text>{electorate.live ? `${votersLine(electorate)} · total staked ${stakedText}` : nobodyStakesLine(ticker)}</Text>
                    {leftOutLine(electorate) && <Text>{leftOutLine(electorate)}</Text>}
                </VStack>
            )}
            action={<ItemLink href={withReturn(tokenDaoHref(asset.denom), back)} primary>Create</ItemLink>}
        />
    )
}
