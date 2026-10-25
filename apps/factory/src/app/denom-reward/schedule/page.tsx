"use client"

import React, { useState } from 'react'
import { Box, chakra, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import {
    GradientText,
    Shimmer,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCreationFees,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { schedulePayRows, useScheduleGift } from '@/hooks/useScheduleGift'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import { Notice, TextField } from '@/components/manage/denom-reward-form-parts'
import { PrizeDone } from '@/components/reward-wizard/prize-done'
import { PrizeSlotNote } from '@/components/reward-wizard/prize-slot-note'
import { StakedTokenStep } from '@/components/reward-wizard/staked-token-step'
import { RewardKindsLink } from '@/components/rewards/reward-kinds-link'
import { AssetPicker } from '@/components/ui/asset-picker'
import {
    FormFrame,
    FormPage,
    GuidedForm,
    OutcomePanel,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    useGuidedSteps,
    useReturnTo,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import { checkDailyPrize, dailyPrizeSummary } from '@/lib/daily-prize'
import { MAX_SCHEDULE_DAYS, MIN_SCHEDULE_DAYS, prizeSlot } from '@/lib/denom-reward'
import { type PrizeDoneInput, scheduleExtendFacts, stakedTokenOk } from '@/lib/prize-wizard'

const ADD_STEPS = ['token', 'prize', 'review'] as const
const EXTEND_STEPS = ['schedule', 'days', 'review'] as const
type Step = typeof ADD_STEPS[number] | typeof EXTEND_STEPS[number]
type FormStep = Exclude<Step, 'review'>

const fmtDays = (n: number) => `${n.toLocaleString('en-US')} day${n === 1 ? '' : 's'}`
const moreDays = (n: number) => `${n.toLocaleString('en-US')} more day${n === 1 ? '' : 's'}`

function TermRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <HStack justify="space-between" align="start" gap="12px">
            <Text fontSize="14px" color="fg.muted">{label}</Text>
            <Text fontSize="14px" fontWeight="600" textAlign="right">{value}</Text>
        </HStack>
    )
}

function ScheduleFormContent() {
    const { denomParam, getQueryParam, navigate } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const scheduleId = getQueryParam('schedule') ?? undefined
    const isExtend = scheduleId !== undefined

    const { address } = useChain(getChainName())
    const connected = Boolean(address)

    // Add: step 1 picks whose stakers get it, answered by ?denom=. Extend: the link names both.
    const [denom, setDenom] = useState(() => denomParam ?? '')
    const [pickedPrize, setPickedPrize] = useState('')
    const [dailyInput, setDailyInput] = useState('')
    const [daysInput, setDaysInput] = useState('')
    const [answered, setAnswered] = useState<FormStep[]>(() => (isExtend ? ['schedule'] : denomParam ? ['token'] : []))
    const [done, setDone] = useState<{ input: PrizeDoneInput; hash: string } | undefined>(undefined)
    // Today, for the days-left and end dates.
    const [now] = useState(() => new Date())

    const { asset: stakingAsset } = useAsset(denom)
    const dr = useDenomReward(denom)
    const { denomReward, schedules, prizes } = dr
    const schedule = isExtend ? schedules.find(s => s.schedule_id === scheduleId) : undefined

    const prizeDenom = schedule ? schedule.prize_denom : pickedPrize
    const { asset: prizeAsset } = useAsset(prizeDenom)
    const { balance: prizeBalance } = useBalance(prizeDenom)

    const tokenOk = stakedTokenOk('dailyPrize', dr)
    const ticker = stakingAsset?.ticker ?? ''
    // Until the asset list loads, plain words stand in for the tickers: a raw factory denom is one
    // long unbreakable word that would push the page wider than a phone.
    const stakedName = ticker || 'the token'
    const prizeTicker = prizeAsset?.ticker ?? ''
    const display = (amount: { toString(): string }) => prizeAsset
        ? prettyAmount(uAmountToBigNumberAmount(amount.toString(), prizeAsset.decimals))
        : amount.toString()

    // Add: the shared daily prize checks (BFE-265).
    const { fees, denomRewardLimits } = useCreationFees()
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const prizeFee = fees.createDenomRewardPrizeFee
    const slot = prizeSlot(prizes, pickedPrize, maxPrizes)
    const check = checkDailyPrize({
        prizeDenom: pickedPrize,
        prizeDecimals: prizeAsset?.decimals,
        dailyInput,
        daysInput,
        slot,
        feesKnown: Boolean(prizeFee),
        prizeBalance: connected ? prizeBalance.amount : undefined,
    })

    // Extend: the extra days under the 36,500 cap.
    const ext = schedule ? scheduleExtendFacts(schedule, daysInput, now) : undefined
    const extendShort = Boolean(ext?.escrow) && connected && prizeBalance.amount.lt(ext?.escrow ?? 0)

    const gift = useScheduleGift(isExtend
        ? { denom, prizes, prizeDenom, dailyUAmount: schedule?.daily_amount, days: ext?.extra, scheduleId: schedule?.schedule_id }
        : { denom, prizes, prizeDenom: pickedPrize, dailyUAmount: check.dailyUAmount, days: check.days })

    const stepKeys: readonly Step[] = isExtend ? EXTEND_STEPS : ADD_STEPS
    const steps = useGuidedSteps<Step>(stepKeys, {
        token: answered.includes('token') && tokenOk,
        prize: answered.includes('prize') && check.valid,
        schedule: answered.includes('schedule') && Boolean(schedule),
        days: answered.includes('days') && ext?.extra !== undefined && !extendShort,
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const perDay = schedule ? display(schedule.daily_amount) : check.dailyUAmount !== undefined ? display(check.dailyUAmount) : ''
    const totalText = gift.costs.escrow ? `${display(gift.costs.escrow.amount)} ${prizeTicker}` : ''
    const prize = !isExtend && perDay && check.days !== undefined ? dailyPrizeSummary(perDay, prizeTicker, check.days) : ''

    const buildMsgs = () => {
        const msg = address ? gift.message(address) : undefined
        return msg ? [msg] : undefined
    }
    const onDone = ({ input, hash }: WizardTxDone<PrizeDoneInput>) => {
        void dr.refresh()
        if (input) setDone({ input, hash })
    }
    const { submit, panelProps } = useWizardTx<PrizeDoneInput>(buildMsgs, {
        title: isExtend ? `Extend a daily prize for ${stakedName} stakers` : `Daily prize for ${stakedName} stakers`,
        onDone,
    })

    if (done) return <PrizeDone input={done.input} hash={done.hash} />

    const back = () => navigate(returnTo?.href ?? '/rewards')

    // Extend needs the reward and the schedule the link names.
    if (isExtend && !panelProps) {
        if (!denom) {
            return <Notice title="No token selected" onBack={back}>Open this form from a daily prize to extend it.</Notice>
        }
        if (dr.isLoading) {
            return (
                <FormFrame>
                    <VStack align="stretch" gap="16px">
                        <Shimmer h="40px" w="256px" />
                        <Shimmer h="256px" borderRadius="hg.lg" />
                    </VStack>
                </FormFrame>
            )
        }
        if (dr.hasError) {
            return (
                <Notice title="Couldn't load the compounded reward" onBack={back}>
                    The chain query failed. The node may be down. Try again later.
                </Notice>
            )
        }
        if (!denomReward) {
            return (
                <Notice title="No compounded reward yet" onBack={back}>
                    {`${ticker || 'This token'} has no compounded reward. Make it stakable first, then start a daily prize.`}
                </Notice>
            )
        }
        if (!schedule) {
            return (
                <Notice title="Schedule not found" onBack={back}>
                    This daily prize no longer runs. It may have paid its last day. Add a new one instead.
                </Notice>
            )
        }
    }

    const isComplete = stepKeys.every(k => k === 'review' || steps.state[k] === 'done')
    const canSign = isComplete && connected && gift.canSign && !extendShort

    const sign = () => {
        if (!canSign) return
        const names = { stakedDenom: denom, stakedTicker: ticker, prizeDenom, prizeTicker, perDay }
        submit(isExtend
            ? { ...names, kind: 'extend', days: ext?.extra, scheduleId: schedule?.schedule_id, newEnd: ext?.newEnd }
            : { ...names, kind: 'add', dailyAmount: check.dailyUAmount?.toFixed(0), days: check.days })
    }

    const payRows = schedulePayRows(gift, { stakingTicker: stakedName, stakingPossessive: ticker ? `${ticker}'s` : "the token's", prizeTicker })
    const extraDays = ext?.extra ?? 0

    const aside = (
        <>
            {!isExtend && <OutcomePanel>
                {totalText ? (
                    <Text data-testid="outcome">
                        <chakra.span fontWeight="600">{totalText}</chakra.span>
                        {` leaves your wallet now and pays ${perDay} ${prizeTicker} a day to everyone staking ${stakedName}, split by stake. It can't be withdrawn.`}
                    </Text>
                ) : (
                    <Text color="fg.muted">Pick the stakers, the prize, the daily amount and the days to see what leaves your wallet.</Text>
                )}
            </OutcomePanel>}
            <PayPanel
                rows={payRows}
                moduleFee={isExtend ? undefined : gift.mainFee}
                txKind={gift.txKind}
                isLoading={!isExtend && gift.isFeeLoading}
                feeUnknown={gift.feeUnknown}
            />
        </>
    )

    const review = panelProps ? (
        <TxPanel {...panelProps} />
    ) : (
        <ReviewStep
            {...steps.step('review')}
            question="Everything right?"
            leaves={payRows}
            moduleFee={isExtend ? undefined : gift.mainFee}
            txKind={gift.txKind}
            isLoading={!isExtend && gift.isFeeLoading}
            feeUnknown={gift.feeUnknown}
            gets={isExtend
                ? [{ label: 'Extension', value: `${moreDays(extraDays)} for everyone staking ${stakedName}` }]
                : [{ label: VOCABULARY.dailyPrize.name, value: `A daily prize for ${stakedName} stakers` }]}
            extra={isExtend
                ? (ext?.newEnd ? [{ label: 'New end', value: `About ${ext.newEnd}` }] : [])
                : (prize ? [{ label: 'Prize', value: prize }] : [])}
            permanent={isExtend
                ? ['Extra tokens are committed to stakers']
                : ['Committed tokens are paid out to stakers']}
            submitLabel={isExtend ? 'Extend' : 'Start daily prize'}
            onSubmit={sign}
            disabled={!canSign}
            onBack={steps.back}
        >
            {!address ? (
                <SubmitNote>Connect your wallet to fund this daily prize.</SubmitNote>
            ) : isComplete && gift.costs.escrow && !gift.afford.isLoading && !gift.afford.canAfford && gift.afford.message && (
                <SubmitNote tone="error">{gift.afford.message}</SubmitNote>
            )}
        </ReviewStep>
    )

    return (
        <GuidedForm
            parent={returnTo ?? { href: '/rewards', label: 'Rewards' }}
            crumb={VOCABULARY.dailyPrize.name}
            title={
                <>
                    {isExtend ? <>Extend a <GradientText>daily prize</GradientText></> : <>Add a <GradientText>daily prize</GradientText></>}
                    <chakra.span display="inline-flex" verticalAlign="middle" ms="4px"><RewardKindsLink /></chakra.span>
                </>
            }
            subtitle={isExtend
                ? `Pay for more days of this daily prize for ${stakedName} stakers.`
                : "Pay a prize every day to everyone staking a token. Any token's stakers, yours or not."}
            techTag={VOCABULARY.dailyPrize.tech}
            aside={aside}
        >
            {isExtend ? schedule && ext && (
                <>
                    <Question
                        title="Daily prize"
                        question="This daily prize"
                        {...steps.step('schedule')}
                        summary={`${perDay} ${prizeTicker} a day for ${stakedName} stakers · ${ext.daysLeft.toLocaleString('en-US')} days left`}
                        action={{ label: 'Continue', onClick: () => answer('schedule') }}
                    >
                        <VStack as="section" aria-label="This daily prize" align="stretch" gap="8px" p="14px" borderRadius="hg.md" bg="hg.inset" borderWidth="1px" borderColor="hg.divider" data-testid="schedule-terms">
                            <TermRow label="Stake" value={stakedName} />
                            <TermRow label="Daily reward" value={`${perDay} ${prizeTicker}`} />
                            <TermRow label="End date" value={`About ${ext.end}`} />
                        </VStack>
                    </Question>

                    <Question
                        title="Extra days"
                        question="How many more days?"
                        {...steps.step('days')}
                        summary={ext.newEnd && `${moreDays(extraDays)} · new end about ${ext.newEnd}`}
                        onBack={steps.back}
                        action={{ label: 'Review extension', onClick: () => answer('days'), disabled: ext.extra === undefined || extendShort }}
                    >
                        <VStack align="stretch" gap="16px">
                            <Field.Root invalid={daysInput !== '' && ext.error !== ''} disabled={ext.room === 0}>
                                <Field.Label>Extra days</Field.Label>
                                <Input
                                    placeholder="e.g. 30"
                                    inputMode="numeric"
                                    value={daysInput}
                                    onChange={(e) => setDaysInput(e.target.value)}
                                    maxW="200px"
                                />
                                <Field.HelperText>
                                    {ext.room === 0
                                        ? `This daily prize already runs the maximum of ${MAX_SCHEDULE_DAYS} days.`
                                        : `Min 1 · Max ${ext.room} days`}
                                </Field.HelperText>
                                <Field.ErrorText>{ext.error}</Field.ErrorText>
                            </Field.Root>

                            {ext.escrow && (
                                <VStack align="stretch" gap="8px" p="14px" borderRadius="hg.md" bg="hg.inset" borderWidth="1px" borderColor="hg.divider" data-testid="extend-cost">
                                    <Box data-testid="extend-new-end"><TermRow label="New end date" value={`About ${ext.newEnd}`} /></Box>
                                </VStack>
                            )}

                            {ext.escrow && extendShort && (
                                <Text fontSize="14px" color="hg.danger.text" fontWeight="600" role="alert">
                                    {`Not enough ${prizeTicker}: you hold ${display(prizeBalance.amount)} ${prizeTicker}.`}
                                </Text>
                            )}
                        </VStack>
                    </Question>
                </>
            ) : (
                <>
                    <Question
                        title="Staked token"
                        question="Whose stakers get it?"
                        {...steps.step('token')}
                        summary={ticker && `${ticker} stakers`}
                        action={{ label: 'Continue', onClick: () => answer('token'), disabled: !tokenOk }}
                    >
                        <StakedTokenStep
                            flow="dailyPrize"
                            value={denom}
                            onChange={(asset) => setDenom(asset.denom)}
                            ticker={ticker}
                            denomReward={denomReward}
                            isLoading={dr.isLoading}
                            hasError={dr.hasError}
                            onRetry={() => void dr.refresh()}
                        />
                    </Question>

                    <Question
                        title="Prize"
                        question="What do they get every day?"
                        {...steps.step('prize')}
                        summary={prize}
                        onBack={steps.back}
                        action={{ label: 'Continue', onClick: () => answer('prize'), disabled: !check.valid }}
                    >
                        <VStack align="stretch" gap="16px">
                            <AssetPicker label="Prize token (paid from your wallet)" value={pickedPrize} onSelect={(asset) => setPickedPrize(asset.denom)} />
                            {prizeAsset && (
                                <PrizeSlotNote stakedTicker={stakedName} prizeTicker={prizeTicker} slot={slot} max={maxPrizes} prizeFee={prizeFee} />
                            )}
                            {prizeAsset && (
                                <>
                                    <TextField
                                        label={`Prize per day (${prizeTicker})`}
                                        helper={connected ? `You hold ${display(prizeBalance.amount)} ${prizeTicker}.` : 'Shared by everyone staking, by how much each stakes.'}
                                        error={check.dailyError}
                                        value={dailyInput}
                                        onChange={setDailyInput}
                                        placeholder="e.g. 50"
                                    />
                                    <TextField
                                        label="Payout days"
                                        helper={`${MIN_SCHEDULE_DAYS}–${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} payout days. Days with nobody staking are skipped.`}
                                        error={check.daysError}
                                        value={daysInput}
                                        onChange={setDaysInput}
                                        placeholder="e.g. 30"
                                        inputMode="numeric"
                                    />
                                </>
                            )}
                            {check.escrow !== undefined && check.days !== undefined && (
                                <Box fontSize="14px" data-testid="prize-sentence">
                                    <Text>
                                        {`Everyone staking ${stakedName} shares `}
                                        <chakra.strong>{`${perDay} ${prizeTicker} a day`}</chakra.strong>
                                        {' for '}
                                        <chakra.strong>{fmtDays(check.days)}</chakra.strong>
                                        {'.'}
                                    </Text>
                                    <Text mt="6px" fontFamily="mono" fontSize="13px" color="fg.muted">
                                        {`${perDay} ${prizeTicker}/day × ${fmtDays(check.days)} = `}
                                        <chakra.span color="fg" fontWeight="600" data-testid="escrow-amount">{totalText}</chakra.span>
                                    </Text>
                                    {check.short && (
                                        <Text mt="6px" color="hg.danger.text" fontWeight="600" role="alert">
                                            {`Not enough ${prizeTicker}: you hold ${display(prizeBalance.amount)} ${prizeTicker}.`}
                                        </Text>
                                    )}
                                </Box>
                            )}
                        </VStack>
                    </Question>
                </>
            )}

            {review}
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
