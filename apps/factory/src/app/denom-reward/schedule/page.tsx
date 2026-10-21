"use client"

import React, { useMemo, useState } from 'react'
import { Box, HStack, Text, VStack, chakra } from '@chakra-ui/react'
import {
    GradientText,
    Shimmer,
    TokenLogo,
    amountToUAmount,
    getExplorerTxURL,
    getChainName,
    getCommunitiesApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { schedulePayRows, useScheduleGift } from '@/hooks/useScheduleGift'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { Notice, TextField } from '@/components/manage/denom-reward-form-parts'
import { PrizeTokenQuestion } from '@/components/rewards/prize-token-question'
import { RewardInfoButton } from '@/components/rewards/reward-info-button'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    BlockerNote,
    ContinueRow,
    FormFrame,
    FormPage,
    GuidedForm,
    OutcomePanel,
    PayPanel,
    Question,
    SubmitBlock,
    SubmitNote,
    SuccessPanel,
    useGuidedSteps,
    useReturnTo,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import {
    MAX_SCHEDULE_DAYS,
    MIN_SCHEDULE_DAYS,
    scheduleDaysLeft,
    denomRewardHref,
    validateScheduleDays,
} from '@/lib/denom-reward'

const ADD_STEPS = ['prize', 'daily', 'days'] as const
const EXTEND_STEPS = ['more'] as const
type Step = typeof ADD_STEPS[number] | typeof EXTEND_STEPS[number]

const fmtDays = (n: number) => n.toLocaleString('en-US')

function ScheduleFormContent() {
    const { denomParam, getQueryParam, navigate } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const denom = denomParam ?? ''
    const scheduleId = getQueryParam('schedule') ?? undefined
    const isExtend = scheduleId !== undefined

    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { asset: stakingAsset } = useAsset(denom)
    const { denomReward, schedules, prizes, isLoading, hasError } = useDenomReward(denom)

    const schedule = isExtend ? schedules.find(s => s.schedule_id === scheduleId) : undefined

    const [pickedPrize, setPickedPrize] = useState('')
    const [dailyInput, setDailyInput] = useState('')
    const [daysInput, setDaysInput] = useState('')
    const [answered, setAnswered] = useState<Step[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [doneTx, setDoneTx] = useState<{ txHash: string; escrowLabel: string; days: string } | undefined>(undefined)

    // Extend mode: prize and daily amount are the schedule's own; only extra days are entered.
    const prizeDenom = schedule ? schedule.prize_denom : pickedPrize
    const { asset: prizeAsset } = useAsset(prizeDenom)
    const { balance: prizeBalance } = useBalance(prizeDenom)

    const dailyError = schedule || !prizeAsset ? '' : validateAmount(dailyInput, prizeAsset.decimals)
    const daysError = validateScheduleDays(daysInput, schedule?.duration)
    const extendRoom = schedule ? Math.max(0, MAX_SCHEDULE_DAYS - schedule.duration) : undefined

    const dailyUAmount = useMemo(() => {
        if (schedule) return schedule.daily_amount
        if (!prizeAsset || dailyError !== '') return undefined
        return amountToUAmount(dailyInput, prizeAsset.decimals)
    }, [schedule, prizeAsset, dailyError, dailyInput])

    const gift = useScheduleGift({
        denom,
        prizes,
        prizeDenom,
        dailyUAmount,
        days: daysError === '' ? Number(daysInput.trim()) : undefined,
        scheduleId: schedule?.schedule_id,
    })
    const { slot, costs, afford } = gift

    const steps = useGuidedSteps<Step>(isExtend ? EXTEND_STEPS : ADD_STEPS, {
        prize: answered.includes('prize') && Boolean(prizeAsset) && !slot.capReached,
        daily: answered.includes('daily') && dailyError === '' && dailyUAmount !== undefined,
        days: answered.includes('days') && daysError === '',
        more: answered.includes('more') && daysError === '',
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const allAnswered = (isExtend ? EXTEND_STEPS : ADD_STEPS).every(k => steps.state[k] === 'done')
    const isComplete = allAnswered && Boolean(prizeDenom) && dailyError === '' && daysError === '' && costs.escrow !== undefined
    const canConfirm = isComplete && Boolean(address) && gift.canSign

    const back = () => navigate(denomRewardHref(denom))

    // Until the asset list loads, plain words stand in for the tickers: a raw factory denom is
    // one long unbreakable word that would push the page wider than a phone.
    const stakingTicker = stakingAsset?.ticker ?? 'the token'
    const stakingPossessive = stakingAsset ? `${stakingAsset.ticker}'s` : "the token's"
    const prizeTicker = prizeAsset?.ticker ?? ''
    const escrowDisplay = costs.escrow && prizeAsset
        ? uAmountToBigNumberAmount(costs.escrow.amount, prizeAsset.decimals)
        : undefined
    const escrowText = escrowDisplay ? `${prettyAmount(escrowDisplay)} ${prizeTicker}` : ''
    const dailyText = dailyUAmount !== undefined && prizeAsset
        ? `${prettyAmount(uAmountToBigNumberAmount(dailyUAmount, prizeAsset.decimals))} ${prizeTicker}`
        : ''

    const submit = async () => {
        const msg = address && canConfirm ? gift.message(address) : undefined
        if (!address || !msg) return
        const days = daysInput.trim()

        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: (res) => setDoneTx({ txHash: res.txhash, escrowLabel: escrowText, days }) })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!denom) {
        return <Notice title="No token selected" onBack={() => navigate('/rewards')}>Open this form from a token&apos;s holder rewards.</Notice>
    }

    if (isLoading) {
        return (
            <FormFrame>
                <VStack align="stretch" gap="16px">
                    <Shimmer h="40px" w="256px" />
                    <Shimmer h="256px" borderRadius="hg.lg" />
                </VStack>
            </FormFrame>
        )
    }

    if (hasError) {
        return (
            <Notice title="Couldn't load the holder rewards" onBack={back}>
                The chain query failed — the node may be down, or not run chain v8.2.0 yet. Try again later.
            </Notice>
        )
    }

    if (!denomReward) {
        return (
            <Notice title="No holder rewards yet" onBack={back}>
                {`${stakingAsset?.ticker ?? 'This token'} has no holder rewards. Make it stakable first, then start a daily prize.`}
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

    const holderRewardsLabel = `${stakingPossessive} holder rewards`

    if (doneTx) {
        return (
            <SuccessPanel
                title={isExtend ? 'Daily prize extended' : 'Daily prize started'}
                text={isExtend
                    ? `${doneTx.escrowLabel} was locked for ${doneTx.days} more days of prizes for everyone staking ${stakingTicker}.`
                    : `${doneTx.escrowLabel} was locked. Everyone staking ${stakingTicker} now shares ${dailyText} a day.`}
                links={[
                    { label: 'Explorer', href: getExplorerTxURL(doneTx.txHash), app: 'explorer' },
                    {
                        label: 'Communities',
                        href: `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(denom)}`,
                        app: 'communities',
                    },
                ]}
                primary={returnTo
                    ? { label: `Back to ${returnTo.label}`, href: returnTo.href }
                    : { label: `Back to ${holderRewardsLabel}`, href: denomRewardHref(denom) }}
            />
        )
    }

    const escrowLine = (
        <Box fontSize="14px">
            <Text color="fg.muted">
                Locked now:{' '}
                <Text as="span" fontWeight="600" color="fg" data-testid="escrow-amount">
                    {escrowText || `— ${prizeTicker}`.trim()}
                </Text>{' '}
                (daily prize × {isExtend ? 'extra days' : 'days'}), taken from your wallet in full when you sign.
                It can&apos;t be cancelled or withdrawn.
            </Text>
        </Box>
    )

    const daysHelper = isExtend && schedule
        ? `Added to the schedule's ${fmtDays(schedule.duration)} days (at most ${fmtDays(MAX_SCHEDULE_DAYS)} in total). Days with nobody staking are skipped.`
        : `${MIN_SCHEDULE_DAYS}–${fmtDays(MAX_SCHEDULE_DAYS)} payout days. Days with nobody staking are skipped, so it can run longer than this in calendar days.`

    const aside = (
        <>
            <OutcomePanel>
                {escrowText && dailyText ? (
                    <Text>
                        <Text as="span" fontWeight="600">{escrowText}</Text> leaves your wallet now and is paid
                        as {dailyText} a day{isExtend ? ` for ${daysInput.trim()} more days` : ''} to everyone
                        staking {stakingTicker}, split by stake. It can&apos;t be cancelled or withdrawn.
                    </Text>
                ) : (
                    <Text color="fg.muted">
                        {isExtend
                            ? 'Enter how many more days to see what leaves your wallet.'
                            : 'Pick the prize, the daily amount and the days to see what leaves your wallet.'}
                    </Text>
                )}
            </OutcomePanel>

            <PayPanel
                rows={schedulePayRows(gift)}
                moduleFee={isExtend ? undefined : gift.mainFee}
                txKind={gift.txKind}
                isLoading={!isExtend && gift.isFeeLoading}
                feeUnknown={gift.feeUnknown}
            />

            <SubmitBlock label={<>{isExtend ? 'Extend' : 'Start the daily prize'}</>} onClick={submit} disabled={!canConfirm} loading={isSubmitting}>
                {!address ? (
                    <SubmitNote>Connect your wallet to fund this schedule.</SubmitNote>
                ) : costs.escrow && !afford.isLoading && !afford.canAfford && afford.message && (
                    <Text fontSize="14px" lineHeight="1.5" color="hg.danger.text" textAlign="center" role="alert">{afford.message}</Text>
                )}
            </SubmitBlock>
        </>
    )

    return (
        <GuidedForm
            title={
                <>
                    {isExtend ? <>Extend a <GradientText>daily prize</GradientText></> : <>Give a little <GradientText>every day</GradientText></>}
                    <chakra.span display="inline-flex" verticalAlign="middle" ms="4px"><RewardInfoButton /></chakra.span>
                </>
            }
            subtitle={isExtend
                ? `Fund more days of this ${stakingAsset ? `${stakingAsset.ticker} ` : ''}daily prize.`
                : `Pay a daily prize to everyone staking ${stakingTicker}.`}
            techTag={VOCABULARY.dailyPrize.tech}
            parent={returnTo ?? { href: denomRewardHref(denom), label: holderRewardsLabel }}
            crumb="Daily prize"
            aside={aside}
        >
            {schedule ? (
                <>
                    <HStack gap="12px" px="14px" py="14px" borderWidth="1px" borderColor="hg.hairline" borderRadius="hg.lg" bg="hg.card">
                        <TokenLogo src={prizeAsset?.logo} symbol={prizeTicker} size="9" circular={true} />
                        <VStack align="start" gap="2px">
                            <Text fontSize="14px" fontWeight="600">{dailyText} / day</Text>
                            <Text fontSize="12px" color="hg.text.faint">
                                Runs {fmtDays(schedule.duration)} days, {fmtDays(schedule.payouts)} paid,{' '}
                                {fmtDays(scheduleDaysLeft(schedule))} left
                            </Text>
                        </VStack>
                    </HStack>

                    <Question
                        title="How many more days?"
                        {...steps.step('more')}
                        summary={`${daysInput.trim()} more days`}
                    >
                        <VStack align="stretch" gap="16px">
                            {extendRoom === 0 && (
                                <BlockerNote>
                                    This schedule already runs the maximum of {fmtDays(MAX_SCHEDULE_DAYS)} days.
                                </BlockerNote>
                            )}
                            <TextField
                                label="Extra days"
                                helper={daysHelper}
                                error={extendRoom === 0 ? '' : daysError}
                                value={daysInput}
                                onChange={setDaysInput}
                                placeholder="e.g. 30"
                                inputMode="numeric"
                                disabled={extendRoom === 0}
                            />
                            {escrowLine}
                            <ContinueRow disabled={daysError !== ''} onContinue={() => answer('more')} />
                        </VStack>
                    </Question>
                </>
            ) : (
                <>
                    <Question
                        title="What do you give?"
                        {...steps.step('prize')}
                        summary={prizeTicker}
                    >
                        <VStack align="stretch" gap="16px">
                            <PrizeTokenQuestion
                                denomReward={denomReward}
                                prizes={prizes}
                                maxPrizeDenoms={gift.maxPrizes}
                                prizeFee={gift.prizeFee}
                                value={pickedPrize}
                                onSelect={(asset) => setPickedPrize(asset.denom)}
                            />
                            <ContinueRow disabled={!prizeAsset || slot.capReached} onContinue={() => answer('prize')} />
                        </VStack>
                    </Question>

                    <Question
                        title="How much a day?"
                        {...steps.step('daily')}
                        summary={dailyText ? `${dailyText} a day` : ''}
                    >
                        <VStack align="stretch" gap="16px">
                            {prizeAsset && (
                                <TextField
                                    label={`Prize per day (${prizeTicker})`}
                                    helper={`of ${prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals))} ${prizeTicker}`}
                                    error={dailyError}
                                    value={dailyInput}
                                    onChange={setDailyInput}
                                    placeholder="e.g. 1000"
                                />
                            )}
                            <ContinueRow disabled={dailyError !== '' || dailyUAmount === undefined} onContinue={() => answer('daily')} />
                        </VStack>
                    </Question>

                    <Question
                        title="For how many days?"
                        {...steps.step('days')}
                        summary={`${daysInput.trim()} payout days`}
                    >
                        <VStack align="stretch" gap="16px">
                            <TextField
                                label="Payout days"
                                helper={daysHelper}
                                error={daysError}
                                value={daysInput}
                                onChange={setDaysInput}
                                placeholder="e.g. 30"
                                inputMode="numeric"
                            />
                            {escrowLine}
                            <ContinueRow disabled={daysError !== ''} onContinue={() => answer('days')} />
                        </VStack>
                    </Question>
                </>
            )}
        </GuidedForm>
    )
}

export default function DenomRewardSchedulePage() {
    return (
        <FormPage>
            <ScheduleFormContent />
        </FormPage>
    )
}
