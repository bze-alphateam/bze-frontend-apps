"use client"

import React, { Suspense, useMemo, useState } from 'react'
import { Box, Button, Card, Container, HStack, Separator, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuSend, LuTriangleAlert } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
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
import { FeeLine, Notice, TextField } from '@/components/manage/denom-reward-form-parts'
import { validateAmount } from '@/components/token-wizard/validation'
import { airdropBlocker, denomRewardHref, prizeSlot, summarizeAirdropCosts } from '@/lib/denom-reward'

const { distributeDenomRewards } = bze.rewards.MessageComposer.withTypeUrl

const TX_KIND = 'distribute-denom-rewards'

function AirdropFormContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const denom = denomParam ?? ''

    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const { asset: stakingAsset } = useAsset(denom)
    const { denomReward, prizes, isLoading, hasError } = useDenomReward(denom)
    const { fees, denomRewardLimits, isLoading: isFeeLoading } = useCreationFees()

    const [prizeDenom, setPrizeDenom] = useState('')
    const [amountInput, setAmountInput] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const { asset: prizeAsset } = useAsset(prizeDenom)
    const { balance: prizeBalance } = useBalance(prizeDenom)

    const amountError = prizeAsset ? validateAmount(amountInput, prizeAsset.decimals) : ''
    const uAmount = useMemo(() => {
        if (!prizeAsset || amountError !== '') return undefined
        return amountToUAmount(amountInput, prizeAsset.decimals)
    }, [prizeAsset, amountError, amountInput])

    const slot = prizeSlot(prizes, prizeDenom, denomRewardLimits.maxPrizeDenomsPerDr)
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

    const amountDisplay = costs.escrow && prizeAsset
        ? uAmountToBigNumberAmount(costs.escrow.amount, prizeAsset.decimals)
        : undefined

    const feesReady = costs.feesKnown && (!mainFee || feePayment.canPayFee)
    const canConfirm = Boolean(address) && costs.escrow !== undefined && blocker === '' && feesReady &&
        !afford.isLoading && afford.canAfford

    const back = () => navigate(denomRewardHref(denom))

    const submit = async () => {
        if (!address || !canConfirm || !costs.escrow) return
        setIsSubmitting(true)
        try {
            await tx(
                [distributeDenomRewards({ creator: address, denom, prizeDenom, amount: costs.escrow.amount })],
                { onSuccess: () => navigate(denomRewardHref(denom)) },
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!denom) {
        return <Notice title="No token selected" onBack={() => navigate('/denom-reward')}>Open this form from a token&apos;s denom reward.</Notice>
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
                denom reward page first.
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
                    <LuSend size={22} />
                </Box>
                <VStack align="start" gap={0}>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">Airdrop to stakers</Text>
                    <Text fontSize="sm" color="fg.muted">
                        Pay a one-off prize to everyone staking {stakingTicker}, right now.
                    </Text>
                </VStack>
            </HStack>

            <Card.Root variant="outline" p={{ base: 5, md: 6 }}>
                <VStack align="stretch" gap={5}>
                    {blocker !== '' && (
                        <HStack gap={2} p={3} borderRadius="lg" bg="red.500/10" color="red.600" align="start" data-testid="airdrop-blocker">
                            <Box mt="0.5"><LuTriangleAlert size={16} /></Box>
                            <Text fontSize="sm">{blocker}</Text>
                        </HStack>
                    )}

                    <AssetPicker
                        label="Prize token (paid from your wallet)"
                        value={prizeDenom}
                        onSelect={(asset) => setPrizeDenom(asset.denom)}
                    />

                    {prizeAsset && (
                        <>
                            <TextField
                                label={`Amount (${prizeTicker})`}
                                helper={`Balance: ${prettyAmount(uAmountToBigNumberAmount(prizeBalance.amount, prizeAsset.decimals))} ${prizeTicker}`}
                                error={amountError}
                                value={amountInput}
                                onChange={setAmountInput}
                                placeholder="e.g. 1000"
                            />

                            <Box p={5} borderWidth="2px" borderColor="orange.500/40" borderRadius="xl" bg="orange.500/10">
                                <VStack align="start" gap={1}>
                                    <Text fontSize="sm" fontWeight="medium" color="fg.muted">Leaves your wallet now</Text>
                                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight" data-testid="airdrop-amount">
                                        {amountDisplay ? `${prettyAmount(amountDisplay)} ${prizeTicker}` : `— ${prizeTicker}`}
                                    </Text>
                                    <Text fontSize="sm" color="fg.muted">
                                        {amountDisplay ? `${prettyAmount(amountDisplay)} ${prizeTicker}` : 'The amount'} leaves
                                        your wallet now and is split among the current stakers of {stakingTicker} pro
                                        rata to their stake; this cannot be undone. It is a one-off payment — it
                                        doesn&apos;t start a schedule.
                                    </Text>
                                    {address && amountDisplay && !afford.isLoading && !afford.canAfford && afford.message && (
                                        <Text fontSize="sm" color="red.500" fontWeight="medium">{afford.message}</Text>
                                    )}
                                </VStack>
                            </Box>
                        </>
                    )}

                    <Separator />

                    {isNewPrize && slot.capReached ? null : isNewPrize ? (
                        <VStack align="stretch" gap={2}>
                            <Text fontSize="xs" color="fg.muted">
                                {prizeTicker} is new to this denom reward, so the one-time prize token fee applies
                                {denomRewardLimits.maxPrizeDenomsPerDr !== undefined
                                    ? ` (it takes prize slot ${slot.used + 1} of ${denomRewardLimits.maxPrizeDenomsPerDr})`
                                    : ''}.
                            </Text>
                            <FeeDisclosure
                                fee={costs.feesKnown ? mainFee : undefined}
                                isLoading={isFeeLoading}
                                label="New prize token fee"
                                txKind={TX_KIND}
                            />
                            {extraFees.map(f => (
                                <FeeLine key={f.denom} label="Also charged" denom={f.denom} amount={f.amount} />
                            ))}
                        </VStack>
                    ) : (
                        <InfoBox title="No fee for this prize token">
                            {prizeDenom
                                ? `${prizeTicker} already pays this denom reward, so only the network fee applies.`
                                : 'A prize token the denom reward already pays costs only the network fee; a new one pays the one-time prize token fee.'}
                        </InfoBox>
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
                            Airdrop now
                        </Button>
                        {!address && (
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Connect your wallet to airdrop.
                            </Text>
                        )}
                    </VStack>
                </VStack>
            </Card.Root>
        </VStack>
    )
}

export default function DenomRewardAirdropPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="2xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <AirdropFormContent />
                </Suspense>
            </Container>
        </Box>
    )
}
