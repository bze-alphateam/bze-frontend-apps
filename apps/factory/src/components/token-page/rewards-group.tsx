"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuChevronDown, LuChevronRight, LuRefreshCw } from 'react-icons/lu'
import {
    DenomRewardPrize,
    DenomRewardSchedule,
    Shimmer,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useCreationFees,
    useEpochs,
    useLiquidityPools,
} from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { withReturn } from '@/components/guided/return-to'
import { softButton } from '@/components/ui/soft-button'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { hasStaked, stakersAirdropHref } from '@/lib/airdrop'
import { compoundedNewHref, formatLastPaid, scheduleDaysLeft, scheduleFormHref } from '@/lib/denom-reward'
import { daysLeftText, extendHref } from '@/lib/reward-extend'
import { dailyPrizeLine, stakesToken } from '@/lib/token-page'
import { ActionGroup, ActionItem, ItemButton, ItemLink, type GroupProps } from './action-group'

const formatDays = (days: number) => `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align="stretch" gap="3px" bg="hg.inset" borderRadius="12px" px="12px" py="10px" minW={0}>
            <Text fontSize="11px" color="fg.muted">{label}</Text>
            <Box fontSize="13px" fontWeight="700" wordBreak="break-word">{value}</Box>
        </VStack>
    )
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
            <ItemLink href={href}>Extend prize</ItemLink>
        </HStack>
    )
}

function PrizeLastPaid({ prize, currentDayEpoch }: { prize: DenomRewardPrize; currentDayEpoch?: string }) {
    const { asset } = useAsset(prize.prize_denom)
    return (
        <HStack justify="space-between" gap="10px" fontSize="12px" data-testid="holder-prize">
            <Text>{asset?.ticker ?? prize.prize_denom}</Text>
            <Text color="fg.muted">{`Last paid ${formatLastPaid(prize.last_distribution_epoch, currentDayEpoch)}`}</Text>
        </HStack>
    )
}

/** The compounded reward of the token: its daily prizes and actions, or the way to make it stakable. */
function CompoundedItem({ asset, back }: Pick<GroupProps, 'asset' | 'back'>) {
    const ticker = asset.ticker
    const { denomReward, schedules, prizes, isLoading, hasError, refresh } = useDenomReward(asset.denom)
    const { denomRewardLimits } = useCreationFees()
    const { dayEpochInfo } = useEpochs()
    const [showDetails, setShowDetails] = useState(false)

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
                line="Holders stake it and share daily prizes. Anyone can set it up; it gives no special rights."
                action={<ItemLink href={withReturn(compoundedNewHref(asset.denom), back)} primary>{`Make ${ticker} stakable`}</ItemLink>}
            />
        )
    }

    const hasStakers = new BigNumber(denomReward.staked_amount || 0).gt(0)
    const running = schedules.filter(s => scheduleDaysLeft(s) > 0)
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const minStake = uAmountToBigNumberAmount(denomReward.min_stake, asset.decimals)

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
                    {hasStakers
                        ? <ItemLink href={withReturn(stakersAirdropHref(asset.denom), back)}>Airdrop</ItemLink>
                        : <ItemButton onClick={() => undefined} disabled>Airdrop</ItemButton>}
                </HStack>
                {!hasStakers && (
                    <Text fontSize="12px" color="fg.muted" data-testid="airdrop-disabled">
                        {`Airdrops open once someone is staking ${ticker}.`}
                    </Text>
                )}
                <Box>
                    <Button
                        variant="ghost"
                        size="sm"
                        px="4px"
                        color="hg.link"
                        fontWeight="600"
                        fontSize="13px"
                        aria-expanded={showDetails}
                        onClick={() => setShowDetails(v => !v)}
                    >
                        {showDetails ? <LuChevronDown /> : <LuChevronRight />} Details
                    </Button>
                </Box>
                {showDetails && (
                    <VStack align="stretch" gap="10px" data-testid="compounded-details">
                        <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap="8px">
                            <Fact label="Staked" value={`${prettyAmount(uAmountToBigNumberAmount(denomReward.staked_amount, asset.decimals))} ${ticker}`} />
                            <Fact label="Unstaking wait" value={formatDays(denomReward.lock)} />
                            <Fact label="Minimum stake" value={minStake.gt(0) ? `${prettyAmount(minStake)} ${ticker}` : 'No minimum'} />
                            <Fact
                                label="Prize tokens used"
                                value={<span data-testid="holder-prize-slots">{maxPrizes !== undefined ? `${prizes.length} of ${maxPrizes}` : `${prizes.length} used`}</span>}
                            />
                        </Grid>
                        {prizes.map(prize => (
                            <PrizeLastPaid key={prize.prize_denom} prize={prize} currentDayEpoch={dayEpochInfo?.current_epoch?.toString()} />
                        ))}
                    </VStack>
                )}
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
                <HStack gap="8px">
                    <ItemLink href={withReturn(extendHref(reward.reward_id), back)}>Extend</ItemLink>
                    {hasStaked({ staked: reward.staked_amount }) && (
                        <ItemLink href={withReturn(stakersAirdropHref(reward.staking_denom, reward.reward_id), back)}>Airdrop</ItemLink>
                    )}
                </HStack>
            )}
        />
    )
}

/**
 * Rewards on the token: everything paying its stakers, all permissionless (anyone can add). The
 * compounded reward with its daily prizes, the simple rewards that stake it, a new simple reward.
 */
export function RewardsGroup({ asset, back }: GroupProps) {
    const ticker = asset.ticker
    const { rewards, isLoading, hasError, refresh } = useStakingRewards()
    const { pools } = useLiquidityPools()
    const [now] = useState(() => new Date())
    const simple = useMemo(() => rewards.filter(r => stakesToken(r, asset.denom, pools)), [rewards, asset.denom, pools])

    return (
        <ActionGroup id="rewards" title={`Rewards on ${ticker}`} description={`Everything paying ${ticker} stakers. Anyone can add.`}>
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
            <ActionItem
                testId="new-simple-reward"
                title="Create a simple reward"
                line={`People stake ${ticker} and earn a prize, day by day, for as long as you pay.`}
                action={<ItemLink href={withReturn(`/reward/new?staking=${encodeURIComponent(asset.denom)}`, back)}>Create</ItemLink>}
            />
        </ActionGroup>
    )
}
