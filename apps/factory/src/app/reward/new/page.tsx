"use client"

import React, { useCallback, useMemo, useState } from 'react'
import { chakra, Field, Input, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { bze } from '@bze/bzejs'
import {
    GradientText,
    amountToUAmount,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCreationFees,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { AssetPicker } from '@/components/ui/asset-picker'
import { RewardKindsLink } from '@/components/rewards/reward-kinds-link'
import { SimpleRewardDone, type SimpleRewardDoneInput } from '@/components/reward-wizard/simple-reward-done'
import { validateAmount } from '@/components/token-wizard/validation'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import {
    AnswerChip,
    AnswerChips,
    FormPage,
    GuidedForm,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    useGuidedSteps,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import {
    DURATION_PRESETS,
    MAX_DURATION_DAYS,
    MAX_LOCK_DAYS,
    MIN_DURATION_DAYS,
    escrowAmount,
    hasNoMinStake,
    minStakeToChain,
    prizeSummary,
    programBalances,
    rulesSummary,
    validateDays,
    validateMinStake,
} from '@/lib/reward-new'
import { minMaxHint, notEnoughText, youHoldText } from '@/lib/format'

const { createStakingReward } = bze.rewards.MessageComposer.withTypeUrl

const FORM_STEPS = ['stake', 'prize', 'rules'] as const
type FormStep = typeof FORM_STEPS[number]
const STEP_KEYS = [...FORM_STEPS, 'review'] as const

const TX_KIND = 'create-staking-reward'

function FieldWithError({
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

function RewardNewContent() {
    const { getQueryParam } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { fees, isLoading: isFeeLoading } = useCreationFees()

    // The pool Done screen and the Choose screen chain here with the staked token preselected: step 1 is answered.
    const [stakingDenom, setStakingDenom] = useState(() => getQueryParam('staking') ?? '')
    const [prizeDenom, setPrizeDenom] = useState('')
    const [prizePerDay, setPrizePerDay] = useState('')
    const [duration, setDuration] = useState('')
    const [lock, setLock] = useState('0')
    const [minStake, setMinStake] = useState('')
    const [answered, setAnswered] = useState<FormStep[]>(() => (getQueryParam('staking') ? ['stake'] : []))
    const [done, setDone] = useState<{ input: SimpleRewardDoneInput; hash: string } | undefined>(undefined)

    const { asset: stakingAsset } = useAsset(stakingDenom)
    const { asset: prizeAsset } = useAsset(prizeDenom)
    const { balance: prizeBalance } = useBalance(prizeDenom)

    const fee = fees.createStakingRewardFee
    const { balance: feeBalance, isLoading: isFeeBalanceLoading } = useBalance(fee?.denom ?? '')
    const { asset: feeAsset } = useAsset(fee?.denom ?? '')
    const feePayment = useFeePayment(fee, TX_KIND)

    const connected = Boolean(address)
    const stakeTicker = stakingAsset?.ticker ?? ''
    const prizeTicker = prizeAsset?.ticker ?? ''

    const prizeError = prizeAsset ? validateAmount(prizePerDay, prizeAsset.decimals) : ''
    const durationError = validateDays(duration, MIN_DURATION_DAYS, MAX_DURATION_DAYS)
    const lockError = validateDays(lock, 0, MAX_LOCK_DAYS)
    const minStakeError = stakingAsset ? validateMinStake(minStake, stakingAsset.decimals) : ''

    // The chain escrows prize × duration up front, not per day.
    const escrow = useMemo(() => {
        if (!prizeAsset || prizeError !== '' || durationError !== '') return undefined
        return escrowAmount(prizePerDay, prizeAsset.decimals, duration)
    }, [prizeAsset, prizePerDay, duration, prizeError, durationError])
    const escrowDisplay = escrow && prizeAsset ? uAmountToBigNumberAmount(escrow, prizeAsset.decimals) : undefined

    const { hasEnoughForEscrow, canPayFee } = programBalances({
        escrow,
        prizeDenom,
        prizeBalance: prizeBalance.amount,
        fee,
        feeBalance: feeBalance.amount,
        gasFee: feePayment.gasFee,
        paysWithAlt: feePayment.paysWithAlt,
    })

    // The budget step checks the rewards alone; the creation fee on top (same token) is checked at Review.
    // Without a wallet the budget can still be walked to Review.
    const coversRewards = Boolean(escrow) && prizeBalance.amount.gte(escrow ?? 0)
    const prizeValid = Boolean(prizeAsset) && Boolean(escrow) && (!connected || coversRewards)
    const rulesValid = lockError === '' && minStakeError === ''

    const steps = useGuidedSteps(STEP_KEYS, {
        stake: answered.includes('stake') && Boolean(stakingAsset),
        prize: answered.includes('prize') && prizeValid,
        rules: answered.includes('rules') && rulesValid,
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const perDayText = prizeAsset && prizeError === '' && prizePerDay.trim() ? prettyAmount(new BigNumber(prizePerDay)) : ''
    const budget = escrowDisplay && prizeTicker ? prizeSummary(perDayText, prizeTicker, duration) : ''
    const daysCount = Number(duration.trim())
    const minStakeText = hasNoMinStake(minStake) || minStakeError !== ''
        ? undefined
        : `${prettyAmount(new BigNumber(minStake.trim()))} ${stakeTicker}`
    const rules = rulesSummary(lock, minStakeText)

    const buildMsgs = useCallback(() => {
        if (!address || !stakingAsset || !prizeAsset || !escrow) return undefined
        return [createStakingReward({
            creator: address,
            prizeAmount: amountToUAmount(prizePerDay, prizeAsset.decimals),
            prizeDenom,
            stakingDenom,
            duration: duration.trim(),
            minStake: minStakeToChain(minStake, stakingAsset.decimals),
            lock: lock.trim(),
        })]
    }, [address, stakingAsset, prizeAsset, escrow, prizePerDay, prizeDenom, stakingDenom, duration, minStake, lock])

    const onDone = useCallback(({ input, hash }: WizardTxDone<SimpleRewardDoneInput>) => {
        if (input) setDone({ input, hash })
    }, [])
    const { submit, panelProps } = useWizardTx<SimpleRewardDoneInput>(buildMsgs, {
        title: stakeTicker ? `Create simple reward for ${stakeTicker}` : 'Create simple reward',
        onDone,
    })

    if (done) return <SimpleRewardDone input={done.input} hash={done.hash} />

    const isComplete = FORM_STEPS.every(k => steps.state[k] === 'done')
    const canCreate = isComplete && connected && Boolean(fee) && !isFeeBalanceLoading && canPayFee && hasEnoughForEscrow

    const create = () => {
        if (!canCreate) return
        submit({ stakingDenom, stakingTicker: stakeTicker, prizeDenom, prizeTicker, perDay: perDayText, prize: budget })
    }

    const prizeBalanceText = prizeAsset
        ? prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals))
        : ''
    const feeTicker = feeAsset?.ticker ?? fee?.denom ?? ''
    const feeBalanceText = prettyAmount(uAmountToBigNumberAmount(feeBalance.amount, feeAsset?.decimals ?? 6))
    // The same rows, in the same order, in the pay panel and in Review.
    const payRows = [
        ...(escrow && prizeDenom ? [{ label: 'Rewards', coin: { denom: prizeDenom, amount: escrow.toFixed() } }] : []),
        { label: 'Creation fee', coin: fee },
    ]

    const aside = (
        <PayPanel
            rows={payRows}
            moduleFee={fee}
            txKind={TX_KIND}
            isLoading={isFeeLoading}
            feeUnknown={!fee}
        />
    )

    return (
        <GuidedForm
            crumb="Simple reward"
            title={
                <>
                    Create a <GradientText>simple reward</GradientText>
                    <chakra.span display="inline-flex" verticalAlign="middle" ms="4px"><RewardKindsLink /></chakra.span>
                </>
            }
            subtitle="Pay stakers a daily reward for a set number of days."
            techTag={VOCABULARY.stakingProgram.tech}
            aside={aside}
        >
            <Question
                title="Stake"
                question="Which token?"
                {...steps.step('stake')}
                summary={stakeTicker && `Stake ${stakeTicker}`}
                action={{ label: 'Continue', onClick: () => answer('stake'), disabled: !stakingAsset }}
            >
                <AssetPicker
                    label="Token"
                    value={stakingDenom}
                    includeLP={true}
                    onSelect={(asset) => setStakingDenom(asset.denom)}
                />
            </Question>

            <Question
                title="Reward"
                question="What do they earn?"
                {...steps.step('prize')}
                summary={budget}
                onBack={steps.back}
                action={{ label: 'Continue', onClick: () => answer('prize'), disabled: !prizeValid }}
            >
                <VStack align="stretch" gap="16px">
                    <AssetPicker
                        label="Reward token"
                        value={prizeDenom}
                        onSelect={(asset) => setPrizeDenom(asset.denom)}
                    />
                    {prizeAsset && (
                        <>
                            <FieldWithError
                                label={`Daily reward (${prizeTicker})`}
                                helper={connected ? youHoldText(prizeBalanceText, prizeTicker) : undefined}
                                error={prizeError}
                                value={prizePerDay}
                                onChange={setPrizePerDay}
                                placeholder="e.g. 100"
                            />
                            <VStack align="stretch" gap="8px">
                                <FieldWithError
                                    label="Days"
                                    helper={minMaxHint(MIN_DURATION_DAYS, MAX_DURATION_DAYS, 'days')}
                                    error={durationError}
                                    value={duration}
                                    onChange={setDuration}
                                    placeholder="e.g. 30"
                                    inputMode="numeric"
                                />
                                <AnswerChips>
                                    {DURATION_PRESETS.map(preset => (
                                        <AnswerChip key={preset} selected={duration.trim() === preset} onClick={() => setDuration(preset)}>
                                            {`${preset} days`}
                                        </AnswerChip>
                                    ))}
                                </AnswerChips>
                            </VStack>
                            {budget && connected && !coversRewards && (
                                <Text fontSize="14px" color="hg.danger.text" fontWeight="600" role="alert">
                                    {notEnoughText(prizeTicker, prizeBalanceText)}
                                </Text>
                            )}
                        </>
                    )}
                </VStack>
            </Question>

            <Question
                title="Rules"
                question="Any conditions?"
                {...steps.step('rules')}
                summary={rules}
                onBack={steps.back}
                action={{ label: 'Review reward', onClick: () => answer('rules'), disabled: !rulesValid }}
            >
                <VStack align="stretch" gap="16px">
                    <FieldWithError
                        label="Unstaking lock (days)"
                        helper={minMaxHint(0, MAX_LOCK_DAYS, 'days')}
                        error={lockError}
                        value={lock}
                        onChange={setLock}
                        inputMode="numeric"
                    />
                    <FieldWithError
                        label={`Minimum stake (optional${stakeTicker ? `, ${stakeTicker}` : ''})`}
                        error={minStakeError}
                        value={minStake}
                        onChange={setMinStake}
                        placeholder="None"
                    />
                </VStack>
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={payRows}
                    moduleFee={fee}
                    txKind={TX_KIND}
                    isLoading={isFeeLoading}
                    feeUnknown={!fee}
                    gets={[{ label: 'Reward', value: `Stake ${stakeTicker} · earn ${perDayText} ${prizeTicker} a day` }]}
                    extra={[
                        { label: 'Days', value: `${daysCount.toLocaleString('en-US')} day${daysCount === 1 ? '' : 's'}` },
                        { label: 'Rules', value: rules },
                    ]}
                    permanent={[
                        'Daily reward and rules',
                        'Rewards are committed to stakers',
                    ]}
                    submitLabel="Create simple reward"
                    onSubmit={create}
                    disabled={!canCreate}
                    onBack={steps.back}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet.</SubmitNote>
                    ) : isComplete && !isFeeBalanceLoading && !canPayFee && (
                        <SubmitNote tone="error">{notEnoughText(feeTicker, feeBalanceText)}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function RewardNewPage() {
    return (
        <FormPage>
            <RewardNewContent />
        </FormPage>
    )
}
