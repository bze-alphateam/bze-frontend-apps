"use client"

import React, { Suspense, useMemo, useState } from 'react'
import { Box, Button, Container, Field, HStack, Input, Skeleton, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { bze } from '@bze/bzejs'
import {
    amountToUAmount,
    getExplorerTxURL,
    getChainName,
    getStakingApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCreationFees,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { RewardInfoButton } from '@/components/rewards/reward-info-button'
import { validateAmount } from '@/components/token-wizard/validation'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import {
    GuidedForm,
    OutcomePanel,
    PayPanel,
    Question,
    SuccessPanel,
    TipNote,
    useGuidedSteps,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import {
    MAX_DURATION_DAYS,
    MAX_LOCK_DAYS,
    MIN_DURATION_DAYS,
    escrowAmount,
    extractRewardId,
    hasNoMinStake,
    minStakeToChain,
    programBalances,
    validateDays,
    validateMinStake,
} from '@/lib/reward-new'

const { createStakingReward } = bze.rewards.MessageComposer.withTypeUrl

const STEPS = ['stake', 'prize', 'rules'] as const
type Step = typeof STEPS[number]

const TX_KIND = 'create-staking-reward'

function FieldWithError({
    label,
    helper,
    error,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    helper?: string;
    error: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const [touched, setTouched] = useState(false)

    return (
        <Field.Root invalid={touched && error !== ''}>
            <Field.Label>{label}</Field.Label>
            <Input
                placeholder={placeholder}
                inputMode="decimal"
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
    const { tx } = useFactoryTx()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [created, setCreated] = useState<
        { txHash: string; rewardId?: string; escrowLabel: string } | undefined
    >(undefined)

    // The pool success screens chain here with their LP denom preselected: question 1 is answered.
    const [stakingDenom, setStakingDenom] = useState(() => getQueryParam('staking') ?? '')
    const [prizeDenom, setPrizeDenom] = useState('')
    const [prizePerDay, setPrizePerDay] = useState('')
    const [duration, setDuration] = useState('')
    const [lock, setLock] = useState('0')
    const [minStake, setMinStake] = useState('')
    const [answered, setAnswered] = useState<Step[]>(() => (getQueryParam('staking') ? ['stake'] : []))

    const { asset: stakingAsset } = useAsset(stakingDenom)
    const { asset: prizeAsset } = useAsset(prizeDenom)
    const { balance: prizeBalance } = useBalance(prizeDenom)

    const fee = fees.createStakingRewardFee
    const { balance: feeBalance, isLoading: isFeeBalanceLoading } = useBalance(fee?.denom ?? '')
    const feePayment = useFeePayment(fee, TX_KIND)

    const stakeTicker = stakingAsset?.ticker ?? ''
    const prizeTicker = prizeAsset?.ticker ?? ''

    const prizeError = prizeAsset ? validateAmount(prizePerDay, prizeAsset.decimals) : ''
    const durationError = validateDays(duration, MIN_DURATION_DAYS, MAX_DURATION_DAYS)
    const lockError = validateDays(lock, 0, MAX_LOCK_DAYS)
    const minStakeError = stakingAsset ? validateMinStake(minStake, stakingAsset.decimals) : ''

    // The chain escrows prize × duration upfront, not per day.
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

    const prizeValid = Boolean(prizeAsset) && Boolean(escrow)

    const steps = useGuidedSteps(STEPS, {
        stake: answered.includes('stake') && Boolean(stakingAsset),
        prize: answered.includes('prize') && prizeValid,
        rules: answered.includes('rules') && lockError === '' && minStakeError === '',
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const isComplete = STEPS.every(k => steps.state[k] === 'done')
    const canConfirm = isComplete && Boolean(address) && Boolean(fee) &&
        !isFeeBalanceLoading && canPayFee && hasEnoughForEscrow

    const submit = async () => {
        if (!address || !canConfirm || !stakingAsset || !prizeAsset || !escrowDisplay) return

        const msg = createStakingReward({
            creator: address,
            prizeAmount: amountToUAmount(prizePerDay, prizeAsset.decimals),
            prizeDenom,
            stakingDenom,
            duration: duration.trim(),
            minStake: minStakeToChain(minStake, stakingAsset.decimals),
            lock: lock.trim(),
        })

        const escrowLabel = `${prettyAmount(escrowDisplay)} ${prizeAsset.ticker}`

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: (res) => {
                    setCreated({ txHash: res.txhash, rewardId: extractRewardId(res), escrowLabel })
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const startAnother = () => {
        setCreated(undefined)
        setStakingDenom('')
        setPrizeDenom('')
        setPrizePerDay('')
        setDuration('')
        setLock('0')
        setMinStake('')
        setAnswered([])
        steps.close()
    }

    if (created) {
        return (
            <SuccessPanel
                title="Your staking program is live!"
                text={`${created.escrowLabel} was locked for prizes. Anyone staking ${stakeTicker || 'the staking token'} now shares the daily prize.`}
                code={created.rewardId ? { label: 'Your program id', value: created.rewardId } : undefined}
                links={[
                    { label: 'Staking', href: getStakingApp().href, app: 'staking' },
                    { label: 'Explorer', href: getExplorerTxURL(created.txHash), app: 'explorer' },
                ]}
                again={{ label: 'Start another program', onClick: startAnother }}
            />
        )
    }

    const prizeBalanceText = prizeAsset
        ? prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals))
        : ''
    const prizeAmountText = prizeAsset && prizeError === '' ? prettyAmount(new BigNumber(prizePerDay)) : ''
    const escrowText = escrowDisplay ? `${prettyAmount(escrowDisplay)} ${prizeTicker}` : ''
    const minStakeText = hasNoMinStake(minStake) || minStakeError !== ''
        ? 'none'
        : `${prettyAmount(new BigNumber(minStake.trim()))} ${stakeTicker}`

    const prizeSummary = prizeValid ? `${prizeAmountText} ${prizeTicker} a day for ${duration.trim()} days` : ''
    const rulesSummary = `lock ${lock.trim()} days · minimum ${minStakeText}`

    const aside = (
        <>
            <OutcomePanel>
                {escrowText && stakeTicker ? (
                    <Text>
                        <Text as="span" fontWeight="semibold">{escrowText}</Text> leaves your wallet now and is paid
                        out as {prizeAmountText} {prizeTicker} a day for {duration.trim()} days to everyone
                        staking {stakeTicker}. It can&apos;t be withdrawn. Anyone can add more days later.
                    </Text>
                ) : (
                    <Text color="fg.muted">
                        Pick what people stake and the daily prize to see what your program pays out.
                    </Text>
                )}
            </OutcomePanel>

            <PayPanel
                rows={[
                    ...(escrow && prizeDenom ? [{ label: 'Locked upfront for prizes', coin: { denom: prizeDenom, amount: escrow.toFixed() } }] : []),
                    { label: `${VOCABULARY.stakingProgram.name} fee`, coin: fee },
                ]}
                moduleFee={fee}
                txKind={TX_KIND}
                isLoading={isFeeLoading}
                feeUnknown={!fee}
            />

            <VStack align="stretch" gap={2}>
                <Button
                    size="lg"
                    colorPalette="yellow"
                    onClick={submit}
                    disabled={!canConfirm}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Start the program
                </Button>
                {!address ? (
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Connect your wallet to create this reward.
                    </Text>
                ) : isComplete && !isFeeBalanceLoading && !canPayFee && (
                    <Text fontSize="sm" color="fg.error" textAlign="center">
                        Not enough balance to cover the creation fee on top of the escrowed prize.
                    </Text>
                )}
            </VStack>
        </>
    )

    return (
        <GuidedForm
            title={
                <HStack as="span" gap={1} display="inline-flex" align="center">
                    Run a campaign with an end date
                    <RewardInfoButton />
                </HStack>
            }
            subtitle="People stake one token for a set number of days and earn a daily prize you fund upfront."
            techTag={VOCABULARY.stakingProgram.tech}
            aside={aside}
        >
            <Question
                number={1}
                title="What do people stake?"
                state={steps.state.stake}
                summary={stakeTicker}
                onChange={() => steps.open('stake')}
            >
                <VStack align="stretch" gap={4}>
                    <AssetPicker
                        label="Token people stake"
                        value={stakingDenom}
                        includeLP={true}
                        onSelect={(asset) => setStakingDenom(asset.denom)}
                    />
                    <Text fontSize="sm" color="fg.muted">
                        Often an LP token, to reward people who add liquidity.
                    </Text>
                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!stakingAsset} onClick={() => answer('stake')}>
                        Continue
                    </Button>
                </VStack>
            </Question>

            <Question
                number={2}
                title="What do they earn, and for how long?"
                state={steps.state.prize}
                summary={prizeSummary}
                onChange={() => steps.open('prize')}
            >
                <VStack align="stretch" gap={4}>
                    <AssetPicker
                        label="Prize (paid from your wallet)"
                        value={prizeDenom}
                        onSelect={(asset) => setPrizeDenom(asset.denom)}
                    />
                    {prizeAsset && (
                        <>
                            <FieldWithError
                                label={`Prize per day (${prizeTicker})`}
                                helper={`of ${prizeBalanceText} ${prizeTicker}`}
                                error={prizeError}
                                value={prizePerDay}
                                onChange={setPrizePerDay}
                                placeholder="e.g. 1000"
                            />
                            <FieldWithError
                                label="For how many days"
                                helper={`${MIN_DURATION_DAYS}–${MAX_DURATION_DAYS.toLocaleString()} days of daily payouts.`}
                                error={durationError}
                                value={duration}
                                onChange={setDuration}
                                placeholder="e.g. 30"
                            />
                            {escrowText && (
                                <Box fontSize="sm">
                                    <Text color="fg.muted">
                                        Locked upfront: <Text as="span" fontWeight="semibold" color="fg">{escrowText}</Text>
                                        {' '}(prize × days), paid to stakers day by day.
                                    </Text>
                                    {address && !hasEnoughForEscrow && (
                                        <Text color="fg.error" fontWeight="medium" role="alert">
                                            Not enough {prizeTicker} — you have {prizeBalanceText}.
                                        </Text>
                                    )}
                                </Box>
                            )}
                        </>
                    )}
                    <TipNote lead="Anyone can top up more days later.">
                        Every day the prize is split among stakers in proportion to their stake.
                    </TipNote>
                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!prizeValid} onClick={() => answer('prize')}>
                        Continue
                    </Button>
                </VStack>
            </Question>

            <Question
                number={3}
                title="Rules for stakers"
                state={steps.state.rules}
                summary={rulesSummary}
                onChange={() => steps.open('rules')}
            >
                <VStack align="stretch" gap={4}>
                    <FieldWithError
                        label="Lock period (days)"
                        helper={`0–${MAX_LOCK_DAYS.toLocaleString()} days. 0 = they can leave any time.`}
                        error={lockError}
                        value={lock}
                        onChange={setLock}
                    />
                    <FieldWithError
                        label={`Minimum stake (optional${stakeTicker ? `, ${stakeTicker}` : ''})`}
                        helper="The smallest amount someone can join with. Leave empty for no minimum."
                        error={minStakeError}
                        value={minStake}
                        onChange={setMinStake}
                        placeholder="0"
                    />
                    <Button
                        alignSelf="start"
                        colorPalette="yellow"
                        size="sm"
                        disabled={lockError !== '' || minStakeError !== ''}
                        onClick={() => answer('rules')}
                    >
                        Continue
                    </Button>
                </VStack>
            </Question>
        </GuidedForm>
    )
}

export default function RewardNewPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="5xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <RewardNewContent />
                </Suspense>
            </Container>
        </Box>
    )
}
