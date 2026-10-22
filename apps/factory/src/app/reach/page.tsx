"use client"

import React, { useState } from 'react'
import NextLink from 'next/link'
import BigNumber from 'bignumber.js'
import { Box, Button, chakra, Field, HStack, Input, Link, Text, VStack } from '@chakra-ui/react'
import {
    GradientText,
    amountToUAmount,
    getChainName,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useAllDenomRewards } from '@/hooks/useAllDenomRewards'
import { AIRDROP_TX_KIND, airdropPayRows, useAirdropGift } from '@/hooks/useAirdropGift'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { schedulePayRows, useScheduleGift } from '@/hooks/useScheduleGift'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import { ReachDone } from '@/components/reach-wizard/reach-done'
import { PrizeSlotNote } from '@/components/reward-wizard/prize-slot-note'
import { StakedTokenStep } from '@/components/reward-wizard/staked-token-step'
import { validateAmount } from '@/components/token-wizard/validation'
import { AssetPicker } from '@/components/ui/asset-picker'
import {
    BlockerNote,
    FormPage,
    GuidedForm,
    OutcomePanel,
    PayPanel,
    Question,
    ReviewStep,
    Segmented,
    SubmitNote,
    TxPanel,
    WarningNote,
    useGuidedSteps,
} from '@/components/guided'
import { MAX_SCHEDULE_DAYS, MIN_SCHEDULE_DAYS, compoundedNewHref, prizeBlocker, validateScheduleDays } from '@/lib/denom-reward'
import { nothingStakedReason, stakedTokenOk } from '@/lib/prize-wizard'
import {
    type ReachDoneInput,
    type ReachMode,
    giftNeedsStakable,
    reachCommunitySummary,
    reachSentence,
} from '@/lib/reach'

const STEPS = ['community', 'gift', 'how', 'review'] as const
type FormStep = Exclude<typeof STEPS[number], 'review'>

const DEFAULT_DAYS = '30'

/** The last read right before an airdrop: nothing staked any more, or the read failed. */
type Recheck = { denom: string; result: 'empty' | 'error' }

function ReachContent() {
    const { getQueryParam } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const connected = Boolean(address)
    const all = useAllDenomRewards()

    const initialCommunity = getQueryParam('community') ?? ''
    const [community, setCommunity] = useState(initialCommunity)
    const [giftDenom, setGiftDenom] = useState(getQueryParam('gift') ?? '')
    const [amountInput, setAmountInput] = useState('')
    const [amountTouched, setAmountTouched] = useState(false)
    const [mode, setMode] = useState<ReachMode>('once')
    const [daysInput, setDaysInput] = useState(DEFAULT_DAYS)
    const [answered, setAnswered] = useState<FormStep[]>(initialCommunity ? ['community'] : [])
    const [checking, setChecking] = useState(false)
    const [recheck, setRecheck] = useState<Recheck | undefined>(undefined)
    const [done, setDone] = useState<{ input: ReachDoneInput; hash: string } | undefined>(undefined)

    const { asset: communityAsset } = useAsset(community)
    const dr = useDenomReward(community)
    const { denomReward, prizes } = dr
    const { asset: giftAsset } = useAsset(giftDenom)
    const spendable = useMaxSpendable(giftDenom, mode === 'once' ? AIRDROP_TX_KIND : 'create-denom-reward-schedule')

    const amountError = giftAsset ? validateAmount(amountInput, giftAsset.decimals) : ''
    const uAmount = giftAsset && amountError === '' ? amountToUAmount(amountInput, giftAsset.decimals) : undefined
    const daysError = validateScheduleDays(daysInput)
    const days = daysError === '' ? Number(daysInput.trim()) : undefined

    // Both hooks run; only the chosen mode gets an amount, so the other one stays idle.
    const airdrop = useAirdropGift({
        denom: community,
        stakedAmount: denomReward?.staked_amount,
        prizes,
        prizeDenom: giftDenom,
        uAmount: mode === 'once' ? uAmount : undefined,
    })
    const daily = useScheduleGift({
        denom: community,
        prizes,
        prizeDenom: giftDenom,
        dailyUAmount: mode === 'daily' ? uAmount : undefined,
        days: mode === 'daily' ? days : undefined,
    })
    const active = mode === 'once' ? airdrop : daily
    const slot = airdrop.slot
    const blocker = mode === 'once'
        ? airdrop.blocker
        : daily.isFeeLoading ? '' : prizeBlocker({ prizeDenom: giftDenom, slot, feesKnown: daily.costs.feesKnown })

    // Rows nobody stakes can't be picked (an airdrop would fail with 5018, a daily prize pays nobody).
    // Only when the check right before signing finds the stake gone does it stay answered, so Review shows why.
    const canPickCommunity = stakedTokenOk('airdrop', dr)
    const lastCheck = recheck?.denom === community ? recheck.result : undefined
    const steps = useGuidedSteps(STEPS, {
        community: answered.includes('community') && (canPickCommunity || (lastCheck === 'empty' && stakedTokenOk('dailyPrize', dr))),
        gift: answered.includes('gift') && Boolean(giftAsset) && !slot.capReached && uAmount !== undefined,
        how: answered.includes('how') && (mode === 'once' || days !== undefined),
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    // Plain words stand in for tickers until the asset list loads: a raw factory denom is one long
    // unbreakable word that would push the page wider than a phone.
    const communityTicker = communityAsset?.ticker || 'the token'
    const communityPossessive = communityAsset ? `${communityAsset.ticker}'s` : "the token's"
    const giftTicker = giftAsset?.ticker ?? ''
    const amountDisplay = uAmount !== undefined && giftAsset ? uAmountToBigNumberAmount(uAmount, giftAsset.decimals) : undefined
    const amountText = amountDisplay ? `${prettyAmount(amountDisplay)} ${giftTicker}` : ''
    const totalText = amountDisplay && days !== undefined ? `${prettyAmount(amountDisplay.multipliedBy(days))} ${giftTicker}` : ''
    const stakedText = denomReward && communityAsset
        ? prettyAmount(uAmountToBigNumberAmount(denomReward.staked_amount, communityAsset.decimals))
        : ''
    const balanceText = giftAsset
        ? `of ${prettyAmount(uAmountToBigNumberAmount(spendable.balance, giftAsset.decimals))} ${giftTicker}`
        : ''
    const sentence = amountText
        ? reachSentence(mode, { amount: amountText, community: communityTicker, days, total: totalText })
        : ''

    const needsStakable = Boolean(giftAsset) && giftNeedsStakable(giftDenom, address, all.list?.map(d => d.staking_denom))

    const buildMsgs = () => {
        const msg = address ? active.message(address) : undefined
        return msg ? [msg] : undefined
    }
    const onDone = ({ input, hash }: WizardTxDone<ReachDoneInput>) => {
        void dr.refresh()
        if (input) setDone({ input, hash })
    }
    const { submit, panelProps } = useWizardTx<ReachDoneInput>(buildMsgs, {
        title: `Gift ${giftTicker || 'your token'} to ${communityTicker} stakers`,
        onDone,
    })

    if (done) return <ReachDone input={done.input} hash={done.hash} />

    const isComplete = steps.state.community === 'done' && steps.state.gift === 'done' && steps.state.how === 'done'
    const stakedNow = denomReward !== undefined && new BigNumber(denomReward.staked_amount || 0).gt(0)
    const nobodyStakes = isComplete && mode === 'once' && (lastCheck === 'empty' || (denomReward !== undefined && !stakedNow))
    const canSign = isComplete && connected && blocker === '' && active.canSign && !checking

    // An airdrop is refused when nothing is staked (5018), and the stake can drop to 0 while the
    // wizard is open: we check before you sign. A daily prize skips the days without stakers.
    const sign = async () => {
        if (!canSign) return
        const input: ReachDoneInput = {
            mode,
            communityDenom: community,
            communityTicker,
            giftDenom,
            giftTicker,
            amount: amountText,
            days: mode === 'daily' ? days : undefined,
        }
        if (mode === 'once') {
            setChecking(true)
            const fresh = await dr.refresh()
            setChecking(false)
            if (!fresh || fresh.hasError) {
                setRecheck({ denom: community, result: 'error' })
                return
            }
            if (!fresh.denomReward || !new BigNumber(fresh.denomReward.staked_amount || 0).gt(0)) {
                setRecheck({ denom: community, result: 'empty' })
                return
            }
        }
        setRecheck(undefined)
        submit(input)
    }

    const names = { prizeDenom: giftDenom, stakingTicker: communityTicker, stakingPossessive: communityPossessive, prizeTicker: giftTicker }
    const payRows = mode === 'once' ? airdropPayRows(airdrop, names) : schedulePayRows(daily, names)
    const txKind = mode === 'once' ? AIRDROP_TX_KIND : daily.txKind
    const feeUnknown = mode === 'once'
        ? airdrop.isNewPrize && !slot.capReached && !airdrop.isFeeLoading && !airdrop.costs.feesKnown
        : daily.feeUnknown

    const aside = (
        <>
            <OutcomePanel techTag={`Compounded reward · ${mode === 'once' ? 'airdrop' : 'daily prize'} on ${communityTicker}`}>
                {mode === 'once' && amountText ? (
                    <Text data-testid="reach-outcome">
                        <chakra.span fontWeight="600">{amountText}</chakra.span>
                        {` leaves your wallet now and is split between everyone staking ${communityTicker}, based on how much each one stakes. It can't be taken back. You don't need to own ${communityTicker} or ask its creator.`}
                    </Text>
                ) : mode === 'daily' && totalText ? (
                    <Text data-testid="reach-outcome">
                        <chakra.span fontWeight="600">{totalText}</chakra.span>
                        {` leaves your wallet now and is paid as ${amountText} a day for ${days} payout days to everyone staking ${communityTicker}. It can't be cancelled.`}
                    </Text>
                ) : (
                    <Text color="fg.muted">Pick the community, your gift and how to send it to see what leaves your wallet.</Text>
                )}
            </OutcomePanel>
            <PayPanel rows={payRows} moduleFee={active.mainFee} txKind={txKind} isLoading={active.isFeeLoading} feeUnknown={feeUnknown} />
        </>
    )

    return (
        <GuidedForm
            crumb="Reach another community"
            title={<>Reach another <GradientText>community</GradientText></>}
            subtitle="Gift your token to the people who stake another token. They see it in their wallet, and your token shows up as a prize on that token's Communities page."
            aside={aside}
        >
            <Question
                title="Community"
                question="Whose stakers do you want to reach?"
                {...steps.step('community')}
                summary={communityAsset && stakedText ? reachCommunitySummary(communityAsset.ticker, stakedText) : ''}
                action={{ label: 'Continue', onClick: () => answer('community'), disabled: !canPickCommunity }}
            >
                <StakedTokenStep
                    flow="airdrop"
                    value={community}
                    onChange={(asset) => setCommunity(asset.denom)}
                    ticker={communityAsset?.ticker ?? ''}
                    denomReward={denomReward}
                    isLoading={dr.isLoading}
                    hasError={dr.hasError}
                    onRetry={() => void dr.refresh()}
                />
            </Question>

            <Question
                title="Gift"
                question="What do you give them?"
                {...steps.step('gift')}
                summary={amountText}
                onBack={steps.back}
                action={{
                    label: 'Continue',
                    onClick: () => answer('gift'),
                    disabled: !giftAsset || slot.capReached || uAmount === undefined,
                }}
            >
                <VStack align="stretch" gap="16px">
                    <AssetPicker label="Your gift (paid from your wallet)" value={giftDenom} onSelect={(asset) => setGiftDenom(asset.denom)} />
                    {giftAsset && (
                        <PrizeSlotNote stakedTicker={communityTicker} prizeTicker={giftTicker} slot={slot} max={airdrop.maxPrizes} prizeFee={airdrop.prizeFee} />
                    )}
                    {needsStakable && (
                        <Box data-testid="reach-stakable-tip">
                            <WarningNote
                                action={(
                                    <Link asChild color="hg.link" fontSize="14px" fontWeight="600">
                                        <NextLink href={compoundedNewHref(giftDenom)}>{`Make ${giftTicker} stakable`}</NextLink>
                                    </Link>
                                )}
                            >
                                {`People who get ${giftTicker} can't stake it yet. Make ${giftTicker} stakable so they stay.`}
                            </WarningNote>
                        </Box>
                    )}
                    {giftAsset && (
                        <Field.Root invalid={amountTouched && amountInput.trim() !== '' && amountError !== ''}>
                            <HStack justify="space-between" w="full" gap="8px" flexWrap="wrap">
                                <Field.Label>{`Amount (${giftTicker})`}</Field.Label>
                                <HStack gap="4px">
                                    <Text fontSize="12px" color="hg.text.faint">{balanceText}</Text>
                                    <Button
                                        size="2xs"
                                        variant="ghost" color="hg.link" _hover={{ bg: 'app.subtle' }}
                                        onClick={() => { setAmountInput(spendable.inputValue); setAmountTouched(true) }}
                                        disabled={!spendable.amount.gt(0)}
                                    >
                                        Max
                                    </Button>
                                </HStack>
                            </HStack>
                            <Input
                                placeholder="e.g. 1000"
                                inputMode="decimal"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                onBlur={() => setAmountTouched(true)}
                            />
                            <Field.HelperText>Sent once, or paid each day: you choose next.</Field.HelperText>
                            <Field.ErrorText>{amountError}</Field.ErrorText>
                        </Field.Root>
                    )}
                </VStack>
            </Question>

            <Question
                title="How"
                question="Once, or every day?"
                {...steps.step('how')}
                summary={mode === 'once' ? 'Once, right now' : `Every day for ${daysInput.trim()} days`}
                onBack={steps.back}
                action={{ label: 'Continue', onClick: () => answer('how'), disabled: mode === 'daily' && days === undefined }}
            >
                <VStack align="stretch" gap="16px">
                    <Segmented
                        label="How to send it"
                        options={[
                            { value: 'once', label: 'Once, right now' },
                            { value: 'daily', label: `Every day for ${days ?? 'N'} days` },
                        ]}
                        value={mode}
                        onChange={setMode}
                    />
                    {mode === 'daily' && (
                        <Field.Root invalid={daysError !== ''}>
                            <Field.Label>Days</Field.Label>
                            <Input inputMode="numeric" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} />
                            <Field.HelperText>
                                {`${MIN_SCHEDULE_DAYS}–${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} payout days.`}
                            </Field.HelperText>
                            <Field.ErrorText>{daysError}</Field.ErrorText>
                        </Field.Root>
                    )}
                    {sentence && <Text fontSize="14px" data-testid="reach-sentence">{sentence}</Text>}
                    {mode === 'daily' && giftAsset && !slot.capReached && (
                        <Text fontSize="14px" color="fg.muted" data-testid="reach-schedule-fee">
                            Every new daily prize also pays the daily prize fee. Review shows it with the rest.
                        </Text>
                    )}
                    {blocker !== '' && (
                        <Box data-testid="reach-blocker">
                            <BlockerNote>{blocker}</BlockerNote>
                        </Box>
                    )}
                </VStack>
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={payRows}
                    moduleFee={active.mainFee}
                    txKind={txKind}
                    isLoading={active.isFeeLoading}
                    feeUnknown={feeUnknown}
                    gets={[{ label: 'Reach', value: `${communityTicker} stakers receive ${giftTicker || 'your gift'}` }]}
                    permanent={["Gifts can't be taken back"]}
                    submitLabel={mode === 'once' ? 'Send gift' : 'Start daily gift'}
                    onSubmit={() => void sign()}
                    disabled={!canSign}
                    onBack={steps.back}
                    blocker={nobodyStakes ? (
                        <Box data-testid="presign-blocker">
                            <BlockerNote lead="We check before you sign.">{nothingStakedReason(communityTicker)}</BlockerNote>
                        </Box>
                    ) : undefined}
                >
                    <Text fontSize="14px" color="fg.muted" data-testid="reach-owner-note">
                        {`This adds a prize to ${communityPossessive} compounded reward. It doesn't make you its owner.`}
                    </Text>
                    {!address ? (
                        <SubmitNote>Connect your wallet to send the gift.</SubmitNote>
                    ) : blocker !== '' ? (
                        <SubmitNote tone="error">{blocker}</SubmitNote>
                    ) : lastCheck === 'error' ? (
                        <SubmitNote tone="error">{`Couldn't check ${communityPossessive} stakers right before signing. Please try again.`}</SubmitNote>
                    ) : isComplete && active.costs.escrow && !active.afford.isLoading && !active.afford.canAfford && active.afford.message && (
                        <SubmitNote tone="error">{active.afford.message}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function ReachPage() {
    return (
        <FormPage>
            <ReachContent />
        </FormPage>
    )
}
