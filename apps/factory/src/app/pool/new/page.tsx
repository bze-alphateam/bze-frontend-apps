"use client"

import React, { Suspense, useMemo, useState } from 'react'
import { Box, Button, Container, Field, HStack, Input, Skeleton, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuGift } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    amountToUAmount,
    createPoolId,
    getChainExplorerURL,
    getChainName,
    getDexApp,
    getLiquidityPool,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetPrice,
    useBalance,
    useCreationFees,
    useLiquidityPools,
    useMaxSpendable,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { haltedPairError } from '@/lib/halted'
import { useFeePayment } from '@/hooks/useFeePayment'
import {
    DEFAULT_FEE_SPLIT,
    FeeSplit,
    FeeSplitSlider,
    feeSplitToFeeDest,
} from '@/components/pool-form/fee-split-slider'
import { validateAmount } from '@/components/token-wizard/validation'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import {
    GuidedForm,
    OutcomePanel,
    PayPanel,
    Question,
    SuccessPanel,
    TipNote,
    WarningNote,
    useGuidedSteps,
    useReturnTo,
    withReturn,
} from '@/components/guided'
import {
    DEFAULT_SWAP_FEE_PCT,
    SWAP_FEE_PRESETS,
    maxReserveAmount,
    sortPairForChain,
    swapFeeSummary,
    swapFeeToChain,
    validateSwapFee,
} from '@/lib/pool-new'

const { createLiquidityPool } = bze.tradebin.MessageComposer.withTypeUrl

const STEPS = ['pair', 'deposit', 'fee'] as const
type Step = typeof STEPS[number]

const TX_KIND = 'create-pool'

function ReserveField({
    label,
    denom,
    amount,
    onChange,
    fee,
}: {
    label: string;
    denom: string;
    amount: string;
    onChange: (value: string) => void;
    /** The creation fee: Max leaves it when this reserve is in the fee denom. */
    fee?: { denom: string; amount: string };
}) {
    const { asset } = useAsset(denom)
    const { balance } = useBalance(denom)
    const max = useMaxSpendable(denom, TX_KIND)
    const [touched, setTouched] = useState(false)

    const error = useMemo(() => {
        if (!asset) return ''
        const base = validateAmount(amount, asset.decimals)
        if (base) return base
        if (balance.amount.lt(amountToUAmount(amount, asset.decimals))) {
            return 'Amount exceeds your balance.'
        }
        return ''
    }, [amount, asset, balance])

    if (!asset) return null

    const fillMax = () => {
        const micro = maxReserveAmount(max.amount, denom, fee)
        onChange(uAmountToBigNumberAmount(micro, asset.decimals).toFixed())
        setTouched(true)
    }

    return (
        <Field.Root invalid={touched && error !== ''}>
            <Field.Label>{label} ({asset.ticker})</Field.Label>
            <HStack gap={2} w="full">
                <Input
                    placeholder="e.g. 1000"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setTouched(true)}
                />
                <Button
                    size="sm"
                    variant="outline"
                    colorPalette="yellow"
                    flexShrink={0}
                    aria-label={`Max ${asset.ticker}`}
                    disabled={max.isLoading}
                    onClick={fillMax}
                >
                    Max
                </Button>
            </HStack>
            <Field.HelperText>
                of {prettyAmount(uAmountToBigNumberAmount(balance.amount, asset.decimals))} {asset.ticker}
            </Field.HelperText>
            <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
    )
}

function OutcomeRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <HStack justify="space-between" align="start" gap={3}>
            <Text color="fg.muted">{label}</Text>
            <Text fontWeight="semibold" textAlign="right" minW={0} wordBreak="break-word">{value}</Text>
        </HStack>
    )
}

function PoolNewContent() {
    const { getQueryParam, navigate } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const { address } = useChain(getChainName())
    const { getDenomsPool, updateLiquidityPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { fees, isLoading: isFeeLoading } = useCreationFees()
    const { tx } = useFactoryTx()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [created, setCreated] = useState<{ txHash: string; poolId: string; lpDenom?: string } | undefined>(undefined)

    const [baseDenom, setBaseDenom] = useState(() => getQueryParam('base') ?? '')
    const [quoteDenom, setQuoteDenom] = useState(() => getQueryParam('quote') ?? '')
    const [baseAmount, setBaseAmount] = useState('')
    const [quoteAmount, setQuoteAmount] = useState('')
    const [swapFee, setSwapFee] = useState(DEFAULT_SWAP_FEE_PCT)
    const [feeSplit, setFeeSplit] = useState<FeeSplit>(DEFAULT_FEE_SPLIT)
    // A deep link with both sides lands on question 2 (the pair still has to be valid).
    const [answered, setAnswered] = useState<Step[]>(() =>
        getQueryParam('base') && getQueryParam('quote') ? ['pair'] : [])

    const { asset: baseAsset } = useAsset(baseDenom)
    const { asset: quoteAsset } = useAsset(quoteDenom)
    const { balance: baseBalance } = useBalance(baseDenom)
    const { balance: quoteBalance } = useBalance(quoteDenom)
    const quotePrice = useAssetPrice(quoteDenom)

    const fee = fees.createMarketFee
    const { asset: feeAsset } = useAsset(fee?.denom ?? '')
    const { balance: feeBalance, isLoading: isFeeBalanceLoading } = useBalance(fee?.denom ?? '')
    const feePayment = useFeePayment(fee, TX_KIND)

    const baseTicker = baseAsset?.ticker ?? ''
    const quoteTicker = quoteAsset?.ticker ?? ''

    // The chain stores pairs alphabetically and swaps the amounts to match.
    const isCanonicalOrder = !baseDenom || !quoteDenom || baseDenom < quoteDenom
    const canonicalPairLabel = baseAsset && quoteAsset
        ? (isCanonicalOrder ? `${baseTicker}/${quoteTicker}` : `${quoteTicker}/${baseTicker}`)
        : ''

    const pairError = useMemo((): { message: string; existingPoolId?: string } | undefined => {
        if (!baseDenom || !quoteDenom) return undefined
        if (baseDenom === quoteDenom) return { message: 'Base and quote must be different assets.' }
        const halted = haltedPairError(baseAsset, quoteAsset)
        if (halted !== '') return { message: halted }
        const existing = getDenomsPool(baseDenom, quoteDenom)
        if (existing) {
            return {
                message: 'A pool for this pair already exists — add liquidity to it instead of creating a new one.',
                existingPoolId: existing.id,
            }
        }
        return undefined
    }, [baseDenom, quoteDenom, getDenomsPool, baseAsset, quoteAsset])

    const isPairValid = Boolean(baseAsset) && Boolean(quoteAsset) && pairError === undefined

    const amountsValid = useMemo(() => {
        if (!baseAsset || !quoteAsset) return false
        if (validateAmount(baseAmount, baseAsset.decimals) !== '') return false
        if (validateAmount(quoteAmount, quoteAsset.decimals) !== '') return false
        if (baseBalance.amount.lt(amountToUAmount(baseAmount, baseAsset.decimals))) return false
        if (quoteBalance.amount.lt(amountToUAmount(quoteAmount, quoteAsset.decimals))) return false
        return true
    }, [baseAsset, quoteAsset, baseAmount, quoteAmount, baseBalance, quoteBalance])

    const impliedPrice = useMemo(() => {
        if (!amountsValid) return undefined
        return new BigNumber(quoteAmount).div(baseAmount)
    }, [amountsValid, baseAmount, quoteAmount])
    const impliedUsd = impliedPrice && quotePrice.hasPrice ? quotePrice.totalUsdValue(impliedPrice) : undefined

    const swapFeeError = validateSwapFee(swapFee)

    const steps = useGuidedSteps(STEPS, {
        pair: answered.includes('pair') && isPairValid,
        deposit: answered.includes('deposit') && amountsValid,
        fee: answered.includes('fee') && swapFeeError === '',
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    // The creation fee comes on top of the reserves: when a reserve IS the fee denom,
    // the wallet must cover reserve + fee together.
    const feeDenomReserve = useMemo(() => {
        if (!fee) return new BigNumber(0)
        let total = new BigNumber(0)
        if (baseAsset && baseDenom === fee.denom && validateAmount(baseAmount, baseAsset.decimals) === '') {
            total = total.plus(amountToUAmount(baseAmount, baseAsset.decimals))
        }
        if (quoteAsset && quoteDenom === fee.denom && validateAmount(quoteAmount, quoteAsset.decimals) === '') {
            total = total.plus(amountToUAmount(quoteAmount, quoteAsset.decimals))
        }
        return total
    }, [fee, baseAsset, quoteAsset, baseDenom, quoteDenom, baseAmount, quoteAmount])

    const hasEnoughForFee = useMemo(() => {
        if (!fee) return false
        let needed = new BigNumber(fee.amount).plus(feeDenomReserve)
        // The gas fee is deducted first, from the same balance when it is paid in the fee denom.
        if (feePayment.gasFee.denom === fee.denom) {
            needed = needed.plus(feePayment.gasFee.amount)
        }
        return feeBalance.amount.gte(needed)
    }, [fee, feeBalance, feeDenomReserve, feePayment.gasFee.denom, feePayment.gasFee.amount])

    // Paying the fee in the Settings fee token keeps the native balance for the
    // reserves, so either path unlocks the form.
    const canPayFee = hasEnoughForFee || feePayment.paysWithAlt

    const isComplete = STEPS.every(k => steps.state[k] === 'done')
    const canConfirm = isComplete && Boolean(address) && Boolean(fee) &&
        !isFeeBalanceLoading && canPayFee && !isPoolsLoading

    const submit = async () => {
        if (!address || !canConfirm || !baseAsset || !quoteAsset) return

        const sorted = sortPairForChain(
            baseDenom,
            quoteDenom,
            amountToUAmount(baseAmount, baseAsset.decimals),
            amountToUAmount(quoteAmount, quoteAsset.decimals),
        )
        const poolId = createPoolId(sorted.base, sorted.quote)

        const msg = createLiquidityPool({
            creator: address,
            ...sorted,
            fee: swapFeeToChain(swapFee),
            feeDest: feeSplitToFeeDest(feeSplit),
            stable: false,
        })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: (res) => {
                    setCreated({ txHash: res.txhash, poolId })
                    void updateLiquidityPools()
                    // The LP denom format depends on the chain version (legacy
                    // ulp_<base>_<quote> vs hashed ulp/<hash>): read it from the
                    // stored pool instead of deriving it client-side.
                    getLiquidityPool(poolId).then(pool => {
                        if (pool?.lp_denom) {
                            setCreated({ txHash: res.txhash, poolId, lpDenom: pool.lp_denom })
                        }
                    })
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const createAnother = () => {
        setCreated(undefined)
        setBaseDenom('')
        setQuoteDenom('')
        setBaseAmount('')
        setQuoteAmount('')
        setSwapFee(DEFAULT_SWAP_FEE_PCT)
        setFeeSplit(DEFAULT_FEE_SPLIT)
        setAnswered([])
        steps.close()
    }

    if (created) {
        const poolUrl = `${getDexApp().href}/pools/details?id=${encodeURIComponent(created.poolId)}`
        // The LP denom arrives async from the stored pool: rewarding its holders stays
        // disabled until it resolves.
        const rewardHref = created.lpDenom
            ? withReturn(`/reward/new?staking=${encodeURIComponent(created.lpDenom)}`, returnTo)
            : '/reward/new'
        return (
            <SuccessPanel
                title={`The ${canonicalPairLabel} pool is live!`}
                text="Swaps can start right away. Your first deposit is the pool's permanent floor."
                code={{ label: 'Your LP token', value: created.lpDenom }}
                links={[
                    { label: 'View pool on DEX', href: poolUrl },
                    { label: 'View transaction', href: `${getChainExplorerURL()}/tx/${created.txHash}` },
                ]}
                next={[{ label: 'Reward liquidity providers', href: rewardHref, icon: <LuGift />, disabled: !created.lpDenom }]}
                again={{ label: 'Create another pool', onClick: createAnother }}
            />
        )
    }

    const pairSummary = baseTicker && quoteTicker ? `${baseTicker} / ${quoteTicker}` : ''
    const priceText = impliedPrice ? prettyAmount(impliedPrice) : ''
    const depositSummary = impliedPrice
        ? `${prettyAmount(new BigNumber(baseAmount))} ${baseTicker} + ${prettyAmount(new BigNumber(quoteAmount))} ${quoteTicker} · 1 ${baseTicker} = ${priceText} ${quoteTicker}`
        : ''

    const feeTicker = feeAsset?.ticker ?? fee?.denom ?? ''
    const totalInFeeDenom = fee && feeDenomReserve.gt(0)
        ? prettyAmount(uAmountToBigNumberAmount(new BigNumber(fee.amount).plus(feeDenomReserve), feeAsset?.decimals ?? 6))
        : undefined

    const aside = (
        <>
            <OutcomePanel>
                <VStack align="stretch" gap={2} aria-label="Your pool" role="group">
                    <Text fontWeight="semibold">Your pool</Text>
                    <OutcomeRow label="Pair" value={canonicalPairLabel || '—'} />
                    <OutcomeRow
                        label="Deposit"
                        value={impliedPrice
                            ? `${prettyAmount(new BigNumber(baseAmount))} ${baseTicker} + ${prettyAmount(new BigNumber(quoteAmount))} ${quoteTicker}`
                            : '—'}
                    />
                    <OutcomeRow
                        label="Starting price"
                        value={impliedPrice ? `1 ${baseTicker} = ${priceText} ${quoteTicker}` : '—'}
                    />
                    <OutcomeRow label="Swap fee" value={swapFeeError === '' ? `${swapFee.trim()}%` : '—'} />
                    <Text fontSize="xs" color="fg.muted">
                        {canonicalPairLabel || 'Your pair'} opens for swaps. Your deposit becomes its permanent floor.
                    </Text>
                </VStack>
            </OutcomePanel>

            <PayPanel
                rows={[{ label: 'Pool creation fee', coin: fee }]}
                moduleFee={fee}
                txKind={TX_KIND}
                isLoading={isFeeLoading}
                feeUnknown={!fee}
                footer={totalInFeeDenom && (
                    <Text color="fg.muted">
                        {feeTicker} needed in total: <Text as="span" fontWeight="semibold" color="fg">{totalInFeeDenom} {feeTicker}</Text>
                        {' '}(your deposit + the creation fee)
                    </Text>
                )}
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
                    Create pool
                </Button>
                {!address ? (
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Connect your wallet to create this pool.
                    </Text>
                ) : isComplete && !isFeeBalanceLoading && !canPayFee && (
                    <Text fontSize="sm" color="fg.error" textAlign="center">
                        Not enough balance to cover the creation fee on top of the reserves.
                    </Text>
                )}
            </VStack>
        </>
    )

    return (
        <GuidedForm
            title={`Let people buy and sell ${baseTicker || 'your token'}`}
            subtitle="Pair it with another token. What you put in sets the starting price."
            techTag="tradebin · liquidity pool"
            aside={aside}
        >
            <Question
                number={1}
                title="Which pair?"
                state={steps.state.pair}
                summary={pairSummary}
                onChange={() => steps.open('pair')}
            >
                <VStack align="stretch" gap={4}>
                    <AssetPicker
                        label="Your token"
                        value={baseDenom}
                        excludeDenoms={quoteDenom ? [quoteDenom] : undefined}
                        excludeHalted
                        onSelect={(asset) => setBaseDenom(asset.denom)}
                    />
                    <AssetPicker
                        label="Paired with"
                        value={quoteDenom}
                        excludeDenoms={baseDenom ? [baseDenom] : undefined}
                        excludeHalted
                        ownFirst={false}
                        onSelect={(asset) => setQuoteDenom(asset.denom)}
                    />

                    {pairError && (
                        <Box role="alert">
                            <Text fontSize="sm" color="fg.error" fontWeight="medium">
                                {pairError.message}
                            </Text>
                            {pairError.existingPoolId && (
                                <Button
                                    mt={2}
                                    size="sm"
                                    variant="outline"
                                    colorPalette="yellow"
                                    onClick={() => navigate(withReturn(
                                        `/pool/add?pool=${encodeURIComponent(pairError.existingPoolId as string)}`,
                                        returnTo,
                                    ))}
                                >
                                    Add liquidity to it
                                </Button>
                            )}
                        </Box>
                    )}

                    {canonicalPairLabel && !pairError && (
                        <Text fontSize="sm" color="fg.muted">
                            Stored on-chain as <Text as="span" fontWeight="semibold">{canonicalPairLabel}</Text>
                            {!isCanonicalOrder && ' — the chain orders every pair alphabetically.'}
                        </Text>
                    )}

                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!isPairValid} onClick={() => answer('pair')}>
                        Continue
                    </Button>
                </VStack>
            </Question>

            <Question
                number={2}
                title="How much to put in?"
                state={steps.state.deposit}
                summary={depositSummary}
                onChange={() => steps.open('deposit')}
            >
                <VStack align="stretch" gap={4}>
                    <Text fontSize="sm" color="fg.muted">
                        The ratio of the two amounts sets {baseTicker || 'your token'}&apos;s starting price.
                    </Text>
                    <ReserveField label="Your token" denom={baseDenom} amount={baseAmount} onChange={setBaseAmount} fee={fee} />
                    <ReserveField label="Paired with" denom={quoteDenom} amount={quoteAmount} onChange={setQuoteAmount} fee={fee} />

                    {impliedPrice && (
                        <Text fontSize="sm" color="fg.muted">
                            Starting price <Text as="span" fontWeight="semibold" color="fg">
                                1 {baseTicker} = {priceText} {quoteTicker}
                            </Text>
                            {impliedUsd && <> ≈ ${prettyAmount(impliedUsd)}</>}
                        </Text>
                    )}

                    <WarningNote lead="This first deposit stays in the pool for good.">
                        It is the pool&apos;s permanent floor: nobody can withdraw it, you included. You get no LP
                        tokens for it. To add liquidity you can take back later, use Add liquidity after the pool exists.
                    </WarningNote>

                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!amountsValid} onClick={() => answer('deposit')}>
                        Continue
                    </Button>
                </VStack>
            </Question>

            <Question
                number={3}
                title="Swap fee and where it goes"
                state={steps.state.fee}
                summary={swapFeeSummary(swapFee, feeSplit)}
                onChange={() => steps.open('fee')}
            >
                <VStack align="stretch" gap={4}>
                    <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" fontWeight="medium">Swap fee, charged on every swap</Text>
                        <HStack gap={2} flexWrap="wrap">
                            {SWAP_FEE_PRESETS.map(preset => (
                                <Button
                                    key={preset}
                                    size="xs"
                                    borderRadius="full"
                                    variant={swapFee === preset ? 'solid' : 'outline'}
                                    colorPalette="yellow"
                                    onClick={() => setSwapFee(preset)}
                                >
                                    {preset}%
                                </Button>
                            ))}
                            <Field.Root invalid={swapFeeError !== ''} maxW="28">
                                <Input
                                    size="xs"
                                    inputMode="decimal"
                                    aria-label="Custom swap fee (%)"
                                    value={swapFee}
                                    onChange={(e) => setSwapFee(e.target.value)}
                                />
                            </Field.Root>
                        </HStack>
                        {swapFeeError !== '' && (
                            <Text fontSize="sm" color="fg.error">{swapFeeError}</Text>
                        )}
                    </VStack>

                    <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" fontWeight="medium">Where the fees go</Text>
                        <FeeSplitSlider value={feeSplit} onChange={setFeeSplit} />
                    </VStack>

                    <TipNote lead="No market needed.">
                        The pair gets exactly one pool. The fee and where it goes are fixed at creation.
                    </TipNote>

                    <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={swapFeeError !== ''} onClick={() => answer('fee')}>
                        Continue
                    </Button>
                </VStack>
            </Question>
        </GuidedForm>
    )
}

export default function PoolNewPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="5xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <PoolNewContent />
                </Suspense>
            </Container>
        </Box>
    )
}
