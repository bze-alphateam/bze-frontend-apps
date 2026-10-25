"use client"

import React, { useEffect, useState } from 'react'
import BigNumber from 'bignumber.js'
import { Box, Button, chakra, Grid, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import {
    GradientText,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCanAffordTx,
    useCreationFees,
    type Asset,
    type DenomReward,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { StakedTokenPicker, type TokenState } from '@/components/pickers/staked-token-picker'
import { TextField } from '@/components/manage/denom-reward-form-parts'
import { PrizeTokenQuestion } from '@/components/rewards/prize-token-question'
import { RewardKindsLink } from '@/components/rewards/reward-kinds-link'
import { CompoundedDone, type CompoundedDoneInput } from '@/components/reward-wizard/compounded-done'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import {
    BlockerNote,
    ContinueRow,
    FormPage,
    GuidedForm,
    PayPanel,
    type PayRow,
    Question,
    ReviewStep,
    Segmented,
    SubmitNote,
    TipNote,
    TxPanel,
    useGuidedSteps,
    useReturnTo,
    withReturn,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import { MAX_SCHEDULE_DAYS, MIN_SCHEDULE_DAYS, prizeSlot, scheduleFormHref, summarizeScheduleCosts } from '@/lib/denom-reward'
import { minMaxHint, notEnoughText, youHoldText } from '@/lib/format'
import {
    checkDailyPrize,
    compoundedCosts,
    compoundedRewardMsgs,
    compoundedTxKind,
    dailyPrizeSummary,
} from '@/lib/daily-prize'

const FORM_STEPS = ['token', 'prize'] as const
type FormStep = typeof FORM_STEPS[number]
const STEP_KEYS = [...FORM_STEPS, 'review'] as const

type PrizeChoice = 'none' | 'daily'
const PRIZE_CHOICES: { value: PrizeChoice; label: string }[] = [
    { value: 'none', label: 'Not now' },
    { value: 'daily', label: 'Add a daily prize' },
]

const fmtDays = (n: number) => `${n.toLocaleString('en-US')} day${n === 1 ? '' : 's'}`

/** A token's state in the picker: what its compounded reward stakes, or that it has none. */
function stakeState(asset: Asset, dr?: DenomReward): TokenState {
    if (!dr) return { text: 'Not stakable yet', tone: 'muted' }
    const staked = uAmountToBigNumberAmount(dr.staked_amount, asset.decimals)
    return staked.gt(0)
        ? { text: `${prettyAmount(staked)} staked`, tone: 'good' }
        : { text: 'Nothing staked', tone: 'warn' }
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <VStack align="stretch" gap="4px" minW={0} bg="hg.inset" borderRadius="12px" px="14px" py="12px">
            <Text fontSize="12px" color="fg.muted">{label}</Text>
            <Text fontSize="15px" fontWeight="700" wordBreak="break-word">{value}</Text>
        </VStack>
    )
}

function CompoundedNewContent() {
    const { denomParam, replace } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const { address } = useChain(getChainName())
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()

    // Opened from a token (Choose rewards, a Done screen, the token's rewards): step 1 is answered.
    const [denom, setDenom] = useState(() => denomParam ?? '')
    const [prizeChoice, setPrizeChoice] = useState<PrizeChoice>('none')
    const [pickedPrize, setPickedPrize] = useState('')
    const [dailyInput, setDailyInput] = useState('')
    const [daysInput, setDaysInput] = useState('')
    const [answered, setAnswered] = useState<FormStep[]>(() => (denomParam ? ['token'] : []))
    const [done, setDone] = useState<{ input: CompoundedDoneInput; hash: string } | undefined>(undefined)

    const { asset } = useAsset(denom)
    const existing = useDenomReward(denom)
    const { asset: prizeAsset } = useAsset(pickedPrize)
    const { balance: prizeBalance } = useBalance(pickedPrize)

    const connected = Boolean(address)
    const ticker = asset?.ticker ?? ''
    const prizeTicker = prizeAsset?.ticker ?? ''
    const withPrize = prizeChoice === 'daily'

    // A load error is not "none": the chain may already hold one, so nothing is offered until it answers.
    const tokenOk = Boolean(asset) && !existing.isLoading && !existing.hasError && !existing.denomReward
    // Already stakable: there is nothing to create, so the wizard goes on to adding a prize to it.
    const stakable = Boolean(denom) && !existing.isLoading && !existing.hasError && Boolean(existing.denomReward)
    const addPrizeHref = withReturn(scheduleFormHref(denom), returnTo)

    // A brand-new compounded reward has no prize yet: the first prize token always takes a slot.
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const slot = prizeSlot([], pickedPrize, maxPrizes)
    const prizeFee = fees.createDenomRewardPrizeFee
    const check = checkDailyPrize({
        prizeDenom: pickedPrize,
        prizeDecimals: prizeAsset?.decimals,
        dailyInput,
        daysInput,
        slot,
        feesKnown: Boolean(prizeFee),
        prizeBalance: connected ? prizeBalance.amount : undefined,
    })
    const prizeCosts = summarizeScheduleCosts({
        dailyUAmount: check.dailyUAmount,
        days: check.days,
        prizeDenom: pickedPrize,
        mode: 'create',
        scheduleFee: fees.addDenomRewardScheduleFee,
        prizeFee,
        isNewPrize: Boolean(pickedPrize),
    })
    const costs = compoundedCosts(fees.createDenomRewardFee, withPrize ? prizeCosts : undefined)
    const mainFee = costs.feeTotals[0]
    const extraFees = costs.feeTotals.slice(1)
    const txKind = compoundedTxKind(withPrize)
    const feePayment = useFeePayment(mainFee, txKind)
    const afford = useCanAffordTx({
        spec: txKind,
        spend: [...(costs.escrow ? [costs.escrow] : []), ...extraFees],
        moduleFee: feePayment.estimate.resolvedFee,
    })
    const feeUnknown = !isFeeLoading && !costs.feesKnown

    const steps = useGuidedSteps(STEP_KEYS, {
        token: answered.includes('token') && tokenOk,
        prize: answered.includes('prize') && (!withPrize || check.valid),
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }
    const skipPrize = () => {
        setPrizeChoice('none')
        answer('prize')
    }

    const dailyText = check.dailyUAmount !== undefined && prizeAsset
        ? prettyAmount(uAmountToBigNumberAmount(check.dailyUAmount, prizeAsset.decimals))
        : ''
    const prizeBalanceText = prizeAsset ? prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals)) : ''
    const prize = withPrize && dailyText && check.days !== undefined ? dailyPrizeSummary(dailyText, prizeTicker, check.days) : ''

    // Snapshots of the params: the chain fixes both on the reward when it is created.
    const lock = denomRewardLimits.denomRewardLock
    const lockValue = lock === undefined ? 'Unknown' : fmtDays(lock)
    const minStake = denomRewardLimits.denomRewardMinStake
    const minStakeDisplay = minStake !== undefined && asset ? uAmountToBigNumberAmount(minStake, asset.decimals) : undefined
    const minStakeValue = minStakeDisplay === undefined
        ? 'Unknown'
        : minStakeDisplay.gt(0) ? `${prettyAmount(minStakeDisplay)} ${ticker}` : 'No minimum'

    const buildMsgs = () => {
        if (!address || !asset) return undefined
        if (withPrize && (check.dailyUAmount === undefined || check.days === undefined)) return undefined
        return compoundedRewardMsgs(address, denom, withPrize
            ? { prizeDenom: pickedPrize, dailyUAmount: check.dailyUAmount!, days: check.days! }
            : undefined)
    }
    const onDone = ({ input, hash }: WizardTxDone<CompoundedDoneInput>) => {
        if (input) setDone({ input, hash })
    }
    const { submit, panelProps } = useWizardTx<CompoundedDoneInput>(buildMsgs, {
        title: ticker ? `Make ${ticker} stakable` : 'Create compounded reward',
        onDone,
    })

    // A link to a token that is already stakable skips straight there, unless this wizard just made it so.
    const linkedStakable = stakable && denom === denomParam && !done && !panelProps
    useEffect(() => {
        if (linkedStakable) replace(addPrizeHref)
    }, [linkedStakable, addPrizeHref, replace])

    if (done) return <CompoundedDone input={done.input} hash={done.hash} />

    const isComplete = FORM_STEPS.every(k => steps.state[k] === 'done')
    const canCreate = isComplete && connected && tokenOk && costs.feesKnown
        && (!mainFee || feePayment.canPayFee) && !afford.isLoading && afford.canAfford

    const create = () => {
        if (!canCreate) return
        submit(withPrize
            ? { denom, ticker, prizeDenom: pickedPrize, prizeTicker, prize }
            : { denom, ticker })
    }

    // Several charged fees: show their per-denom totals too, the amounts the wallet is charged.
    const chargedCount = costs.fees.filter(f => new BigNumber(f.coin.amount).gt(0)).length
    const totalRows: PayRow[] = chargedCount > 1
        ? costs.feeTotals.map((c, i) => ({ label: i === 0 ? 'Fees total' : 'Also charged', coin: c }))
        : extraFees.map(c => ({ label: 'Also charged', coin: c }))
    const payRows: PayRow[] = [
        ...costs.fees.map(f => ({ label: f.label, coin: f.coin })),
        ...totalRows,
        ...(costs.escrow ? [{ label: 'Rewards', coin: costs.escrow }] : []),
    ]

    const aside = (
        <PayPanel
            rows={payRows}
            moduleFee={mainFee}
            txKind={txKind}
            isLoading={isFeeLoading}
            feeUnknown={feeUnknown}
        />
    )

    return (
        <GuidedForm
            crumb="Compounded reward"
            title={
                <>
                    Create a <GradientText>compounded reward</GradientText>
                    <chakra.span display="inline-flex" verticalAlign="middle" ms="4px"><RewardKindsLink /></chakra.span>
                </>
            }
            subtitle="Make a token stakable."
            techTag={VOCABULARY.holderRewards.tech}
            aside={aside}
        >
            <Question
                title="Stake"
                question="Which token?"
                {...steps.step('token')}
                summary={ticker && `Make ${ticker} stakable`}
                action={stakable
                    ? { label: 'Continue to add a prize', onClick: () => replace(addPrizeHref) }
                    : { label: 'Continue', onClick: () => answer('token'), disabled: !tokenOk }}
            >
                <VStack align="stretch" gap="16px">
                    <StakedTokenPicker
                        mode="makeStakable"
                        includeLP={true}
                        value={denom}
                        onChange={(picked) => setDenom(picked.denom)}
                        stateOf={stakeState}
                    />
                    {asset && existing.hasError && (
                        <BlockerNote
                            action={(
                                <Button size="xs" variant="ghost" color="hg.link" fontWeight="600" onClick={() => void existing.refresh()}>
                                    <LuRefreshCw /> Retry
                                </Button>
                            )}
                        >
                            {`Couldn't check whether ${ticker} already has a compounded reward. The node may be down.`}
                        </BlockerNote>
                    )}
                    {stakable && (
                        <Box data-testid="already-stakable">
                            <TipNote>{`${ticker || 'This token'} is already stakable.`}</TipNote>
                        </Box>
                    )}
                    {tokenOk && (
                        <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="12px" data-testid="token-facts">
                            <Fact label="Unstaking lock" value={lockValue} />
                            <Fact label="Minimum stake" value={minStakeValue} />
                        </Grid>
                    )}
                </VStack>
            </Question>

            <Question
                title="First daily prize"
                question="Fund it now?"
                {...steps.step('prize')}
                summary={withPrize ? prize : 'No prize yet'}
                onBack={steps.back}
            >
                <VStack align="stretch" gap="16px">
                    <Segmented label="First daily prize" options={PRIZE_CHOICES} value={prizeChoice} onChange={setPrizeChoice} />
                    {withPrize && (
                        <>
                            <PrizeTokenQuestion
                                prizes={[]}
                                maxPrizeDenoms={maxPrizes}
                                value={pickedPrize}
                                onSelect={(picked) => setPickedPrize(picked.denom)}
                            />
                            {prizeAsset && (
                                <>
                                    <TextField
                                        label={`Daily reward (${prizeTicker})`}
                                        helper={connected ? youHoldText(prizeBalanceText, prizeTicker) : undefined}
                                        error={check.dailyError}
                                        value={dailyInput}
                                        onChange={setDailyInput}
                                        placeholder="e.g. 50"
                                    />
                                    <TextField
                                        label="Days"
                                        helper={minMaxHint(MIN_SCHEDULE_DAYS, MAX_SCHEDULE_DAYS, 'days')}
                                        error={check.daysError}
                                        value={daysInput}
                                        onChange={setDaysInput}
                                        placeholder="e.g. 30"
                                        inputMode="numeric"
                                    />
                                    {check.escrow !== undefined && check.short && (
                                        <Text fontSize="14px" color="hg.danger.text" fontWeight="600" role="alert">
                                            {notEnoughText(prizeTicker, prizeBalanceText)}
                                        </Text>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    <ContinueRow disabled={withPrize && !check.valid} onContinue={() => answer('prize')} onSkip={skipPrize} />
                </VStack>
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={payRows}
                    moduleFee={mainFee}
                    txKind={txKind}
                    isLoading={isFeeLoading}
                    feeUnknown={feeUnknown}
                    gets={[{ label: VOCABULARY.holderRewards.name, value: `${ticker} becomes stakable for everyone` }]}
                    extra={[
                        { label: 'Unstaking lock', value: lockValue },
                        { label: 'Minimum stake', value: minStakeValue },
                        { label: 'Daily reward', value: withPrize ? prize : 'None yet' },
                    ]}
                    permanent={[
                        'The compounded reward (one per token)',
                        ...(withPrize ? ['Rewards are committed to stakers'] : []),
                    ]}
                    submitLabel={ticker ? `Make ${ticker} stakable` : 'Make a token stakable'}
                    onSubmit={create}
                    disabled={!canCreate}
                    onBack={steps.back}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet.</SubmitNote>
                    ) : isComplete && !afford.isLoading && !afford.canAfford && afford.message && (
                        <SubmitNote tone="error">{afford.message}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function CompoundedRewardNewPage() {
    return (
        <FormPage>
            <CompoundedNewContent />
        </FormPage>
    )
}
