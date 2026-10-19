"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Field, HStack, Input, Text, VStack, chakra } from '@chakra-ui/react'
import {
    GradientText,
    Shimmer,
    amountToUAmount,
    getExplorerTxURL,
    getChainName,
    getCommunitiesApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AIRDROP_TX_KIND, airdropPayRows, useAirdropGift } from '@/hooks/useAirdropGift'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { Notice } from '@/components/manage/denom-reward-form-parts'
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
import { denomRewardHref } from '@/lib/denom-reward'

const STEPS = ['prize', 'amount'] as const
type Step = typeof STEPS[number]

function AirdropFormContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const denom = denomParam ?? ''

    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { asset: stakingAsset } = useAsset(denom)
    const { denomReward, prizes, isLoading, hasError } = useDenomReward(denom)

    const [prizeDenom, setPrizeDenom] = useState('')
    const [amountInput, setAmountInput] = useState('')
    const [amountTouched, setAmountTouched] = useState(false)
    const [answered, setAnswered] = useState<Step[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [doneTx, setDoneTx] = useState<{ txHash: string; giftLabel: string } | undefined>(undefined)

    const { asset: prizeAsset } = useAsset(prizeDenom)
    // The balance shown and the Max button: the whole balance, less the gas when the prize is the gas token.
    const spendable = useMaxSpendable(prizeDenom, AIRDROP_TX_KIND)

    const amountError = prizeAsset ? validateAmount(amountInput, prizeAsset.decimals) : ''
    const uAmount = useMemo(() => {
        if (!prizeAsset || amountError !== '') return undefined
        return amountToUAmount(amountInput, prizeAsset.decimals)
    }, [prizeAsset, amountError, amountInput])

    const gift = useAirdropGift({ denom, stakedAmount: denomReward?.staked_amount, prizes, prizeDenom, uAmount })
    const { slot, isNewPrize, costs, blocker, afford } = gift

    const steps = useGuidedSteps<Step>(STEPS, {
        prize: answered.includes('prize') && Boolean(prizeAsset) && !slot.capReached,
        amount: answered.includes('amount') && amountError === '' && costs.escrow !== undefined,
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const allAnswered = STEPS.every(k => steps.state[k] === 'done')
    const canConfirm = allAnswered && Boolean(address) && gift.canSign

    // Until the asset list loads, plain words stand in for the tickers: a raw factory denom is
    // one long unbreakable word that would push the page wider than a phone.
    const stakingTicker = stakingAsset?.ticker ?? 'the token'
    const stakingPossessive = stakingAsset ? `${stakingAsset.ticker}'s` : "the token's"
    const prizeTicker = prizeAsset?.ticker ?? ''
    const amountDisplay = costs.escrow && prizeAsset
        ? uAmountToBigNumberAmount(costs.escrow.amount, prizeAsset.decimals)
        : undefined
    const giftText = amountDisplay ? `${prettyAmount(amountDisplay)} ${prizeTicker}` : ''
    const onePercentText = amountDisplay ? `${prettyAmount(amountDisplay.multipliedBy(0.01))} ${prizeTicker}` : ''
    const balanceText = prizeAsset
        ? `of ${prettyAmount(uAmountToBigNumberAmount(spendable.balance, prizeAsset.decimals))} ${prizeTicker}`
        : ''

    const holderRewardsHref = denomRewardHref(denom)
    const holderRewardsLabel = `${stakingPossessive} holder rewards`
    const back = () => navigate(returnTo?.href ?? holderRewardsHref)

    const reset = () => {
        setDoneTx(undefined)
        setAmountInput('')
        setAmountTouched(false)
        setAnswered([])
        steps.open('prize')
    }

    const submit = async () => {
        const msg = address && canConfirm ? gift.message(address) : undefined
        if (!msg) return
        setIsSubmitting(true)
        try {
            await tx(
                [msg],
                { onSuccess: (res) => setDoneTx({ txHash: res.txhash, giftLabel: giftText }) },
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!denom) {
        return <Notice title="No token selected" onBack={() => navigate(returnTo?.href ?? '/rewards')}>Open this form from a token&apos;s holder rewards.</Notice>
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
                {`${stakingAsset?.ticker ?? 'This token'} has no holder rewards. Make it stakable first.`}
            </Notice>
        )
    }

    if (doneTx) {
        return (
            <SuccessPanel
                title={`${doneTx.giftLabel} sent to ${stakingTicker} stakers`}
                text={`Everyone staking ${stakingTicker} got a share, split by stake.`}
                links={[
                    { label: 'Explorer', href: getExplorerTxURL(doneTx.txHash), app: 'explorer' },
                    {
                        label: 'Communities',
                        href: `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(denom)}`,
                        app: 'communities',
                    },
                ]}
                again={{ label: 'Airdrop again', onClick: reset }}
                primary={returnTo
                    ? { label: `Back to ${returnTo.label}`, href: returnTo.href }
                    : { label: `Back to ${holderRewardsLabel}`, href: holderRewardsHref }}
            />
        )
    }

    const aside = (
        <>
            <OutcomePanel>
                {giftText ? (
                    <Text data-testid="airdrop-outcome">
                        <Text as="span" fontWeight="600">{giftText}</Text> leaves your wallet now and is split
                        between everyone staking {stakingTicker}, based on how much each one stakes. It can&apos;t be
                        taken back, and it doesn&apos;t start a daily prize. You don&apos;t need to own {stakingTicker} or
                        ask its creator.
                    </Text>
                ) : (
                    <Text color="fg.muted">Pick the prize and the amount to see what leaves your wallet.</Text>
                )}
            </OutcomePanel>

            <PayPanel
                rows={airdropPayRows(gift, { prizeDenom, stakingTicker, stakingPossessive, prizeTicker })}
                moduleFee={gift.mainFee}
                txKind={AIRDROP_TX_KIND}
                isLoading={isNewPrize && gift.isFeeLoading}
                feeUnknown={isNewPrize && !slot.capReached && !gift.isFeeLoading && !costs.feesKnown}
            />

            <SubmitBlock label="Airdrop now" onClick={submit} disabled={!canConfirm} loading={isSubmitting}>
                {!address ? (
                    <SubmitNote>Connect your wallet to airdrop.</SubmitNote>
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
                    {`Gift ${stakingTicker} stakers, `}<GradientText>once</GradientText>
                    <chakra.span display="inline-flex" verticalAlign="middle" ms="4px"><RewardInfoButton denom={denom} /></chakra.span>
                </>
            }
            subtitle={`Split an amount between everyone staking ${stakingTicker} right now.`}
            techTag={VOCABULARY.airdropToStakers.tech}
            backHref={returnTo?.href ?? holderRewardsHref}
            backLabel={returnTo ? `Back to ${returnTo.label}` : `Back to ${holderRewardsLabel}`}
            aside={aside}
        >
            {blocker !== '' && (
                <Box data-testid="airdrop-blocker">
                    <BlockerNote>{blocker}</BlockerNote>
                </Box>
            )}

            <Question
                number={1}
                title="What do you give?"
                state={steps.state.prize}
                summary={prizeTicker}
                onChange={() => steps.open('prize')}
            >
                <VStack align="stretch" gap="16px">
                    <PrizeTokenQuestion
                        denomReward={denomReward}
                        prizes={prizes}
                        maxPrizeDenoms={gift.maxPrizes}
                        prizeFee={gift.prizeFee}
                        value={prizeDenom}
                        onSelect={(asset) => setPrizeDenom(asset.denom)}
                    />
                    <ContinueRow disabled={!prizeAsset || slot.capReached} onContinue={() => answer('prize')} />
                </VStack>
            </Question>

            <Question
                number={2}
                title="How much?"
                state={steps.state.amount}
                summary={giftText}
                onChange={() => steps.open('amount')}
            >
                <VStack align="stretch" gap="16px">
                    {prizeAsset && (
                        <Field.Root invalid={amountTouched && amountInput.trim() !== '' && amountError !== ''}>
                            <HStack justify="space-between" w="full" gap="8px" flexWrap="wrap">
                                <Field.Label>{`Amount (${prizeTicker})`}</Field.Label>
                                <HStack gap="4px">
                                    <Text fontSize="12px" color="hg.text.faint" data-testid="airdrop-balance">{balanceText}</Text>
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
                    {onePercentText && (
                        <Text fontSize="13px" lineHeight="1.5" color="hg.text.faint" data-testid="airdrop-example">
                            {`Split by stake: someone with 1% of the staked ${stakingTicker} gets ${onePercentText}.`}
                        </Text>
                    )}
                    <ContinueRow disabled={amountError !== '' || costs.escrow === undefined} onContinue={() => answer('amount')} />
                </VStack>
            </Question>
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
