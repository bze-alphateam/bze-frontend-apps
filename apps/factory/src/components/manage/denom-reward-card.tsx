"use client"

import React, { useState } from 'react'
import { Badge, Box, Button, Card, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuCalendarPlus, LuGift, LuPlus, LuRefreshCw, LuUsers } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    Asset,
    DenomRewardSchedule,
    TokenLogo,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useCreationFees,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigation } from '@/hooks/useNavigation'
import { FeeDisclosure } from '@/components/ui/fee-disclosure'
import { InfoBox } from '@/components/ui/info-box'
import { scheduleDaysLeft, scheduleFormHref, scheduleRemainingBudget } from '@/lib/denom-reward'

const { createDenomReward } = bze.rewards.MessageComposer.withTypeUrl

const formatDays = (days: number) => `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align="start" gap={0.5} flex="1" minW="32">
            <Text fontSize="xs" color="fg.muted">{label}</Text>
            <Box fontSize="sm" fontWeight="semibold" wordBreak="break-all">{value}</Box>
        </VStack>
    )
}

function ScheduleRow({ schedule, onExtend }: { schedule: DenomRewardSchedule; onExtend: () => void }) {
    const { asset: prizeAsset } = useAsset(schedule.prize_denom)
    const decimals = prizeAsset?.decimals ?? 0
    const ticker = prizeAsset?.ticker ?? schedule.prize_denom
    const daily = uAmountToBigNumberAmount(schedule.daily_amount, decimals)
    const remaining = uAmountToBigNumberAmount(scheduleRemainingBudget(schedule), decimals)

    return (
        <Box p={3} borderWidth="1px" borderColor="border.muted" borderRadius="lg" data-testid="denom-reward-schedule">
            <HStack justify="space-between" gap={3} flexWrap="wrap">
                <HStack gap={2}>
                    <TokenLogo src={prizeAsset?.logo} symbol={ticker} size="6" circular={true} />
                    <VStack align="start" gap={0}>
                        <Text fontSize="sm" fontWeight="semibold">
                            {prettyAmount(daily)} {ticker} / day
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                            {schedule.payouts.toLocaleString('en-US')} of {formatDays(schedule.duration)} paid ·{' '}
                            {formatDays(scheduleDaysLeft(schedule))} left
                        </Text>
                    </VStack>
                </HStack>
                <HStack gap={3}>
                    <VStack align="end" gap={0}>
                        <Text fontSize="xs" color="fg.muted">Remaining budget</Text>
                        <Text fontSize="sm" fontWeight="semibold">{prettyAmount(remaining)} {ticker}</Text>
                    </VStack>
                    <Button size="xs" variant="outline" colorPalette="yellow" onClick={onExtend}>
                        <LuCalendarPlus /> Extend
                    </Button>
                </HStack>
            </HStack>
        </Box>
    )
}

/**
 * The token's denom reward (chain v8.2.0): one permissionless staking pool per denom where anyone
 * can fund daily prize schedules and holders earn by staking the token. Shown to every wallet —
 * creating and funding a DR grants no rights over it, so it is not an admin action.
 */
export function DenomRewardCard({ asset }: { asset: Asset }) {
    const { address } = useChain(getChainName())
    const { navigate } = useNavigation()
    const { tx } = useFactoryTx()
    const { denomReward, schedules, isLoading, hasError, refresh } = useDenomReward(asset.denom)
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()
    const fee = fees.createDenomRewardFee
    const feePayment = useFeePayment(fee, 'create-denom-reward')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const create = async () => {
        if (!address) return
        setIsSubmitting(true)
        try {
            await tx([createDenomReward({ creator: address, denom: asset.denom })], {
                onSuccess: () => { void refresh() },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const minStakeLabel = (uAmount?: string) => {
        if (uAmount === undefined) return 'Unknown'
        const display = uAmountToBigNumberAmount(uAmount, asset.decimals)
        return display.gt(0) ? `${prettyAmount(display)} ${asset.ticker}` : 'No minimum'
    }

    return (
        <Card.Root variant="outline" p="5" data-testid="denom-reward-card">
            <VStack align="stretch" gap={4}>
                <HStack gap={2} justify="space-between" flexWrap="wrap">
                    <HStack gap={2}>
                        <Box p={2} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                            <LuGift size={18} />
                        </Box>
                        <Text fontWeight="semibold">Denom reward</Text>
                    </HStack>
                    {denomReward && (
                        <Badge colorPalette="green" variant="surface" size="sm">Live</Badge>
                    )}
                </HStack>

                {isLoading ? (
                    <VStack align="stretch" gap={2}>
                        <Skeleton height="4" width="64" />
                        <Skeleton height="16" />
                    </VStack>
                ) : hasError ? (
                    <VStack align="stretch" gap={3}>
                        <InfoBox title="Couldn't load the denom reward">
                            The chain query failed, so we can&apos;t tell whether this token has a denom
                            reward. The node may be down, or not run chain v8.2.0 yet.
                        </InfoBox>
                        <Box>
                            <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => void refresh()}>
                                <LuRefreshCw /> Retry
                            </Button>
                        </Box>
                    </VStack>
                ) : !denomReward ? (
                    <VStack align="stretch" gap={4}>
                        <Text fontSize="sm" color="fg.muted">
                            Reward everyone who holds {asset.ticker}: a denom reward is a staking pool for
                            this token where anyone can fund daily prizes in any token, and holders earn
                            them by staking {asset.ticker}. Each token can have exactly one, and creating it
                            gives no special rights — anyone can create and fund it.
                        </Text>

                        <HStack gap={4} flexWrap="wrap">
                            <Stat
                                label="Unstaking lock (fixed at creation)"
                                value={denomRewardLimits.denomRewardLock === undefined ? 'Unknown' : formatDays(denomRewardLimits.denomRewardLock)}
                            />
                            <Stat
                                label="Minimum stake (fixed at creation)"
                                value={minStakeLabel(denomRewardLimits.denomRewardMinStake)}
                            />
                        </HStack>
                        <Text fontSize="xs" color="fg.muted">
                            These come from the chain parameters and are frozen into the denom reward
                            when it is created — later parameter changes don&apos;t affect it.
                        </Text>

                        <FeeDisclosure
                            fee={fee}
                            isLoading={isFeeLoading}
                            label="Denom reward creation fee"
                            txKind="create-denom-reward"
                        />

                        <VStack align="stretch" gap={2}>
                            <Button
                                colorPalette="yellow"
                                onClick={create}
                                disabled={!address || !fee || !feePayment.canPayFee}
                                loading={isSubmitting}
                                loadingText="Waiting for signature..."
                            >
                                <LuPlus /> Create denom reward
                            </Button>
                            {!address && (
                                <Text fontSize="sm" color="fg.muted" textAlign="center">
                                    Connect your wallet to create the denom reward.
                                </Text>
                            )}
                        </VStack>
                    </VStack>
                ) : (
                    <VStack align="stretch" gap={4}>
                        <HStack gap={4} flexWrap="wrap">
                            <Stat
                                label="Total staked"
                                value={
                                    <HStack gap={1}>
                                        <LuUsers size={14} />
                                        <span>{prettyAmount(uAmountToBigNumberAmount(denomReward.staked_amount, asset.decimals))} {asset.ticker}</span>
                                    </HStack>
                                }
                            />
                            <Stat label="Unstaking lock" value={formatDays(denomReward.lock)} />
                            <Stat label="Minimum stake" value={minStakeLabel(denomReward.min_stake)} />
                        </HStack>

                        <VStack align="stretch" gap={2}>
                            <Text fontSize="sm" fontWeight="semibold">Prize schedules</Text>
                            {schedules.length === 0 ? (
                                <Text fontSize="sm" color="fg.muted">
                                    No prize schedule is running. Add one to start paying {asset.ticker} stakers.
                                </Text>
                            ) : (
                                schedules.map(schedule => (
                                    <ScheduleRow
                                        key={schedule.schedule_id}
                                        schedule={schedule}
                                        onExtend={() => navigate(scheduleFormHref(asset.denom, schedule.schedule_id))}
                                    />
                                ))
                            )}
                            {schedules.length > 0 && (
                                <Text fontSize="xs" color="fg.muted">
                                    Days paid count payout days, not calendar days: a day nobody is staking is
                                    skipped without spending budget, so the schedule simply runs longer.
                                </Text>
                            )}
                        </VStack>

                        <Box>
                            <Button colorPalette="yellow" onClick={() => navigate(scheduleFormHref(asset.denom))}>
                                <LuPlus /> Add schedule
                            </Button>
                        </Box>
                    </VStack>
                )}
            </VStack>
        </Card.Root>
    )
}
