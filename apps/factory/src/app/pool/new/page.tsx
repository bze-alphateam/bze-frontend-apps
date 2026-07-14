"use client"

import React, { Suspense, useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Container,
    Field,
    HStack,
    Input,
    Separator,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import {
    LuArrowLeft,
    LuArrowUpRight,
    LuCircleCheck,
    LuCopy,
    LuDroplets,
    LuGift,
    LuPlus,
} from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    amountToUAmount,
    createPoolId,
    getChainExplorerURL,
    getChainName,
    getEcosystemApps,
    getLiquidityPool,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCreationFees,
    useLiquidityPools,
    useToast,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { FeeDisclosure } from '@/components/ui/fee-disclosure'
import { InfoBox } from '@/components/ui/info-box'
import { useFeePayment } from '@/hooks/useFeePayment'
import {
    DEFAULT_FEE_SPLIT,
    FeeSplit,
    FeeSplitSlider,
    feeSplitToFeeDest,
} from '@/components/pool-form/fee-split-slider'
import { validateAmount } from '@/components/token-wizard/validation'
import { useNavigationWithParams } from '@/hooks/useNavigation'

const { createLiquidityPool } = bze.tradebin.MessageComposer.withTypeUrl

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

// Chain range is 0.001–0.05; the UI speaks percent (0.1%–5%).
const MIN_SWAP_FEE_PCT = 0.1
const MAX_SWAP_FEE_PCT = 5
const DEFAULT_SWAP_FEE_PCT = '0.2'
const SWAP_FEE_PRESETS = ['0.1', '0.2', '0.3', '1']

function validateSwapFee(fee: string): string {
    const trimmed = fee.trim()
    if (!trimmed) return 'Swap fee is required.'
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'Enter a valid percentage.'
    const value = Number(trimmed)
    if (value < MIN_SWAP_FEE_PCT || value > MAX_SWAP_FEE_PCT) {
        return `Swap fee must be between ${MIN_SWAP_FEE_PCT}% and ${MAX_SWAP_FEE_PCT}%.`
    }
    if ((trimmed.split('.')[1]?.length ?? 0) > 2) {
        return 'At most 2 decimal places.'
    }
    return ''
}

function ReserveField({
    label,
    denom,
    amount,
    onChange,
}: {
    label: string;
    denom: string;
    amount: string;
    onChange: (value: string) => void;
}) {
    const { asset } = useAsset(denom)
    const { balance } = useBalance(denom)
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

    return (
        <Field.Root invalid={touched && error !== ''}>
            <Field.Label>{label} ({asset.ticker})</Field.Label>
            <Input
                placeholder="e.g. 1000"
                inputMode="decimal"
                value={amount}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setTouched(true)}
            />
            <Field.HelperText>
                Balance: {prettyAmount(uAmountToBigNumberAmount(balance.amount, asset.decimals))} {asset.ticker}
            </Field.HelperText>
            <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
    )
}

function PoolNewContent() {
    const { getQueryParam, navigate } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { getDenomsPool, updateLiquidityPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { fees, isLoading: isFeeLoading } = useCreationFees()
    const { tx } = useFactoryTx()
    const { toast } = useToast()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [created, setCreated] = useState<{ txHash: string; poolId: string; lpDenom?: string } | undefined>(undefined)

    const [baseDenom, setBaseDenom] = useState(() => getQueryParam('base') ?? '')
    const [quoteDenom, setQuoteDenom] = useState(() => getQueryParam('quote') ?? '')
    const [baseAmount, setBaseAmount] = useState('')
    const [quoteAmount, setQuoteAmount] = useState('')
    const [swapFee, setSwapFee] = useState(DEFAULT_SWAP_FEE_PCT)
    const [feeSplit, setFeeSplit] = useState<FeeSplit>(DEFAULT_FEE_SPLIT)

    const { asset: baseAsset } = useAsset(baseDenom)
    const { asset: quoteAsset } = useAsset(quoteDenom)
    const { balance: baseBalance } = useBalance(baseDenom)
    const { balance: quoteBalance } = useBalance(quoteDenom)

    const fee = fees.createMarketFee
    const { balance: feeBalance, isLoading: isFeeBalanceLoading } = useBalance(fee?.denom ?? '')
    const feePayment = useFeePayment(fee)

    // The chain stores pairs alphabetically and swaps the amounts to match.
    const isCanonicalOrder = !baseDenom || !quoteDenom || baseDenom < quoteDenom
    const canonicalPairLabel = baseAsset && quoteAsset
        ? (isCanonicalOrder
            ? `${baseAsset.ticker}/${quoteAsset.ticker}`
            : `${quoteAsset.ticker}/${baseAsset.ticker}`)
        : ''

    const pairError = useMemo(() => {
        if (!baseDenom || !quoteDenom) return ''
        if (baseDenom === quoteDenom) return 'Base and quote must be different assets.'
        if (getDenomsPool(baseDenom, quoteDenom)) {
            return 'A pool for this pair already exists — add liquidity to it instead of creating a new one.'
        }
        return ''
    }, [baseDenom, quoteDenom, getDenomsPool])

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

    const swapFeeError = validateSwapFee(swapFee)

    // The creation fee comes on top of the reserves — when one of the reserves
    // IS the fee denom, the wallet must cover reserve + fee together.
    const hasEnoughForFee = useMemo(() => {
        if (!fee) return false
        let needed = new BigNumber(fee.amount)
        if (baseAsset && baseDenom === fee.denom && validateAmount(baseAmount, baseAsset.decimals) === '') {
            needed = needed.plus(amountToUAmount(baseAmount, baseAsset.decimals))
        }
        if (quoteAsset && quoteDenom === fee.denom && validateAmount(quoteAmount, quoteAsset.decimals) === '') {
            needed = needed.plus(amountToUAmount(quoteAmount, quoteAsset.decimals))
        }
        return feeBalance.amount.gte(needed)
    }, [fee, feeBalance, baseAsset, quoteAsset, baseDenom, quoteDenom, baseAmount, quoteAmount])

    // Paying the fee in the Settings fee token keeps the native balance for the
    // reserves, so either path unlocks the form.
    const canPayFee = hasEnoughForFee || feePayment.paysWithAlt

    const isComplete = Boolean(baseDenom) && Boolean(quoteDenom) && pairError === '' &&
        amountsValid && swapFeeError === ''
    const canConfirm = isComplete && Boolean(address) && Boolean(fee) &&
        !isFeeBalanceLoading && canPayFee && !isPoolsLoading

    const submit = async () => {
        if (!address || !canConfirm || !baseAsset || !quoteAsset) return

        // Send the pair pre-sorted (the keeper sorts alphabetically and swaps
        // the amounts anyway) so what was reviewed is exactly what lands on chain.
        const sorted = baseDenom < quoteDenom
            ? {
                base: baseDenom,
                quote: quoteDenom,
                initialBase: amountToUAmount(baseAmount, baseAsset.decimals),
                initialQuote: amountToUAmount(quoteAmount, quoteAsset.decimals),
            }
            : {
                base: quoteDenom,
                quote: baseDenom,
                initialBase: amountToUAmount(quoteAmount, quoteAsset.decimals),
                initialQuote: amountToUAmount(baseAmount, baseAsset.decimals),
            }
        const poolId = createPoolId(sorted.base, sorted.quote)

        const msg = createLiquidityPool({
            creator: address,
            ...sorted,
            fee: new BigNumber(swapFee).div(100).toString(),
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
                    // ulp_<base>_<quote> vs hashed ulp/<hash>) — read it from the
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
    }

    const copyLpDenom = async () => {
        if (!created?.lpDenom) return
        await navigator.clipboard.writeText(created.lpDenom)
        toast.success('Copied', 'LP denom copied to clipboard.')
    }

    if (created) {
        const dexUrl = getEcosystemApps().find(app => app.key === 'dex')?.href ?? 'https://dex.getbze.com'
        const poolUrl = `${dexUrl}/pools/details?id=${encodeURIComponent(created.poolId)}`
        const txUrl = `${getChainExplorerURL(getChainName())}/tx/${created.txHash}`

        return (
            <VStack align="stretch" gap={6} py={{ base: 4, md: 8 }}>
                <VStack gap={3} align="center">
                    <Box color="green.500">
                        <LuCircleCheck size={56} />
                    </Box>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        The {canonicalPairLabel} pool is live!
                    </Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Your seed reserves went into the pool and LP tokens representing your
                        share were minted to your wallet. Swaps can start right away.
                    </Text>
                </VStack>

                <Box
                    p={4}
                    bgGradient="to-br"
                    gradientFrom="yellow.500/8"
                    gradientTo="yellow.600/8"
                    borderWidth="1px"
                    borderColor="yellow.500/20"
                    borderRadius="xl"
                >
                    <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                            Your LP token
                        </Text>
                        {created.lpDenom ? (
                            <HStack gap={2}>
                                <Text fontSize="xs" fontFamily="mono" p={2} borderRadius="md" bg="bg.muted" wordBreak="break-all" flex="1">
                                    {created.lpDenom}
                                </Text>
                                <Button size="sm" variant="ghost" colorPalette="yellow" onClick={copyLpDenom} aria-label="Copy LP denom">
                                    <LuCopy />
                                </Button>
                            </HStack>
                        ) : (
                            <Skeleton height="8" />
                        )}
                    </VStack>
                </Box>

                <HStack gap={3} justify="center" wrap="wrap">
                    <Button colorPalette="yellow" onClick={() => openExternal(poolUrl)}>
                        View pool on DEX <LuArrowUpRight />
                    </Button>
                    <Button variant="outline" colorPalette="yellow" onClick={() => openExternal(txUrl)}>
                        View transaction <LuArrowUpRight />
                    </Button>
                </HStack>

                <VStack align="stretch" gap={3}>
                    <Text fontSize="sm" color="fg.muted" fontWeight="medium" textAlign="center">
                        What&apos;s next?
                    </Text>
                    {/* The LP denom arrives async from the stored pool — the reward
                        chaining stays disabled until it resolves. */}
                    <HStack gap={3} justify="center" wrap="wrap">
                        <Button
                            variant="outline"
                            colorPalette="yellow"
                            size="sm"
                            disabled={!created.lpDenom}
                            onClick={() => created.lpDenom &&
                                navigate(`/reward/new?staking=${encodeURIComponent(created.lpDenom)}`)}
                        >
                            <LuGift />
                            Create a staking reward
                        </Button>
                        <Button variant="outline" colorPalette="yellow" size="sm" onClick={createAnother}>
                            <LuPlus />
                            Create another pool
                        </Button>
                    </HStack>
                </VStack>

                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => navigate('/')}>
                    Back to hub
                </Button>
            </VStack>
        )
    }

    return (
        <VStack align="stretch" gap={6}>
            <Box>
                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => navigate('/')}>
                    <LuArrowLeft />
                    Creation hub
                </Button>
            </Box>

            <HStack gap={3}>
                <Box p={2.5} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                    <LuDroplets size={22} />
                </Box>
                <VStack align="start" gap={0}>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        Create Liquidity Pool
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        Seed an AMM pool, set its swap fee, and decide where the fees go.
                    </Text>
                </VStack>
            </HStack>

            <Card.Root variant="outline" p={{ base: 5, md: 6 }}>
                <VStack align="stretch" gap={5}>
                    <AssetPicker
                        label="First asset"
                        value={baseDenom}
                        excludeDenoms={quoteDenom ? [quoteDenom] : undefined}
                        onSelect={(asset) => setBaseDenom(asset.denom)}
                    />
                    <AssetPicker
                        label="Second asset"
                        value={quoteDenom}
                        excludeDenoms={baseDenom ? [baseDenom] : undefined}
                        ownFirst={false}
                        onSelect={(asset) => setQuoteDenom(asset.denom)}
                    />

                    {pairError !== '' && (
                        <Text fontSize="sm" color="fg.error" fontWeight="medium">
                            {pairError}
                        </Text>
                    )}

                    {canonicalPairLabel && pairError === '' && (
                        <Text fontSize="sm" color="fg.muted">
                            Stored on-chain as <Text as="span" fontWeight="semibold">{canonicalPairLabel}</Text>
                            {!isCanonicalOrder && ' — the chain orders every pair alphabetically.'}
                        </Text>
                    )}

                    <Separator />

                    <VStack align="stretch" gap={4}>
                        <VStack align="start" gap={0}>
                            <Text fontWeight="semibold">Initial reserves</Text>
                            <Text fontSize="sm" color="fg.muted">
                                Your seed defines the starting price — both amounts leave your wallet
                                and you receive LP tokens representing your share.
                            </Text>
                        </VStack>

                        {baseAsset && (
                            <ReserveField
                                label="First asset amount"
                                denom={baseDenom}
                                amount={baseAmount}
                                onChange={setBaseAmount}
                            />
                        )}
                        {quoteAsset && (
                            <ReserveField
                                label="Second asset amount"
                                denom={quoteDenom}
                                amount={quoteAmount}
                                onChange={setQuoteAmount}
                            />
                        )}

                        {impliedPrice && baseAsset && quoteAsset && (
                            <Text fontSize="sm" color="fg.muted">
                                Starting price: <Text as="span" fontWeight="semibold">
                                    1 {baseAsset.ticker} = {prettyAmount(impliedPrice)} {quoteAsset.ticker}
                                </Text>
                            </Text>
                        )}
                    </VStack>

                    <Separator />

                    <VStack align="stretch" gap={3}>
                        <VStack align="start" gap={0}>
                            <Text fontWeight="semibold">Swap fee</Text>
                            <Text fontSize="sm" color="fg.muted">
                                Charged on every swap in this pool ({MIN_SWAP_FEE_PCT}%–{MAX_SWAP_FEE_PCT}%).
                            </Text>
                        </VStack>
                        <HStack gap={2} flexWrap="wrap">
                            {SWAP_FEE_PRESETS.map(preset => (
                                <Button
                                    key={preset}
                                    size="sm"
                                    variant={swapFee === preset ? 'solid' : 'outline'}
                                    colorPalette="yellow"
                                    onClick={() => setSwapFee(preset)}
                                >
                                    {preset}%
                                </Button>
                            ))}
                            <Field.Root invalid={swapFeeError !== ''} maxW="32">
                                <Input
                                    size="sm"
                                    inputMode="decimal"
                                    value={swapFee}
                                    onChange={(e) => setSwapFee(e.target.value)}
                                />
                            </Field.Root>
                        </HStack>
                        {swapFeeError !== '' && (
                            <Text fontSize="sm" color="fg.error">{swapFeeError}</Text>
                        )}
                    </VStack>

                    <Separator />

                    <VStack align="stretch" gap={3}>
                        <VStack align="start" gap={0}>
                            <Text fontWeight="semibold">Where do the swap fees go?</Text>
                            <Text fontSize="sm" color="fg.muted">
                                Drag the handles to split every collected fee between liquidity
                                providers, the burner, and the community treasury.
                            </Text>
                        </VStack>
                        <FeeSplitSlider value={feeSplit} onChange={setFeeSplit} />
                    </VStack>

                    <InfoBox title="No market needed">
                        Pools are independent of order-book markets — any pair with supply works.
                        Creating the pool is permanent: the pair gets exactly one pool, and its swap
                        fee and fee destination are fixed at creation.
                    </InfoBox>

                    <Separator />

                    <FeeDisclosure fee={fee} isLoading={isFeeLoading} label="Pool creation fee" />

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
                </VStack>
            </Card.Root>
        </VStack>
    )
}

export default function PoolNewPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="2xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <PoolNewContent />
                </Suspense>
            </Container>
        </Box>
    )
}
