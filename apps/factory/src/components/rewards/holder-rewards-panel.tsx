"use client"

import React, { useState } from 'react'
import { Box, Button, Grid, HStack, Table, Text, VStack } from '@chakra-ui/react'
import { LuCalendarPlus, LuPlus, LuRefreshCw, LuSend, LuSprout } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    Asset,
    DenomRewardPrize,
    DenomRewardSchedule,
    FeaturedCard,
    HgCard,
    Shimmer,
    StatusPill,
    TokenLogo,
    getChainName,
    hgVariant,
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
import { softButton } from '@/components/ui/soft-button'
import { RewardKindsLink } from '@/components/rewards/reward-kinds-link'
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
        <VStack align="stretch" gap="4px" minW={0} bg="hg.inset" borderRadius="12px" px="14px" py="12px">
            <Text fontSize="12px" color="fg.muted">{label}</Text>
            <Box fontSize="15px" fontWeight="700" wordBreak="break-word">{value}</Box>
        </VStack>
    )
}

/** The figures in a row of inset tiles: four across from md up, two on phones. */
function Facts({ children }: { children: React.ReactNode }) {
    return <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }} gap="12px">{children}</Grid>
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
        <HStack gap="8px" minW={0}>
            <TokenLogo src={logo} symbol={ticker} size="6" circular={true} />
            <Text fontSize="14px" fontWeight="700" truncate>{ticker}</Text>
        </HStack>
    )
}

function ExtendButton({ onClick, size = 'xs' }: { onClick: () => void; size?: 'xs' | 'sm' }) {
    return (
        <Button {...softButton} size={size} h={size === 'xs' ? '30px' : '36px'} fontSize="12px" borderRadius="8px" onClick={onClick}>
            <LuCalendarPlus /> Extend
        </Button>
    )
}

/** Header and body cells of the daily prizes table. */
const headerCell = { px: '16px', py: '10px', fontSize: '12px', fontWeight: '600', color: 'hg.text.faint', borderColor: 'hg.divider' }
const cell = { px: '16px', py: '12px', fontSize: '14px', borderColor: 'hg.divider' }

function ScheduleTableRow({ schedule, onExtend }: { schedule: DenomRewardSchedule; onExtend: () => void }) {
    const view = useScheduleView(schedule)
    return (
        <Table.Row data-testid="holder-schedule-row" bg="transparent">
            <Table.Cell {...cell}><PrizeName logo={view.logo} ticker={view.ticker} /></Table.Cell>
            <Table.Cell {...cell} textAlign="end">{view.perDay}</Table.Cell>
            <Table.Cell {...cell}>
                <Text fontSize="14px">{view.progress}</Text>
                {view.endsSoon && <Text fontSize="12px" color="hg.warning">{view.endsSoon}</Text>}
            </Table.Cell>
            <Table.Cell {...cell} textAlign="end">{view.leftToPay}</Table.Cell>
            <Table.Cell {...cell} textAlign="end"><ExtendButton onClick={onExtend} /></Table.Cell>
        </Table.Row>
    )
}

function ScheduleCard({ schedule, onExtend }: { schedule: DenomRewardSchedule; onExtend: () => void }) {
    const view = useScheduleView(schedule)
    return (
        <Box p="14px" borderWidth="1px" borderColor="hg.hairline" borderRadius="12px" data-testid="holder-schedule-card">
            <VStack align="stretch" gap="12px">
                <HStack justify="space-between" gap="8px">
                    <PrizeName logo={view.logo} ticker={view.ticker} />
                    <Text fontSize="14px" fontWeight="700" flexShrink={0}>{`${view.perDay} / day`}</Text>
                </HStack>
                <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="8px">
                    <Fact
                        label="Progress"
                        value={
                            <VStack align="start" gap={0}>
                                <Text>{view.progress}</Text>
                                {view.endsSoon && <Text fontSize="12px" fontWeight="500" color="hg.warning">{view.endsSoon}</Text>}
                            </VStack>
                        }
                    />
                    <Fact label="Left to pay" value={view.leftToPay} />
                </Grid>
                <Box><ExtendButton onClick={onExtend} size="sm" /></Box>
            </VStack>
        </Box>
    )
}

function DailyPrizes({ ticker, schedules, onExtend }: { ticker: string; schedules: DenomRewardSchedule[]; onExtend: (id: string) => void }) {
    return (
        <VStack as="section" aria-label="Daily prizes" align="stretch" gap="8px">
            <Text as="h3" fontSize="15px" fontWeight="700">Daily prizes</Text>
            {schedules.length === 0 ? (
                <Text fontSize="14px" color="fg.muted">
                    {`No daily prize is running. Add one to start paying ${ticker} stakers.`}
                </Text>
            ) : (
                <>
                    <Table.ScrollArea borderWidth="1px" borderColor="hg.hairline" borderRadius="12px" hideBelow="md">
                        <Table.Root size="sm" aria-label="Daily prizes" bg="transparent">
                            <Table.Header>
                                <Table.Row bg="hg.cardHeader">
                                    <Table.ColumnHeader {...headerCell}>Prize</Table.ColumnHeader>
                                    <Table.ColumnHeader {...headerCell} textAlign="end">Per day</Table.ColumnHeader>
                                    <Table.ColumnHeader {...headerCell}>Progress</Table.ColumnHeader>
                                    <Table.ColumnHeader {...headerCell} textAlign="end">Left to pay</Table.ColumnHeader>
                                    <Table.ColumnHeader {...headerCell} />
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {schedules.map(schedule => (
                                    <ScheduleTableRow key={schedule.schedule_id} schedule={schedule} onExtend={() => onExtend(schedule.schedule_id)} />
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </Table.ScrollArea>
                    <VStack align="stretch" gap="8px" hideFrom="md">
                        {schedules.map(schedule => (
                            <ScheduleCard key={schedule.schedule_id} schedule={schedule} onExtend={() => onExtend(schedule.schedule_id)} />
                        ))}
                    </VStack>
                </>
            )}
            <Text fontSize="12px" color="hg.text.faint">
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
        <HStack justify="space-between" gap="12px" px="14px" py="10px" borderRadius="12px" bg="hg.inset" data-testid="holder-prize">
            <HStack gap="8px" minW={0}>
                <TokenLogo src={prizeAsset?.logo} symbol={ticker} size="5" circular={true} />
                <Text fontSize="14px" fontWeight="500" truncate>{ticker}</Text>
            </HStack>
            <Text fontSize="12px" color="fg.muted" flexShrink={0}>
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
 * Compounded rewards (the chain's denom reward): one open-ended staking pool per token where anyone
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

    const live = Boolean(denomReward) && !isLoading && !hasError
    const content = (
        <VStack align="stretch" gap="20px">
            <VStack align="stretch" gap="6px">
                <HStack gap="8px" flexWrap="wrap">
                    <Text as="h2" fontWeight="700" fontSize="20px">Compounded reward</Text>
                    <RewardKindsLink denom={asset.denom} />
                    {denomReward && <StatusPill tone="success">Live</StatusPill>}
                </HStack>
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted">
                    {`One per token, open-ended. Anyone who stakes ${ticker} shares daily prizes. Anyone can add prize schedules or one-off airdrops.`}
                </Text>
            </VStack>

                {isLoading ? (
                    <VStack align="stretch" gap="8px" data-testid="holder-rewards-loading">
                        <Shimmer h="16px" w="256px" />
                        <Shimmer h="64px" borderRadius="12px" />
                        <Shimmer h="64px" borderRadius="12px" />
                    </VStack>
                ) : hasError ? (
                    <VStack align="stretch" gap="12px">
                        <InfoBox title="Couldn't load the compounded reward">
                            {`The chain query failed, so we can't tell whether ${ticker} has a compounded reward. The node may be down, or not run chain v8.2.0 yet.`}
                        </InfoBox>
                        <Box>
                            <Button {...softButton} size="sm" onClick={() => void refresh()}>
                                <LuRefreshCw /> Retry
                            </Button>
                        </Box>
                    </VStack>
                ) : !denomReward ? (
                    <VStack align="stretch" gap="14px">
                        <Text fontSize="14px" lineHeight="1.55">
                            {`Holders have no reason to stake ${ticker} yet. Turn on a compounded reward and anyone who stakes it shares the daily prizes you, or anyone, fund. You don't need to own ${ticker}: it's open to everyone, and creating it gives no special rights.`}
                        </Text>

                        <VStack align="stretch" gap="8px">
                            <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="12px">
                                <Fact
                                    label="Unstaking wait"
                                    value={denomRewardLimits.denomRewardLock === undefined ? 'Unknown' : formatDays(denomRewardLimits.denomRewardLock)}
                                />
                                <Fact label="Minimum stake" value={minStakeLabel(denomRewardLimits.denomRewardMinStake)} />
                            </Grid>
                            <Text fontSize="12px" color="hg.text.faint">Set by the chain and fixed when created.</Text>
                        </VStack>

                        <PayPanel
                            rows={fee ? [{ label: 'Compounded reward fee', coin: fee }] : []}
                            moduleFee={fee}
                            txKind="create-denom-reward"
                            isLoading={isFeeLoading}
                            feeUnknown={!isFeeLoading && !fee}
                        />

                        <VStack align="stretch" gap="8px">
                            <Button
                                variant={hgVariant('primary')}
                                size="lg"
                                onClick={create}
                                disabled={!address || !fee || !feePayment.canPayFee}
                                loading={isSubmitting}
                                loadingText="Waiting for signature..."
                            >
                                <LuSprout /> {`Make ${ticker} stakable`}
                            </Button>
                            {!address && (
                                <Text fontSize="14px" color="fg.muted" textAlign="center">
                                    Connect your wallet to make it stakable.
                                </Text>
                            )}
                        </VStack>
                    </VStack>
                ) : (
                    <VStack align="stretch" gap="20px">
                        {justCreated && (
                            <VStack align="stretch" gap="8px" data-testid="holder-rewards-next">
                                <TipNote lead="Next:">add a daily prize so stakers earn something.</TipNote>
                                <Box>
                                    <Button variant={hgVariant('primary')} size="md" onClick={addDailyPrize}>
                                        <LuPlus /> Add a daily prize
                                    </Button>
                                </Box>
                            </VStack>
                        )}

                        <Facts>
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
                        </Facts>

                        <HStack gap="10px" flexWrap="wrap" data-testid="holder-rewards-actions">
                            <Button {...softButton} size="lg" h="42px" borderRadius="12px" onClick={() => go(airdropFormHref(asset.denom))}>
                                <Box as="span" color="hg.link" display="inline-flex"><LuSend /></Box> Airdrop now
                            </Button>
                            <Button variant={hgVariant('primary')} size="lg" h="42px" onClick={addDailyPrize}>
                                <LuPlus /> Add a daily prize
                            </Button>
                        </HStack>

                        <DailyPrizes
                            ticker={ticker}
                            schedules={schedules}
                            onExtend={(id) => go(scheduleFormHref(asset.denom, id))}
                        />

                        <VStack as="section" aria-label="Prize tokens" align="stretch" gap="8px">
                            <Text as="h3" fontSize="15px" fontWeight="700">Prize tokens</Text>
                            {prizes.length === 0 ? (
                                <Text fontSize="14px" color="fg.muted">No prize token has been paid yet.</Text>
                            ) : (
                                prizes.map(prize => (
                                    <PrizeRow key={prize.prize_denom} prize={prize} currentDayEpoch={currentDayEpoch} />
                                ))
                            )}
                            <Text fontSize="12px" color="hg.text.faint">
                                Every prize token ever used keeps its slot, so funding with it again has no prize fee.
                            </Text>
                        </VStack>
                    </VStack>
                )}
        </VStack>
    )

    // A running holder-rewards pool is the page's featured card; before it exists it is a plain card.
    return (
        <Box as="section" aria-label="Compounded reward" data-testid="holder-rewards-panel">
            {live
                ? <FeaturedCard p={{ base: '18px', md: '24px' }}>{content}</FeaturedCard>
                : <HgCard p={{ base: '18px', md: '22px' }}>{content}</HgCard>}
        </Box>
    )
}
