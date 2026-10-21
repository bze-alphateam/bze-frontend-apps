"use client"

import React, { useState } from 'react'
import BigNumber from 'bignumber.js'
import { Box, Button, chakra, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
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
import { useDenomReward } from '@/hooks/useDenomReward'
import { AIRDROP_TX_KIND, airdropPayRows, useAirdropGift } from '@/hooks/useAirdropGift'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import { PrizeDone } from '@/components/reward-wizard/prize-done'
import { PrizeSlotNote } from '@/components/reward-wizard/prize-slot-note'
import { StakedTokenStep } from '@/components/reward-wizard/staked-token-step'
import { RewardKindsLink } from '@/components/rewards/reward-kinds-link'
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
    SubmitNote,
    TxPanel,
    useGuidedSteps,
    useReturnTo,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import { type PrizeDoneInput, nothingStakedReason, stakedTokenOk } from '@/lib/prize-wizard'

const STEPS = ['token', 'prize', 'review'] as const
type FormStep = Exclude<typeof STEPS[number], 'review'>

/** The last read right before signing: nothing staked any more, or the read failed. */
type Recheck = { denom: string; result: 'empty' | 'error' }

function AirdropFormContent() {
    const { denomParam } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const { address } = useChain(getChainName())
    const connected = Boolean(address)

    const [denom, setDenom] = useState(() => denomParam ?? '')
    const [prizeDenom, setPrizeDenom] = useState('')
    const [amountInput, setAmountInput] = useState('')
    const [amountTouched, setAmountTouched] = useState(false)
    const [answered, setAnswered] = useState<FormStep[]>(() => (denomParam ? ['token'] : []))
    const [checking, setChecking] = useState(false)
    const [recheck, setRecheck] = useState<Recheck | undefined>(undefined)
    const [done, setDone] = useState<{ input: PrizeDoneInput; hash: string } | undefined>(undefined)

    const { asset: stakingAsset } = useAsset(denom)
    const dr = useDenomReward(denom)
    const { denomReward, prizes } = dr
    const { asset: prizeAsset } = useAsset(prizeDenom)
    // The balance shown and the Max button: the whole balance, less the gas when the prize is the gas token.
    const spendable = useMaxSpendable(prizeDenom, AIRDROP_TX_KIND)

    const amountError = prizeAsset ? validateAmount(amountInput, prizeAsset.decimals) : ''
    const uAmount = prizeAsset && amountError === '' ? amountToUAmount(amountInput, prizeAsset.decimals) : undefined

    const gift = useAirdropGift({ denom, stakedAmount: denomReward?.staked_amount, prizes, prizeDenom, uAmount })
    const { slot, isNewPrize, costs, afford } = gift
    const short = connected && costs.escrow !== undefined && spendable.balance.lt(costs.escrow.amount)

    // Step 1 needs something staked, also when ?denom= answers it. Only when the check right before
    // signing finds the stake gone does it stay answered, so Review shows why instead of jumping back.
    const canPickToken = stakedTokenOk('airdrop', dr)
    const lastCheck = recheck?.denom === denom ? recheck.result : undefined
    const steps = useGuidedSteps(STEPS, {
        token: answered.includes('token') && (canPickToken || (lastCheck === 'empty' && stakedTokenOk('dailyPrize', dr))),
        prize: answered.includes('prize') && Boolean(prizeAsset) && !slot.capReached && costs.escrow !== undefined && !short,
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const ticker = stakingAsset?.ticker ?? ''
    // Until the asset list loads, plain words stand in for the tickers: a raw factory denom is one
    // long unbreakable word that would push the page wider than a phone.
    const stakedName = ticker || 'the token'
    const prizeTicker = prizeAsset?.ticker ?? ''
    const amountDisplay = costs.escrow && prizeAsset ? uAmountToBigNumberAmount(costs.escrow.amount, prizeAsset.decimals) : undefined
    const amountText = amountDisplay ? prettyAmount(amountDisplay) : ''
    const giftText = amountText ? `${amountText} ${prizeTicker}` : ''
    const stakedText = denomReward && stakingAsset
        ? `${prettyAmount(uAmountToBigNumberAmount(denomReward.staked_amount, stakingAsset.decimals))} ${ticker}`
        : ''
    const balanceText = prizeAsset ? `${prettyAmount(uAmountToBigNumberAmount(spendable.balance, prizeAsset.decimals))} ${prizeTicker}` : ''

    const buildMsgs = () => {
        const msg = address ? gift.message(address) : undefined
        return msg ? [msg] : undefined
    }
    const onDone = ({ input, hash }: WizardTxDone<PrizeDoneInput>) => {
        void dr.refresh()
        if (input) setDone({ input, hash })
    }
    const { submit, panelProps } = useWizardTx<PrizeDoneInput>(buildMsgs, {
        title: `Airdrop to ${stakedName} stakers`,
        onDone,
    })

    if (done) return <PrizeDone input={done.input} hash={done.hash} />

    const isComplete = steps.state.token === 'done' && steps.state.prize === 'done'
    const stakedNow = denomReward !== undefined && new BigNumber(denomReward.staked_amount || 0).gt(0)
    const nobodyStakes = isComplete && (lastCheck === 'empty' || (denomReward !== undefined && !stakedNow))
    const canSign = isComplete && connected && gift.canSign && !short && !checking

    // We check before you sign (canvas C4): the stake can drop to 0 while the wizard is open, and
    // the chain then refuses the airdrop (5018).
    const sign = async () => {
        if (!canSign) return
        const input: PrizeDoneInput = {
            kind: 'airdrop',
            stakedDenom: denom,
            stakedTicker: ticker,
            prizeDenom,
            prizeTicker,
            amount: amountText,
        }
        setChecking(true)
        const fresh = await dr.refresh()
        setChecking(false)
        if (!fresh || fresh.hasError) {
            setRecheck({ denom, result: 'error' })
            return
        }
        if (!fresh.denomReward || !new BigNumber(fresh.denomReward.staked_amount || 0).gt(0)) {
            setRecheck({ denom, result: 'empty' })
            return
        }
        setRecheck(undefined)
        submit(input)
    }

    const payRows = airdropPayRows(gift, {
        prizeDenom,
        stakingTicker: stakedName,
        stakingPossessive: ticker ? `${ticker}'s` : "the token's",
        prizeTicker,
    })
    const feeLoading = isNewPrize && gift.isFeeLoading
    const feeUnknown = isNewPrize && !slot.capReached && !gift.isFeeLoading && !costs.feesKnown

    const aside = (
        <>
            <OutcomePanel>
                {giftText ? (
                    <Text data-testid="airdrop-outcome">
                        <chakra.span fontWeight="600">{giftText}</chakra.span>
                        {` leaves your wallet now and is split between everyone staking ${stakedName}, by how much each stakes. It can't be taken back. You don't need to own ${stakedName} or ask its creator.`}
                    </Text>
                ) : (
                    <Text color="fg.muted">Pick the stakers, the prize and the amount to see what leaves your wallet.</Text>
                )}
            </OutcomePanel>
            <PayPanel rows={payRows} moduleFee={gift.mainFee} txKind={AIRDROP_TX_KIND} isLoading={feeLoading} feeUnknown={feeUnknown} />
        </>
    )

    return (
        <GuidedForm
            parent={returnTo ?? { href: '/rewards', label: 'Rewards' }}
            crumb={VOCABULARY.airdropToStakers.name}
            title={
                <>
                    Airdrop to <GradientText>stakers</GradientText>
                    <chakra.span display="inline-flex" verticalAlign="middle" ms="4px"><RewardKindsLink denom={denom || undefined} /></chakra.span>
                </>
            }
            subtitle="Split an amount between everyone staking a token, right now. Any token's stakers, yours or not."
            techTag={VOCABULARY.airdropToStakers.tech}
            aside={aside}
        >
            <Question
                title="Staked token"
                question="Which token's stakers?"
                {...steps.step('token')}
                summary={ticker && `${ticker} stakers`}
                action={{ label: 'Continue', onClick: () => answer('token'), disabled: !canPickToken }}
            >
                <StakedTokenStep
                    flow="airdrop"
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
                title="Prize & amount"
                question="What do they get?"
                {...steps.step('prize')}
                summary={giftText}
                onBack={steps.back}
                action={{
                    label: 'Continue',
                    onClick: () => answer('prize'),
                    disabled: !prizeAsset || slot.capReached || amountError !== '' || costs.escrow === undefined || short,
                }}
            >
                <VStack align="stretch" gap="16px">
                    <AssetPicker label="Prize token (paid from your wallet)" value={prizeDenom} onSelect={(asset) => setPrizeDenom(asset.denom)} />
                    {prizeAsset && (
                        <PrizeSlotNote stakedTicker={stakedName} prizeTicker={prizeTicker} slot={slot} max={gift.maxPrizes} prizeFee={gift.prizeFee} />
                    )}
                    {prizeAsset && (
                        <Field.Root invalid={amountTouched && amountInput.trim() !== '' && amountError !== ''}>
                            <HStack justify="space-between" w="full" gap="8px" flexWrap="wrap">
                                <Field.Label>{`Amount (${prizeTicker})`}</Field.Label>
                                <HStack gap="4px">
                                    <Text fontSize="12px" color="hg.text.faint" data-testid="airdrop-balance">{`of ${balanceText}`}</Text>
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
                            <Field.ErrorText>{amountError}</Field.ErrorText>
                        </Field.Root>
                    )}
                    {giftText && (
                        <Box fontSize="14px" data-testid="airdrop-sentence">
                            <Text>
                                <chakra.strong>{giftText}</chakra.strong>
                                {` is split right now between everyone staking ${stakedName}${stakedText ? ` (${stakedText} staked)` : ''}, pro rata.`}
                            </Text>
                            {short && (
                                <Text mt="6px" color="hg.danger.text" fontWeight="600" role="alert">
                                    {`Not enough ${prizeTicker}: you hold ${balanceText}.`}
                                </Text>
                            )}
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
                    moduleFee={gift.mainFee}
                    txKind={AIRDROP_TX_KIND}
                    isLoading={feeLoading}
                    feeUnknown={feeUnknown}
                    gets={[{ label: VOCABULARY.airdropToStakers.name, value: `${stakedName} stakers can claim it right away` }]}
                    extra={giftText ? [{ label: 'Split between', value: `Everyone staking ${stakedName}, pro rata` }] : []}
                    permanent={["An airdrop can't be undone"]}
                    submitLabel="Airdrop now"
                    onSubmit={() => void sign()}
                    disabled={!canSign}
                    onBack={steps.back}
                    blocker={nobodyStakes ? (
                        <Box data-testid="presign-blocker">
                            <BlockerNote lead="We check before you sign.">{nothingStakedReason(stakedName)}</BlockerNote>
                        </Box>
                    ) : undefined}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet to airdrop.</SubmitNote>
                    ) : lastCheck === 'error' ? (
                        <SubmitNote tone="error">{`Couldn't check ${stakedName}'s stakers right before signing. Please try again.`}</SubmitNote>
                    ) : isComplete && costs.escrow && !afford.isLoading && !afford.canAfford && afford.message && (
                        <SubmitNote tone="error">{afford.message}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function DenomRewardAirdropPage() {
    return (
        <FormPage>
            <AirdropFormContent />
        </FormPage>
    )
}
