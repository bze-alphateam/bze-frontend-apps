"use client"

import React, { useState } from 'react'
import { Badge, Box, Button, Card, HStack, Skeleton, Table, Text, VStack } from '@chakra-ui/react'
import { LuCalendarPlus, LuGift, LuPlus, LuRefreshCw, LuSend, LuSprout } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    Asset,
    DenomRewardPrize,
    DenomRewardSchedule,
    TokenLogo,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useCreationFees,
    useEpochs,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigation } from '@/hooks/useNavigation'
import { PayPanel } from '@/components/guided/pay-panel'
import { TipNote } from '@/components/guided/notes'
import { withReturn, type ReturnTo } from '@/components/guided/return-to'
import { InfoBox } from '@/components/ui/info-box'
import { RewardInfoButton } from '@/components/rewards/reward-info-button'
import {
    airdropFormHref,
    formatLastPaid,
    scheduleDaysLeft,
    scheduleFormHref,
    scheduleRemainingBudget,
} from '@/lib/denom-reward'

const { createDenomReward } = bze.rewards.MessageComposer.withTypeUrl

// A schedule this close to its end gets "ends in N payout days".
const ENDS_SOON_DAYS = 7

const formatDays = (days: number) => `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`
const formatPayoutDays = (days: number) => `${days.toLocaleString('en-US')} payout day${days === 1 ? '' : 's'}`

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align="start" gap={0.5} flex="1" minW="32">
            <Text fontSize="xs" color="fg.muted">{label}</Text>
            <Box fontSize="sm" fontWeight="semibold" wordBreak="break-all">{value}</Box>
        </VStack>
    )
}

/** One daily prize, worded the same in the table and the phone cards. */
function useScheduleView(schedule: DenomRewardSchedule) {
    const { asset: prizeAsset } = useAsset(schedule.prize_denom)
    const decimals = prizeAsset?.decimals ?? 0
    const ticker = prizeAsset?.ticker ?? schedule.prize_denom
    const left = scheduleDaysLeft(schedule)

    return {
        logo: prizeAsset?.logo,
        ticker,
        perDay: `${prettyAmount(uAmountToBigNumberAmount(schedule.daily_amount, decimals))} ${ticker}`,
        progress: `${schedule.payouts.toLocaleString('en-US')} of ${formatPayoutDays(schedule.duration)}`,
        endsSoon: left > 0 && left <= ENDS_SOON_DAYS ? `ends in ${formatPayoutDays(left)}` : '',
        leftToPay: `${prettyAmount(uAmountToBigNumberAmount(scheduleRemainingBudget(schedule), decimals))} ${ticker}`,
    }
}

function PrizeName({ logo, ticker }: { logo?: string; ticker: string }) {
    return (
        <HStack gap={2} minW={0}>
            <TokenLogo src={logo} symbol={ticker} size="6" circular={true} />
            <Text fontSize="sm" fontWeight="semibold" truncate>{ticker}</Text>
        </HStack>
    )
}

function ExtendButton({ onClick, size = 'xs' }: { onClick: () => void; size?: 'xs' | 'sm' }) {
    return (
        <Button size={size} variant="outline" colorPalette="yellow" onClick={onClick}>
            <LuCalendarPlus /> Extend
        </Button>
    )
}

function ScheduleTableRow({ schedule, onExtend }: { schedule: DenomRewardSchedule; onExtend: () => void }) {
    const view = useScheduleView(schedule)
    return (
        <Table.Row data-testid="holder-schedule-row">
            <Table.Cell><PrizeName logo={view.logo} ticker={view.ticker} /></Table.Cell>
            <Table.Cell textAlign="end">{view.perDay}</Table.Cell>
            <Table.Cell>
                <Text fontSize="sm">{view.progress}</Text>
                {view.endsSoon && <Text fontSize="xs" color="orange.600">{view.endsSoon}</Text>}
            </Table.Cell>
            <Table.Cell textAlign="end">{view.leftToPay}</Table.Cell>
            <Table.Cell textAlign="end"><ExtendButton onClick={onExtend} /></Table.Cell>
        </Table.Row>
    )
}

function ScheduleCard({ schedule, onExtend }: { schedule: DenomRewardSchedule; onExtend: () => void }) {
    const view = useScheduleView(schedule)
    return (
        <Box p={3} borderWidth="1px" borderColor="border.muted" borderRadius="lg" data-testid="holder-schedule-card">
            <VStack align="stretch" gap={3}>
                <HStack justify="space-between" gap={2}>
                    <PrizeName logo={view.logo} ticker={view.ticker} />
                    <Text fontSize="sm" fontWeight="semibold" flexShrink={0}>{`${view.perDay} / day`}</Text>
                </HStack>
                <HStack gap={4} flexWrap="wrap">
                    <Fact
                        label="Progress"
                        value={
                            <VStack align="start" gap={0}>
                                <Text>{view.progress}</Text>
                                {view.endsSoon && <Text fontSize="xs" color="orange.600">{view.endsSoon}</Text>}
                            </VStack>
                        }
                    />
                    <Fact label="Left to pay" value={view.leftToPay} />
                </HStack>
                <Box><ExtendButton onClick={onExtend} size="sm" /></Box>
            </VStack>
        </Box>
    )
}

function DailyPrizes({ ticker, schedules, onExtend }: { ticker: string; schedules: DenomRewardSchedule[]; onExtend: (id: string) => void }) {
    return (
        <VStack as="section" aria-label="Daily prizes" align="stretch" gap={2}>
            <Text fontSize="sm" fontWeight="semibold">Daily prizes</Text>
            {schedules.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                    {`No daily prize is running. Add one to start paying ${ticker} stakers.`}
                </Text>
            ) : (
                <>
                    <Table.ScrollArea borderWidth="1px" borderRadius="lg" hideBelow="md">
                        <Table.Root size="sm" aria-label="Daily prizes">
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeader>Prize</Table.ColumnHeader>
                                    <Table.ColumnHeader textAlign="end">Per day</Table.ColumnHeader>
                                    <Table.ColumnHeader>Progress</Table.ColumnHeader>
                                    <Table.ColumnHeader textAlign="end">Left to pay</Table.ColumnHeader>
                                    <Table.ColumnHeader />
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {schedules.map(schedule => (
                                    <ScheduleTableRow key={schedule.schedule_id} schedule={schedule} onExtend={() => onExtend(schedule.schedule_id)} />
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </Table.ScrollArea>
                    <VStack align="stretch" gap={2} hideFrom="md">
                        {schedules.map(schedule => (
                            <ScheduleCard key={schedule.schedule_id} schedule={schedule} onExtend={() => onExtend(schedule.schedule_id)} />
                        ))}
                    </VStack>
                </>
            )}
            <Text fontSize="xs" color="fg.muted">
                Payout days skip days with nobody staked, so a schedule can run longer than its length in calendar days.
            </Text>
        </VStack>
    )
}

function PrizeRow({ prize, currentDayEpoch }: { prize: DenomRewardPrize; currentDayEpoch?: string }) {
    const { asset: prizeAsset } = useAsset(prize.prize_denom)
    const ticker = prizeAsset?.ticker ?? prize.prize_denom

    // distributed_stake is an internal accumulator: never shown.
    return (
        <HStack justify="space-between" gap={3} data-testid="holder-prize">
            <HStack gap={2} minW={0}>
                <TokenLogo src={prizeAsset?.logo} symbol={ticker} size="5" circular={true} />
                <Text fontSize="sm" fontWeight="medium" truncate>{ticker}</Text>
            </HStack>
            <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                {`Last paid ${formatLastPaid(prize.last_distribution_epoch, currentDayEpoch)}`}
            </Text>
        </HStack>
    )
}

export interface HolderRewardsPanelProps {
    asset: Asset;
    /** Where the schedule and airdrop forms send the user back to after signing. */
    returnTo?: ReturnTo;
}

/**
 * Holder rewards (the chain's denom reward): one open-ended staking pool per token where anyone
 * funds daily prizes or airdrops and anyone who stakes the token shares them. Shown to every
 * wallet: creating or funding it grants no rights, so it is not an admin action.
 */
export function HolderRewardsPanel({ asset, returnTo }: HolderRewardsPanelProps) {
    const ticker = asset.ticker
    const { address } = useChain(getChainName())
    const { navigate } = useNavigation()
    const { tx } = useFactoryTx()
    const { denomReward, schedules, prizes, isLoading, hasError, refresh } = useDenomReward(asset.denom)
    const { dayEpochInfo } = useEpochs()
    const currentDayEpoch = dayEpochInfo?.current_epoch?.toString()
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()
    const fee = fees.createDenomRewardFee
    const feePayment = useFeePayment(fee, 'create-denom-reward')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [justCreated, setJustCreated] = useState(false)

    const go = (href: string) => navigate(withReturn(href, returnTo))
    const addDailyPrize = () => go(scheduleFormHref(asset.denom))

    const create = async () => {
        if (!address) return
        setIsSubmitting(true)
        try {
            await tx([createDenomReward({ creator: address, denom: asset.denom })], {
                onSuccess: () => {
                    setJustCreated(true)
                    void refresh()
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const minStakeLabel = (uAmount?: string) => {
        if (uAmount === undefined) return 'Unknown'
        const display = uAmountToBigNumberAmount(uAmount, asset.decimals)
        return display.gt(0) ? `${prettyAmount(display)} ${ticker}` : 'No minimum'
    }

    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr

    return (
        <Card.Root as="section" aria-label="Holder rewards" variant="outline" p={{ base: 4, md: 5 }} data-testid="holder-rewards-panel">
            <VStack align="stretch" gap={4}>
                <HStack gap={2} justify="space-between" flexWrap="wrap">
                    <HStack gap={2}>
                        <Box p={2} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                            <LuGift size={18} />
                        </Box>
                        <Text fontWeight="semibold" fontSize="lg">Holder rewards</Text>
                        <RewardInfoButton denom={asset.denom} />
                    </HStack>
                    {denomReward && (
                        <Badge colorPalette="green" variant="surface" size="sm">Live</Badge>
                    )}
                </HStack>
                <Text fontSize="sm" color="fg.muted">
                    {`One per token, open-ended. Anyone who stakes ${ticker} shares daily prizes. Anyone can add prize schedules or one-off airdrops.`}
                </Text>

                {isLoading ? (
                    <VStack align="stretch" gap={2} data-testid="holder-rewards-loading">
                        <Skeleton height="4" width="64" />
                        <Skeleton height="16" />
                        <Skeleton height="16" />
                    </VStack>
                ) : hasError ? (
                    <VStack align="stretch" gap={3}>
                        <InfoBox title="Couldn't load the holder rewards">
                            {`The chain query failed, so we can't tell whether ${ticker} has holder rewards. The node may be down, or not run chain v8.2.0 yet.`}
                        </InfoBox>
                        <Box>
                            <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => void refresh()}>
                                <LuRefreshCw /> Retry
                            </Button>
                        </Box>
                    </VStack>
                ) : !denomReward ? (
                    <VStack align="stretch" gap={4}>
                        <Text fontSize="sm">
                            {`Holders have no reason to stake ${ticker} yet. Turn on holder rewards and anyone who stakes it shares the daily prizes you, or anyone, fund. You don't need to own ${ticker}: it's open to everyone, and creating it gives no special rights.`}
                        </Text>

                        <VStack align="stretch" gap={2}>
                            <HStack gap={4} flexWrap="wrap">
                                <Fact
                                    label="Unstaking wait"
                                    value={denomRewardLimits.denomRewardLock === undefined ? 'Unknown' : formatDays(denomRewardLimits.denomRewardLock)}
                                />
                                <Fact label="Minimum stake" value={minStakeLabel(denomRewardLimits.denomRewardMinStake)} />
                            </HStack>
                            <Text fontSize="xs" color="fg.muted">Set by the chain and fixed when created.</Text>
                        </VStack>

                        <PayPanel
                            rows={fee ? [{ label: 'Holder rewards fee', coin: fee }] : []}
                            moduleFee={fee}
                            txKind="create-denom-reward"
                            isLoading={isFeeLoading}
                            feeUnknown={!isFeeLoading && !fee}
                        />

                        <VStack align="stretch" gap={2}>
                            <Button
                                colorPalette="yellow"
                                onClick={create}
                                disabled={!address || !fee || !feePayment.canPayFee}
                                loading={isSubmitting}
                                loadingText="Waiting for signature..."
                            >
                                <LuSprout /> {`Make ${ticker} stakable`}
                            </Button>
                            {!address && (
                                <Text fontSize="sm" color="fg.muted" textAlign="center">
                                    Connect your wallet to make it stakable.
                                </Text>
                            )}
                        </VStack>
                    </VStack>
                ) : (
                    <VStack align="stretch" gap={5}>
                        {justCreated && (
                            <VStack align="stretch" gap={2} data-testid="holder-rewards-next">
                                <TipNote lead="Next:">add a daily prize so stakers earn something.</TipNote>
                                <Box>
                                    <Button size="sm" colorPalette="yellow" onClick={addDailyPrize}>
                                        <LuPlus /> Add a daily prize
                                    </Button>
                                </Box>
                            </VStack>
                        )}

                        <HStack gap={4} flexWrap="wrap">
                            <Fact
                                label="Staked by holders"
                                value={`${prettyAmount(uAmountToBigNumberAmount(denomReward.staked_amount, asset.decimals))} ${ticker}`}
                            />
                            <Fact label="Unstaking wait" value={formatDays(denomReward.lock)} />
                            <Fact label="Minimum stake" value={minStakeLabel(denomReward.min_stake)} />
                            <Fact
                                label="Prize tokens used"
                                value={
                                    <Text as="span" data-testid="holder-prize-slots">
                                        {maxPrizes !== undefined ? `${prizes.length} of ${maxPrizes}` : `${prizes.length} used`}
                                    </Text>
                                }
                            />
                        </HStack>

                        <HStack gap={2} flexWrap="wrap" data-testid="holder-rewards-actions">
                            <Button colorPalette="yellow" variant="outline" onClick={() => go(airdropFormHref(asset.denom))}>
                                <LuSend /> Airdrop now
                            </Button>
                            <Button colorPalette="yellow" onClick={addDailyPrize}>
                                <LuPlus /> Add a daily prize
                            </Button>
                        </HStack>

                        <DailyPrizes
                            ticker={ticker}
                            schedules={schedules}
                            onExtend={(id) => go(scheduleFormHref(asset.denom, id))}
                        />

                        <VStack as="section" aria-label="Prize tokens" align="stretch" gap={2}>
                            <Text fontSize="sm" fontWeight="semibold">Prize tokens</Text>
                            {prizes.length === 0 ? (
                                <Text fontSize="sm" color="fg.muted">No prize token has been paid yet.</Text>
                            ) : (
                                prizes.map(prize => (
                                    <PrizeRow key={prize.prize_denom} prize={prize} currentDayEpoch={currentDayEpoch} />
                                ))
                            )}
                            <Text fontSize="xs" color="fg.muted">
                                Every prize token ever used keeps its slot, so funding with it again has no prize fee.
                            </Text>
                        </VStack>
                    </VStack>
                )}
            </VStack>
        </Card.Root>
    )
}
