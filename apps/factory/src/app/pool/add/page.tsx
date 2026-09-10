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
    LuDroplets,
    LuGift,
    LuPlus,
} from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    LP_ASSETS_DECIMALS,
    amountToUAmount,
    getChainExplorerURL,
    getChainName,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useLiquidityPool,
    useLiquidityPools,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { InfoBox } from '@/components/ui/info-box'
import { PoolPicker } from '@/components/pool-form/pool-picker'
import { validateAmount } from '@/components/token-wizard/validation'
import { useNavigationWithParams } from '@/hooks/useNavigation'

const { addLiquidity } = bze.tradebin.MessageComposer.withTypeUrl

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

const SLIPPAGE_PRESETS = ['0.5', '1', '3']
const DEFAULT_SLIPPAGE_PCT = '1'

function DepositField({
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

function PoolAddContent() {
    const { getQueryParam, navigate } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { pools, updateLiquidityPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { tx } = useFactoryTx()

    // Deep links (e.g. from My Pools) preselect the pool via ?pool=<id>.
    const [poolId, setPoolId] = useState(() => getQueryParam('pool') ?? '')
    const [baseAmount, setBaseAmount] = useState('')
    const [quoteAmount, setQuoteAmount] = useState('')
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE_PCT)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [added, setAdded] = useState<{ txHash: string } | undefined>(undefined)

    const {
        pool,
        userSharesPercentage,
        totalShares,
        userShares,
        calculateOppositeAmount,
        calculateSharesFromAmounts,
    } = useLiquidityPool(poolId)

    const { asset: baseAsset } = useAsset(pool?.base ?? '')
    const { asset: quoteAsset } = useAsset(pool?.quote ?? '')
    const { balance: baseBalance } = useBalance(pool?.base ?? '')
    const { balance: quoteBalance } = useBalance(pool?.quote ?? '')

    const pairLabel = baseAsset && quoteAsset ? `${baseAsset.ticker}/${quoteAsset.ticker}` : ''

    // Deposits must match the pool ratio — typing on one side computes the other
    // from the current reserves, so the pair can never be sent unbalanced.
    const balanceOpposite = (value: string, editedIsBase: boolean): string => {
        if (!baseAsset || !quoteAsset) return ''
        const editedAsset = editedIsBase ? baseAsset : quoteAsset
        const oppositeAsset = editedIsBase ? quoteAsset : baseAsset
        if (validateAmount(value, editedAsset.decimals) !== '') return ''
        const oppositeU = calculateOppositeAmount(amountToUAmount(value, editedAsset.decimals), editedIsBase)
            .integerValue(BigNumber.ROUND_CEIL)
        if (oppositeU.isZero()) return ''
        return uAmountToBigNumberAmount(oppositeU, oppositeAsset.decimals).toFixed()
    }

    const onBaseChange = (value: string) => {
        setBaseAmount(value)
        setQuoteAmount(balanceOpposite(value, true))
    }

    const onQuoteChange = (value: string) => {
        setQuoteAmount(value)
        setBaseAmount(balanceOpposite(value, false))
    }

    const onPoolSelect = (picked: { id: string }) => {
        setPoolId(picked.id)
        setBaseAmount('')
        setQuoteAmount('')
    }

    const amountsValid = useMemo(() => {
        if (!baseAsset || !quoteAsset) return false
        if (validateAmount(baseAmount, baseAsset.decimals) !== '') return false
        if (validateAmount(quoteAmount, quoteAsset.decimals) !== '') return false
        if (baseBalance.amount.lt(amountToUAmount(baseAmount, baseAsset.decimals))) return false
        if (quoteBalance.amount.lt(amountToUAmount(quoteAmount, quoteAsset.decimals))) return false
        return true
    }, [baseAsset, quoteAsset, baseAmount, quoteAmount, baseBalance, quoteBalance])

    const expectedLpTokens = useMemo(() => {
        if (!amountsValid || !baseAsset || !quoteAsset) return new BigNumber(0)
        return calculateSharesFromAmounts(
            amountToUAmount(baseAmount, baseAsset.decimals),
            amountToUAmount(quoteAmount, quoteAsset.decimals),
        )
    }, [amountsValid, baseAsset, quoteAsset, baseAmount, quoteAmount, calculateSharesFromAmounts])

    // The guard the chain enforces: if the pool ratio moves before the tx lands
    // and fewer LP tokens would be minted, the tx fails instead of overpaying.
    const minLpTokens = useMemo(() => {
        if (expectedLpTokens.isZero()) return new BigNumber(0)
        const guarded = expectedLpTokens
            .multipliedBy(new BigNumber(100).minus(slippage).div(100))
            .integerValue(BigNumber.ROUND_DOWN)
        return BigNumber.maximum(guarded, 1)
    }, [expectedLpTokens, slippage])

    const shareAfterDeposit = useMemo(() => {
        if (expectedLpTokens.isZero()) return undefined
        const newTotal = totalShares.plus(expectedLpTokens)
        if (newTotal.isZero()) return undefined
        return userShares.plus(expectedLpTokens).dividedBy(newTotal).multipliedBy(100)
    }, [expectedLpTokens, totalShares, userShares])

    const poolPrice = useMemo(() => {
        if (!pool || !baseAsset || !quoteAsset) return undefined
        const reserveBase = uAmountToBigNumberAmount(pool.reserve_base, baseAsset.decimals)
        const reserveQuote = uAmountToBigNumberAmount(pool.reserve_quote, quoteAsset.decimals)
        if (reserveBase.isZero()) return undefined
        return reserveQuote.dividedBy(reserveBase)
    }, [pool, baseAsset, quoteAsset])

    const isComplete = Boolean(pool) && amountsValid && expectedLpTokens.gt(0)
    const canConfirm = isComplete && Boolean(address) && !isPoolsLoading

    const submit = async () => {
        if (!address || !canConfirm || !pool || !baseAsset || !quoteAsset) return

        const msg = addLiquidity({
            creator: address,
            poolId: pool.id,
            baseAmount: amountToUAmount(baseAmount, baseAsset.decimals),
            quoteAmount: amountToUAmount(quoteAmount, quoteAsset.decimals),
            minLpTokens: minLpTokens.toFixed(0),
        })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: (res) => {
                    setAdded({ txHash: res.txhash })
                    // Refresh reserves so the ratio math stays current for the next deposit.
                    void updateLiquidityPools()
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const addMore = () => {
        setAdded(undefined)
        setBaseAmount('')
        setQuoteAmount('')
    }

    if (added && pool) {
        const dexUrl = getDexApp().href
        const poolUrl = `${dexUrl}/pools/details?id=${encodeURIComponent(pool.id)}`
        const txUrl = `${getChainExplorerURL(getChainName())}/tx/${added.txHash}`

        return (
            <VStack align="stretch" gap={6} py={{ base: 4, md: 8 }}>
                <VStack gap={3} align="center">
                    <Box color="green.500">
                        <LuCircleCheck size={56} />
                    </Box>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        Liquidity added to {pairLabel}!
                    </Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Your deposit joined the pool reserves and LP tokens representing
                        your share were minted to your wallet.
                    </Text>
                </VStack>

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
                    <HStack gap={3} justify="center" wrap="wrap">
                        <Button
                            variant="outline"
                            colorPalette="yellow"
                            size="sm"
                            onClick={() => navigate(`/reward/new?staking=${encodeURIComponent(pool.lp_denom)}`)}
                        >
                            <LuGift />
                            Create a staking reward
                        </Button>
                        <Button variant="outline" colorPalette="yellow" size="sm" onClick={addMore}>
                            <LuPlus />
                            Add more liquidity
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
                        Add Liquidity
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        Provide liquidity to an existing pool and receive LP tokens.
                    </Text>
                </VStack>
            </HStack>

            <Card.Root variant="outline" p={{ base: 5, md: 6 }}>
                <VStack align="stretch" gap={5}>
                    <PoolPicker label="Pool" value={poolId} onSelect={onPoolSelect} />

                    {!isPoolsLoading && pools.length === 0 && (
                        <InfoBox title="No pools yet">
                            There are no liquidity pools on this chain yet — create the
                            first one from the hub and come back to grow it.
                        </InfoBox>
                    )}

                    {pool && baseAsset && quoteAsset && (
                        <>
                            <Box p={4} borderWidth="1px" borderColor="border.muted" borderRadius="lg">
                                <VStack align="stretch" gap={1}>
                                    <HStack justify="space-between">
                                        <Text fontSize="sm" color="fg.muted">Pool reserves</Text>
                                        <Text fontSize="sm" fontWeight="medium">
                                            {prettyAmount(uAmountToBigNumberAmount(pool.reserve_base, baseAsset.decimals))} {baseAsset.ticker}
                                            {' + '}
                                            {prettyAmount(uAmountToBigNumberAmount(pool.reserve_quote, quoteAsset.decimals))} {quoteAsset.ticker}
                                        </Text>
                                    </HStack>
                                    {poolPrice && (
                                        <HStack justify="space-between">
                                            <Text fontSize="sm" color="fg.muted">Pool price</Text>
                                            <Text fontSize="sm" fontWeight="medium">
                                                1 {baseAsset.ticker} = {prettyAmount(poolPrice)} {quoteAsset.ticker}
                                            </Text>
                                        </HStack>
                                    )}
                                    <HStack justify="space-between">
                                        <Text fontSize="sm" color="fg.muted">Your share</Text>
                                        <Text fontSize="sm" fontWeight="medium">{userSharesPercentage.toString()}%</Text>
                                    </HStack>
                                </VStack>
                            </Box>

                            <Separator />

                            <VStack align="stretch" gap={4}>
                                <VStack align="start" gap={0}>
                                    <Text fontWeight="semibold">Your deposit</Text>
                                    <Text fontSize="sm" color="fg.muted">
                                        Deposits follow the pool ratio — fill either side and
                                        the other is computed from the current reserves.
                                    </Text>
                                </VStack>

                                <DepositField
                                    label="First asset amount"
                                    denom={pool.base}
                                    amount={baseAmount}
                                    onChange={onBaseChange}
                                />
                                <DepositField
                                    label="Second asset amount"
                                    denom={pool.quote}
                                    amount={quoteAmount}
                                    onChange={onQuoteChange}
                                />
                            </VStack>

                            <Separator />

                            <VStack align="stretch" gap={3}>
                                <VStack align="start" gap={0}>
                                    <Text fontWeight="semibold">Slippage tolerance</Text>
                                    <Text fontSize="sm" color="fg.muted">
                                        If the pool ratio moves before your transaction lands and
                                        fewer LP tokens would be minted, the transaction fails
                                        instead of accepting the worse deal.
                                    </Text>
                                </VStack>
                                <HStack gap={2}>
                                    {SLIPPAGE_PRESETS.map(preset => (
                                        <Button
                                            key={preset}
                                            size="sm"
                                            variant={slippage === preset ? 'solid' : 'outline'}
                                            colorPalette="yellow"
                                            onClick={() => setSlippage(preset)}
                                        >
                                            {preset}%
                                        </Button>
                                    ))}
                                </HStack>
                            </VStack>

                            {expectedLpTokens.gt(0) && (
                                <Box p={4} bg="yellow.500/8" borderWidth="1px" borderColor="yellow.500/20" borderRadius="lg">
                                    <VStack align="stretch" gap={1}>
                                        <HStack justify="space-between">
                                            <Text fontSize="sm" color="fg.muted">You will receive</Text>
                                            <Text fontSize="sm" fontWeight="medium">
                                                ~{prettyAmount(uAmountToBigNumberAmount(expectedLpTokens, LP_ASSETS_DECIMALS))} LP tokens
                                            </Text>
                                        </HStack>
                                        <HStack justify="space-between">
                                            <Text fontSize="sm" color="fg.muted">Minimum after {slippage}% slippage</Text>
                                            <Text fontSize="sm" fontWeight="medium">
                                                {prettyAmount(uAmountToBigNumberAmount(minLpTokens, LP_ASSETS_DECIMALS))} LP tokens
                                            </Text>
                                        </HStack>
                                        {shareAfterDeposit && (
                                            <HStack justify="space-between">
                                                <Text fontSize="sm" color="fg.muted">Your share after deposit</Text>
                                                <Text fontSize="sm" fontWeight="medium">
                                                    {shareAfterDeposit.toFixed(2)}%
                                                </Text>
                                            </HStack>
                                        )}
                                    </VStack>
                                </Box>
                            )}
                        </>
                    )}

                    <Separator />

                    <VStack align="stretch" gap={2}>
                        <Button
                            size="lg"
                            colorPalette="yellow"
                            onClick={submit}
                            disabled={!canConfirm}
                            loading={isSubmitting}
                            loadingText="Waiting for signature..."
                        >
                            Add liquidity
                        </Button>
                        {!address && (
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Connect your wallet to add liquidity.
                            </Text>
                        )}
                    </VStack>
                </VStack>
            </Card.Root>
        </VStack>
    )
}

export default function PoolAddPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="2xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <PoolAddContent />
                </Suspense>
            </Container>
        </Box>
    )
}
