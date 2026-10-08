"use client"

import React, { Suspense, useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Container,
    Field,
    HStack,
    Input,
    Separator,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuArrowLeft, LuCalendarPlus, LuLock, LuSearchX, LuTriangleAlert } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    TokenLogo,
    amountToUAmount,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCanAffordTx,
    useCreationFees,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { AssetPicker } from '@/components/ui/asset-picker'
import { FeeDisclosure } from '@/components/ui/fee-disclosure'
import { InfoBox } from '@/components/ui/info-box'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    MAX_SCHEDULE_DAYS,
    MIN_SCHEDULE_DAYS,
    prizeSlot,
    scheduleDaysLeft,
    summarizeScheduleCosts,
    validateScheduleDays,
} from '@/lib/denom-reward'

const { createDenomRewardSchedule, updateDenomRewardSchedule } = bze.rewards.MessageComposer.withTypeUrl

const manageHref = (denom: string) => `/manage/token?denom=${encodeURIComponent(denom)}`

function TextField({
    label,
    helper,
    error,
    value,
    onChange,
    placeholder,
    inputMode = 'decimal',
}: {
    label: string;
    helper?: string;
    error: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    inputMode?: 'decimal' | 'numeric';
}) {
    const [touched, setTouched] = useState(false)

    return (
        <Field.Root invalid={touched && error !== ''}>
            <Field.Label>{label}</Field.Label>
            <Input
                placeholder={placeholder}
                inputMode={inputMode}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setTouched(true)}
            />
            {helper && <Field.HelperText>{helper}</Field.HelperText>}
            <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
    )
}

function Notice({ title, children, onBack }: { title: string; children: React.ReactNode; onBack: () => void }) {
    return (
        <Card.Root variant="outline" p="10">
            <VStack gap={4}>
                <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                    <LuSearchX size={28} />
                </Box>
                <VStack gap={1}>
                    <Text fontWeight="semibold">{title}</Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">{children}</Text>
                </VStack>
                <Button colorPalette="yellow" variant="outline" onClick={onBack}>
                    <LuArrowLeft /> Back to the token
                </Button>
            </VStack>
        </Card.Root>
    )
}

function ScheduleFormContent() {
    const { denomParam, getQueryParam, navigate } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const scheduleId = getQueryParam('schedule') ?? undefined
    const isExtend = scheduleId !== undefined

    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { asset: stakingAsset } = useAsset(denom)
    const { denomReward, schedules, prizes, isLoading, hasError } = useDenomReward(denom)
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()

    const schedule = isExtend ? schedules.find(s => s.schedule_id === scheduleId) : undefined

    const [pickedPrize, setPickedPrize] = useState('')
    const [dailyInput, setDailyInput] = useState('')
    const [daysInput, setDaysInput] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Extend mode: prize and daily amount are the schedule's own; only extra days are entered.
    const prizeDenom = schedule ? schedule.prize_denom : pickedPrize
    const { asset: prizeAsset } = useAsset(prizeDenom)
    const { balance: prizeBalance } = useBalance(prizeDenom)

    const dailyError = schedule || !prizeAsset ? '' : validateAmount(dailyInput, prizeAsset.decimals)
    const daysError = validateScheduleDays(daysInput, schedule?.duration)

    const dailyUAmount = useMemo(() => {
        if (schedule) return schedule.daily_amount
        if (!prizeAsset || dailyError !== '') return undefined
        return amountToUAmount(dailyInput, prizeAsset.decimals)
    }, [schedule, prizeAsset, dailyError, dailyInput])

    const slot = prizeSlot(prizes, prizeDenom, denomRewardLimits.maxPrizeDenomsPerDr)
    const mode = isExtend ? 'extend' : 'create'
    const costs = summarizeScheduleCosts({
        dailyUAmount,
        days: daysError === '' ? Number(daysInput.trim()) : undefined,
        prizeDenom,
        mode,
        scheduleFee: fees.addDenomRewardScheduleFee,
        prizeFee: fees.createDenomRewardPrizeFee,
        isNewPrize: Boolean(prizeDenom) && slot.isNewPrize,
    })

    // The fees normally share one denom (BZE) and are disclosed + resolved against the fee token
    // as one total. A second fee denom (only if governance sets one) is charged natively.
    const txKind = isExtend ? 'update-denom-reward-schedule' : 'create-denom-reward-schedule'
    const mainFee = costs.feeTotals[0]
    const extraFees = costs.feeTotals.slice(1)
    const feePayment = useFeePayment(mainFee, txKind)
    const afford = useCanAffordTx({
        spec: costs.escrow ? txKind : undefined,
        spend: costs.escrow ? [costs.escrow, ...extraFees] : undefined,
        moduleFee: feePayment.estimate.resolvedFee,
    })

    const escrowDisplay = costs.escrow && prizeAsset
        ? uAmountToBigNumberAmount(costs.escrow.amount, prizeAsset.decimals)
        : undefined
    const feeLabel = costs.fees.length > 0 ? costs.fees.map(f => f.label).join(' + ') : 'Schedule fee'

    const isComplete = Boolean(prizeDenom) && dailyError === '' && daysError === '' && costs.escrow !== undefined
    const feesReady = isExtend || (costs.feesKnown && (!mainFee || feePayment.canPayFee))
    const canConfirm = isComplete && Boolean(address) && !slot.capReached && feesReady &&
        !afford.isLoading && afford.canAfford

    const back = () => navigate(manageHref(denom))

    const submit = async () => {
        if (!address || !canConfirm || dailyUAmount === undefined) return
        const days = daysInput.trim()
        const msg = schedule
            ? updateDenomRewardSchedule({ creator: address, denom, scheduleId: schedule.schedule_id, duration: days })
            : createDenomRewardSchedule({
                creator: address,
                denom,
                prizeDenom,
                dailyAmount: new BigNumber(dailyUAmount).toFixed(0),
                duration: days,
            })

        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: () => navigate(manageHref(denom)) })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!denom) {
        return <Notice title="No token selected" onBack={() => navigate('/manage')}>Open this form from a token&apos;s manage page.</Notice>
    }

    if (isLoading) {
        return (
            <VStack align="stretch" gap={4}>
                <Skeleton height="10" width="64" />
                <Skeleton height="64" />
            </VStack>
        )
    }

    if (hasError) {
        return (
            <Notice title="Couldn't load the denom reward" onBack={back}>
                The chain query failed — the node may be down, or not run chain v8.2.0 yet. Try again later.
            </Notice>
        )
    }

    if (!denomReward) {
        return (
            <Notice title="No denom reward yet" onBack={back}>
                {stakingAsset?.ticker ?? 'This token'} has no denom reward. Create it from the token&apos;s
                manage page first, then add a schedule.
            </Notice>
        )
    }

    if (isExtend && !schedule) {
        return (
            <Notice title="Schedule not found" onBack={back}>
                This schedule no longer runs — it may have paid its last day. Add a new schedule instead.
            </Notice>
        )
    }

    const stakingTicker = stakingAsset?.ticker ?? denom
    const prizeTicker = prizeAsset?.ticker ?? prizeDenom

    return (
        <VStack align="stretch" gap={6}>
            <Box>
                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={back}>
                    <LuArrowLeft /> {stakingTicker}
                </Button>
            </Box>

            <HStack gap={3}>
                <Box p={2.5} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                    <LuCalendarPlus size={22} />
                </Box>
                <VStack align="start" gap={0}>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        {isExtend ? 'Extend prize schedule' : 'Add prize schedule'}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        {isExtend
                            ? `Fund more days of this ${stakingTicker} denom reward schedule.`
                            : `Pay a daily prize to everyone staking ${stakingTicker}.`}
                    </Text>
                </VStack>
            </HStack>

            <Card.Root variant="outline" p={{ base: 5, md: 6 }}>
                <VStack align="stretch" gap={5}>
                    {schedule ? (
                        <HStack gap={3} p={3} borderWidth="1px" borderColor="border.muted" borderRadius="lg">
                            <TokenLogo src={prizeAsset?.logo} symbol={prizeTicker} size="6" circular={true} />
                            <VStack align="start" gap={0}>
                                <Text fontSize="sm" fontWeight="semibold">
                                    {prettyAmount(uAmountToBigNumberAmount(schedule.daily_amount, prizeAsset?.decimals ?? 0))} {prizeTicker} / day
                                </Text>
                                <Text fontSize="xs" color="fg.muted">
                                    Runs {schedule.duration.toLocaleString('en-US')} days, {schedule.payouts.toLocaleString('en-US')} paid,{' '}
                                    {scheduleDaysLeft(schedule).toLocaleString('en-US')} left
                                </Text>
                            </VStack>
                        </HStack>
                    ) : (
                        <AssetPicker
                            label="Prize token (paid from your wallet)"
                            value={pickedPrize}
                            onSelect={(asset) => setPickedPrize(asset.denom)}
                        />
                    )}

                    {!schedule && prizeDenom && slot.capReached && (
                        <HStack gap={2} p={3} borderRadius="lg" bg="red.500/10" color="red.600" align="start">
                            <Box mt="0.5"><LuTriangleAlert size={16} /></Box>
                            <Text fontSize="sm">
                                This denom reward already uses {slot.used} prize tokens, the maximum of{' '}
                                {denomRewardLimits.maxPrizeDenomsPerDr}. Pick a prize token it already pays.
                            </Text>
                        </HStack>
                    )}

                    {prizeAsset && (
                        <>
                            {!schedule && (
                                <TextField
                                    label={`Prize per day (${prizeTicker})`}
                                    helper={`Balance: ${prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals))} ${prizeTicker}`}
                                    error={dailyError}
                                    value={dailyInput}
                                    onChange={setDailyInput}
                                    placeholder="e.g. 1000"
                                />
                            )}
                            <TextField
                                label={schedule ? 'Extra days' : 'Duration (days)'}
                                helper={schedule
                                    ? `Added to the schedule's ${schedule.duration.toLocaleString('en-US')} days (at most ${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} in total).`
                                    : `${MIN_SCHEDULE_DAYS}–${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} payout days.`}
                                error={daysError}
                                value={daysInput}
                                onChange={setDaysInput}
                                placeholder="e.g. 30"
                                inputMode="numeric"
                            />

                            <Box p={5} borderWidth="2px" borderColor="orange.500/40" borderRadius="xl" bg="orange.500/10">
                                <HStack gap={3} align="start">
                                    <Box color="orange.500" mt={1}><LuLock size={24} /></Box>
                                    <VStack align="start" gap={1}>
                                        <Text fontSize="sm" fontWeight="medium" color="fg.muted">Escrowed now</Text>
                                        <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight" data-testid="escrow-amount">
                                            {escrowDisplay ? `${prettyAmount(escrowDisplay)} ${prizeTicker}` : `— ${prizeTicker}`}
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted">
                                            Daily prize × {schedule ? 'extra days' : 'days'}, taken from your wallet in
                                            full when you sign. It is paid out to {stakingTicker} stakers day by day and
                                            can&apos;t be cancelled or withdrawn. A day nobody is staking is skipped
                                            without spending budget.
                                        </Text>
                                        {address && escrowDisplay && !afford.isLoading && !afford.canAfford && afford.message && (
                                            <Text fontSize="sm" color="red.500" fontWeight="medium">{afford.message}</Text>
                                        )}
                                    </VStack>
                                </HStack>
                            </Box>
                        </>
                    )}

                    <Separator />

                    {isExtend ? (
                        <InfoBox title="No fee to extend">
                            Extending only escrows the extra days of prize, plus the network fee. Anyone can
                            extend any schedule.
                        </InfoBox>
                    ) : (
                        <VStack align="stretch" gap={2}>
                            {costs.fees.length > 1 && (
                                <VStack align="stretch" gap={0.5}>
                                    {costs.fees.map(f => (
                                        <FeeLine key={f.label} label={f.label} denom={f.coin.denom} amount={f.coin.amount} />
                                    ))}
                                </VStack>
                            )}
                            {prizeDenom && slot.isNewPrize && !slot.capReached && (
                                <Text fontSize="xs" color="fg.muted">
                                    {prizeTicker} is new to this denom reward, so the one-time prize token fee applies
                                    {denomRewardLimits.maxPrizeDenomsPerDr !== undefined
                                        ? ` (it takes prize slot ${slot.used + 1} of ${denomRewardLimits.maxPrizeDenomsPerDr})`
                                        : ''}.
                                </Text>
                            )}
                            <FeeDisclosure
                                fee={costs.feesKnown ? mainFee : undefined}
                                isLoading={isFeeLoading}
                                label={feeLabel}
                                txKind={txKind}
                            />
                            {extraFees.map(f => (
                                <FeeLine key={f.denom} label="Also charged" denom={f.denom} amount={f.amount} />
                            ))}
                        </VStack>
                    )}

                    <VStack align="stretch" gap={2}>
                        <Button
                            size="lg"
                            colorPalette="yellow"
                            onClick={submit}
                            disabled={!canConfirm}
                            loading={isSubmitting}
                            loadingText="Waiting for signature..."
                        >
                            {isExtend ? 'Extend schedule' : 'Add schedule'}
                        </Button>
                        {!address && (
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Connect your wallet to fund this schedule.
                            </Text>
                        )}
                    </VStack>
                </VStack>
            </Card.Root>
        </VStack>
    )
}

function FeeLine({ label, denom, amount }: { label: string; denom: string; amount: string }) {
    const { asset } = useAsset(denom)
    return (
        <HStack justify="space-between">
            <Text fontSize="sm" color="fg.muted">{label}</Text>
            <Text fontSize="sm" fontWeight="medium">
                {prettyAmount(uAmountToBigNumberAmount(amount, asset?.decimals ?? 0))} {asset?.ticker ?? denom}
            </Text>
        </HStack>
    )
}

export default function DenomRewardSchedulePage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="2xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <ScheduleFormContent />
                </Suspense>
            </Container>
        </Box>
    )
}
