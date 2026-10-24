"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import {
    AppLink,
    DenomRewardSchedule,
    Shimmer,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useLiquidityPools,
} from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { withReturn } from '@/components/guided/return-to'
import { softButton } from '@/components/ui/soft-button'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { hasStaked, stakersAirdropHref } from '@/lib/airdrop'
import { dexRewardHref } from '@/lib/create-routes'
import { compoundedNewHref, scheduleDaysLeft, scheduleFormHref } from '@/lib/denom-reward'
import { daysLeftText, extendHref } from '@/lib/reward-extend'
import { dailyPrizeLine, stakesToken } from '@/lib/token-page'
import { ActionGroup, ActionItem, ItemLink, type GroupProps } from './action-group'

/** A reward's page on the DEX (its facts, prizes and staking), in a new tab. */
function DexDetailsLink({ rowId }: { rowId: string }) {
    return <AppLink app="dex" href={dexRewardHref(getDexApp().href, rowId)}>Details</AppLink>
}

/** One daily prize of the compounded reward, with its Extend. */
function ScheduleLine({ schedule, href }: { schedule: DenomRewardSchedule; href: string }) {
    const { asset } = useAsset(schedule.prize_denom)
    const ticker = asset?.ticker ?? schedule.prize_denom
    const perDay = `${prettyAmount(uAmountToBigNumberAmount(schedule.daily_amount, asset?.decimals ?? 0))} ${ticker}`
    const left = scheduleDaysLeft(schedule)

    return (
        <HStack justify="space-between" gap="10px" flexWrap="wrap" data-testid="daily-prize-line">
            <Text fontSize="13px" color="fg">{left > 0 ? dailyPrizeLine(perDay, left) : `${perDay} a day · finished`}</Text>
            <ItemLink href={href}>Extend</ItemLink>
        </HStack>
    )
}

/** The compounded reward of the token: its daily prizes and actions, or the way to make it stakable. */
function CompoundedItem({ asset, back }: Pick<GroupProps, 'asset' | 'back'>) {
    const ticker = asset.ticker
    const { denomReward, schedules, isLoading, hasError, refresh } = useDenomReward(asset.denom)

    if (isLoading) {
        return (
            <Box py="14px" borderTopWidth="1px" borderColor="hg.divider" data-testid="compounded-loading">
                <Shimmer h="16px" w="160px" />
                <Shimmer h="12px" w="224px" mt="8px" />
            </Box>
        )
    }
    if (hasError) {
        return (
            <ActionItem
                testId="compounded-item"
                title="Compounded reward"
                line={`Couldn't check whether ${ticker} has a compounded reward.`}
                action={(
                    <Button {...softButton} size="sm" h="36px" onClick={() => void refresh()}>
                        <LuRefreshCw /> Retry
                    </Button>
                )}
            />
        )
    }
    if (!denomReward) {
        return (
            <ActionItem
                testId="compounded-item"
                title={`Make ${ticker} stakable`}
                action={<ItemLink href={withReturn(compoundedNewHref(asset.denom), back)} primary>Create</ItemLink>}
            />
        )
    }

    const running = schedules.filter(s => scheduleDaysLeft(s) > 0)

    return (
        <ActionItem
            testId="compounded-item"
            title="Compounded reward"
            line={running.length === 0 ? 'Stakable, no daily prize running.' : `${running.length} daily prize${running.length === 1 ? '' : 's'} running.`}
        >
            <VStack align="stretch" gap="12px">
                {schedules.length > 0 && (
                    <VStack align="stretch" gap="8px">
                        {schedules.map(s => (
                            <ScheduleLine key={s.schedule_id} schedule={s} href={withReturn(scheduleFormHref(asset.denom, s.schedule_id), back)} />
                        ))}
                    </VStack>
                )}
                <HStack gap="8px" flexWrap="wrap" data-testid="compounded-actions">
                    <ItemLink href={withReturn(scheduleFormHref(asset.denom), back)} primary={running.length === 0}>Add daily prize</ItemLink>
                    <DexDetailsLink rowId={`compounded:${asset.denom}`} />
                </HStack>
            </VStack>
        </ActionItem>
    )
}

/** One simple reward that stakes the token or its LP shares. */
function SimpleRewardRow({ reward, now, back }: { reward: StakingRewardSDKType; now: Date; back: GroupProps['back'] }) {
    const { asset: stakingAsset } = useAsset(reward.staking_denom)
    const { asset: prizeAsset } = useAsset(reward.prize_denom)
    const prizeTicker = prizeAsset?.ticker ?? reward.prize_denom
    const perDay = `${prettyAmount(uAmountToBigNumberAmount(reward.prize_amount, prizeAsset?.decimals ?? 0))} ${prizeTicker}`

    return (
        <ActionItem
            testId="simple-reward-row"
            title={`Simple reward · stake ${stakingAsset?.ticker ?? reward.staking_denom}`}
            line={`${perDay} a day · ${daysLeftText(reward, now)}`}
            action={(
                <HStack gap="8px" flexWrap="wrap">
                    <ItemLink href={withReturn(extendHref(reward.reward_id), back)}>Extend</ItemLink>
                    {hasStaked({ staked: reward.staked_amount }) && (
                        <ItemLink href={withReturn(stakersAirdropHref(reward.staking_denom, reward.reward_id), back)}>Airdrop</ItemLink>
                    )}
                    <DexDetailsLink rowId={`simple:${reward.reward_id}`} />
                </HStack>
            )}
        />
    )
}

/**
 * Rewards on the token: everything paying its stakers, all permissionless (anyone can add). The
 * compounded reward with its daily prizes, then the simple rewards that stake it.
 */
export function RewardsGroup({ asset, back }: GroupProps) {
    const ticker = asset.ticker
    const { rewards, isLoading, hasError, refresh } = useStakingRewards()
    const { pools } = useLiquidityPools()
    const [now] = useState(() => new Date())
    const simple = useMemo(() => rewards.filter(r => stakesToken(r, asset.denom, pools)), [rewards, asset.denom, pools])

    return (
        <ActionGroup id="rewards" title={`Rewards on ${ticker}`}>
            <CompoundedItem asset={asset} back={back} />
            {isLoading ? (
                <Box py="14px" borderTopWidth="1px" borderColor="hg.divider" data-testid="simple-rewards-loading">
                    <Shimmer h="16px" w="160px" />
                </Box>
            ) : hasError ? (
                <ActionItem
                    title="Simple rewards"
                    line="Couldn't load the simple rewards."
                    action={(
                        <Button {...softButton} size="sm" h="36px" onClick={refresh}>
                            <LuRefreshCw /> Retry
                        </Button>
                    )}
                />
            ) : (
                simple.map(r => <SimpleRewardRow key={r.reward_id} reward={r} now={now} back={back} />)
            )}
        </ActionGroup>
    )
}
