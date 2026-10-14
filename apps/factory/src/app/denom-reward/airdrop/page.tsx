"use client"

import React, { Suspense, useMemo, useState } from 'react'
import { Box, Button, Container, Field, HStack, Input, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuTriangleAlert } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    amountToUAmount,
    getChainExplorerURL,
    getChainName,
    getCommunitiesApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useCanAffordTx,
    useCreationFees,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { Notice } from '@/components/manage/denom-reward-form-parts'
import { PrizeTokenQuestion } from '@/components/rewards/prize-token-question'
import { RewardInfoButton } from '@/components/rewards/reward-info-button'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    GuidedForm,
    OutcomePanel,
    PayPanel,
    PayRow,
    Question,
    SuccessPanel,
    useGuidedSteps,
    useReturnTo,
} from '@/components/guided'
import { VOCABULARY } from '@/lib/vocabulary'
import { airdropBlocker, denomRewardHref, prizeSlot, summarizeAirdropCosts } from '@/lib/denom-reward'

const { distributeDenomRewards } = bze.rewards.MessageComposer.withTypeUrl

const TX_KIND = 'distribute-denom-rewards'
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
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()

    const [prizeDenom, setPrizeDenom] = useState('')
    const [amountInput, setAmountInput] = useState('')
    const [amountTouched, setAmountTouched] = useState(false)
    const [answered, setAnswered] = useState<Step[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [doneTx, setDoneTx] = useState<{ txHash: string; giftLabel: string } | undefined>(undefined)

    const { asset: prizeAsset } = useAsset(prizeDenom)
    // The balance shown and the Max button: the whole balance, less the gas when the prize is the gas token.
    const spendable = useMaxSpendable(prizeDenom, TX_KIND)

    const amountError = prizeAsset ? validateAmount(amountInput, prizeAsset.decimals) : ''
    const uAmount = useMemo(() => {
        if (!prizeAsset || amountError !== '') return undefined
        return amountToUAmount(amountInput, prizeAsset.decimals)
    }, [prizeAsset, amountError, amountInput])

    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const slot = prizeSlot(prizes, prizeDenom, maxPrizes)
    const isNewPrize = Boolean(prizeDenom) && slot.isNewPrize
    const costs = summarizeAirdropCosts({ uAmount, prizeDenom, prizeFee: fees.createDenomRewardPrizeFee, isNewPrize })
    const blocker = denomReward
        ? airdropBlocker({ stakedAmount: denomReward.staked_amount, prizeDenom, slot, feesKnown: costs.feesKnown })
        : ''

    const mainFee = costs.feeTotals[0]
    const extraFees = costs.feeTotals.slice(1)
    const feePayment = useFeePayment(mainFee, TX_KIND)
    const afford = useCanAffordTx({
        spec: costs.escrow ? TX_KIND : undefined,
        spend: costs.escrow ? [costs.escrow, ...extraFees] : undefined,
        moduleFee: feePayment.estimate.resolvedFee,
    })

    const steps = useGuidedSteps<Step>(STEPS, {
        prize: answered.includes('prize') && Boolean(prizeAsset) && !slot.capReached,
        amount: answered.includes('amount') && amountError === '' && costs.escrow !== undefined,
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const allAnswered = STEPS.every(k => steps.state[k] === 'done')
    const feesReady = costs.feesKnown && (!mainFee || feePayment.canPayFee)
    const canConfirm = allAnswered && Boolean(address) && costs.escrow !== undefined && blocker === '' && feesReady &&
        !afford.isLoading && afford.canAfford

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
        if (!address || !canConfirm || !costs.escrow) return
        setIsSubmitting(true)
        try {
            await tx(
                [distributeDenomRewards({ creator: address, denom, prizeDenom, amount: costs.escrow.amount })],
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
            <VStack align="stretch" gap={4}>
                <Skeleton height="10" width="64" />
                <Skeleton height="64" />
            </VStack>
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
            <Notice title="No denom reward yet" onBack={back}>
                {stakingAsset?.ticker ?? 'This token'} has no denom reward. Create it from the token&apos;s
                denom reward page first.
            </Notice>
        )
    }

    if (doneTx) {
        return (
            <SuccessPanel
                title={`${doneTx.giftLabel} sent to ${stakingTicker} stakers`}
                text={`Everyone staking ${stakingTicker} got a share, split by stake.`}
                links={[
                    { label: 'View transaction', href: `${getChainExplorerURL()}/tx/${doneTx.txHash}` },
                    {
                        label: `See it on ${stakingPossessive} Communities page ↗`,
                        href: `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(denom)}`,
                    },
                ]}
                again={{ label: 'Airdrop again', onClick: reset }}
                primary={returnTo
                    ? { label: `Back to ${returnTo.label}`, href: returnTo.href }
                    : { label: `Back to ${holderRewardsLabel}`, href: holderRewardsHref }}
            />
        )
    }

    const slotInfo = maxPrizes !== undefined
        ? `The first time a token becomes a prize on ${stakingTicker} it takes one of ${stakingPossessive} ${maxPrizes} prize slots (${slot.used + 1} of ${maxPrizes} after this), for good. Gifting ${prizeTicker || 'it'} to ${stakingTicker} again is free.`
        : `The first time a token becomes a prize on ${stakingTicker} it takes one of ${stakingPossessive} prize slots, for good. Gifting ${prizeTicker || 'it'} to ${stakingTicker} again is free.`

    // A new prize with the cap reached gets no fee row: the blocker banner covers it.
    const feeRows: PayRow[] = !prizeDenom || (isNewPrize && slot.capReached)
        ? []
        : isNewPrize
            ? costs.fees.map(f => ({ label: 'New prize fee', coin: f.coin, info: slotInfo }))
            : [{ label: 'Prize fee', text: 'None', info: `${stakingTicker} already pays ${prizeTicker}, so only the network fee applies.` }]

    const payRows: PayRow[] = [
        ...(costs.escrow ? [{ label: 'The gift', coin: costs.escrow }] : []),
        ...feeRows,
        ...extraFees.map(c => ({ label: 'Also charged', coin: c })),
    ]

    const aside = (
        <>
            <OutcomePanel>
                {giftText ? (
                    <Text data-testid="airdrop-outcome">
                        <Text as="span" fontWeight="semibold">{giftText}</Text> leaves your wallet now and is split
                        between everyone staking {stakingTicker}, based on how much each one stakes. It can&apos;t be
                        taken back, and it doesn&apos;t start a daily prize. You don&apos;t need to own {stakingTicker} or
                        ask its creator.
                    </Text>
                ) : (
                    <Text color="fg.muted">Pick the prize and the amount to see what leaves your wallet.</Text>
                )}
            </OutcomePanel>

            <PayPanel
                rows={payRows}
                moduleFee={mainFee}
                txKind={TX_KIND}
                isLoading={isNewPrize && isFeeLoading}
                feeUnknown={isNewPrize && !slot.capReached && !isFeeLoading && !costs.feesKnown}
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
                    Airdrop now
                </Button>
                {!address ? (
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Connect your wallet to airdrop.
                    </Text>
                ) : costs.escrow && !afford.isLoading && !afford.canAfford && afford.message && (
                    <Text fontSize="sm" color="fg.error" textAlign="center" role="alert">{afford.message}</Text>
                )}
            </VStack>
        </>
    )

    return (
        <GuidedForm
            title={
                <HStack as="span" gap={1} display="inline-flex" align="center">
                    {`Gift ${stakingTicker} stakers, once`}
                    <RewardInfoButton denom={denom} />
                </HStack>
            }
            subtitle={`Split an amount between everyone staking ${stakingTicker} right now.`}
            techTag={VOCABULARY.airdropToStakers.tech}
            backHref={returnTo?.href ?? holderRewardsHref}
            backLabel={returnTo ? `Back to ${returnTo.label}` : `Back to ${holderRewardsLabel}`}
            aside={aside}
        >
            {blocker !== '' && (
                <HStack gap={2} p={3} borderRadius="lg" bg="red.500/10" color="red.600" align="start" role="alert" data-testid="airdrop-blocker">
                    <Box mt="0.5" flexShrink={0}><LuTriangleAlert size={16} /></Box>
                    <Text fontSize="sm">{blocker}</Text>
                </HStack>
            )}

            <Question
                number={1}
                title="What do you give?"
                state={steps.state.prize}
                summary={prizeTicker}
                onChange={() => steps.open('prize')}
            >
                <VStack align="stretch" gap={4}>
                    <PrizeTokenQuestion
                        denomReward={denomReward}
                        prizes={prizes}
                        maxPrizeDenoms={maxPrizes}
                        prizeFee={fees.createDenomRewardPrizeFee}
                        value={prizeDenom}
                        onSelect={(asset) => setPrizeDenom(asset.denom)}
                    />
                    <Button
                        alignSelf="start"
                        colorPalette="yellow"
                        size="sm"
                        disabled={!prizeAsset || slot.capReached}
                        onClick={() => answer('prize')}
                    >
                        Continue
                    </Button>
                </VStack>
            </Question>

            <Question
                number={2}
                title="How much?"
                state={steps.state.amount}
                summary={giftText}
                onChange={() => steps.open('amount')}
            >
                <VStack align="stretch" gap={4}>
                    {prizeAsset && (
                        <Field.Root invalid={amountTouched && amountInput.trim() !== '' && amountError !== ''}>
                            <HStack justify="space-between" w="full" gap={2} flexWrap="wrap">
                                <Field.Label>{`Amount (${prizeTicker})`}</Field.Label>
                                <HStack gap={1}>
                                    <Text fontSize="xs" color="fg.muted" data-testid="airdrop-balance">{balanceText}</Text>
                                    <Button
                                        size="2xs"
                                        variant="ghost"
                                        colorPalette="yellow"
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
                        <Text fontSize="sm" color="fg.muted" data-testid="airdrop-example">
                            {`Split by stake: someone with 1% of the staked ${stakingTicker} gets ${onePercentText}.`}
                        </Text>
                    )}
                    <Button
                        alignSelf="start"
                        colorPalette="yellow"
                        size="sm"
                        disabled={amountError !== '' || costs.escrow === undefined}
                        onClick={() => answer('amount')}
                    >
                        Continue
                    </Button>
                </VStack>
            </Question>
        </GuidedForm>
    )
}

export default function DenomRewardAirdropPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="5xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <AirdropFormContent />
                </Suspense>
            </Container>
        </Box>
    )
}
