"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuGift, LuPlus } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    GradientText,
    LP_ASSETS_DECIMALS,
    hgVariant,
    amountToUAmount,
    getExplorerTxURL,
    getChainName,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useLiquidityPool,
    useLiquidityPools,
    useMaxSpendable,
    HaltedNotice,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { PoolPicker } from '@/components/pool-form/pool-picker'
import { validateAmount } from '@/components/token-wizard/validation'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import {
    AnswerChip,
    ContinueRow,
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
    withReturn,
} from '@/components/guided'
import {
    DEFAULT_SLIPPAGE_PCT,
    SLIPPAGE_PRESETS,
    minLpTokens as computeMinLpTokens,
    oppositeDeposit,
    shareAfterDeposit as computeShareAfterDeposit,
} from '@/lib/pool-add'
import { softButton } from '@/components/ui/soft-button'

const { addLiquidity } = bze.tradebin.MessageComposer.withTypeUrl

const STEPS = ['pool', 'amounts', 'protection'] as const
type Step = typeof STEPS[number]

const TX_KIND = 'add-liquidity'

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
        onChange(uAmountToBigNumberAmount(max.amount, asset.decimals).toFixed())
        setTouched(true)
    }

    return (
        <Field.Root invalid={touched && error !== ''}>
            <Field.Label>{label} ({asset.ticker})</Field.Label>
            <HStack gap="8px" w="full">
                <Input
                    placeholder="e.g. 1000"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setTouched(true)}
                />
                <Button
                    size="sm"
                    {...softButton}
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

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <HStack justify="space-between" align="start" gap="12px">
            <Text fontSize="14px" color="fg.muted">{label}</Text>
            <Text fontSize="14px" fontWeight="600" textAlign="right" minW={0} wordBreak="break-word">{value}</Text>
        </HStack>
    )
}

function PoolAddContent() {
    const { getQueryParam, navigate } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const { address } = useChain(getChainName())
    const { pools, updateLiquidityPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { tx } = useFactoryTx()

    // Deep links (e.g. from My Pools or "Add liquidity to it") preselect the pool via ?pool=<id>.
    const [poolId, setPoolId] = useState(() => getQueryParam('pool') ?? '')
    const [baseAmount, setBaseAmount] = useState('')
    const [quoteAmount, setQuoteAmount] = useState('')
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE_PCT)
    // A deep link lands on question 2 (the pool still has to resolve and not be halted).
    const [answered, setAnswered] = useState<Step[]>(() => (getQueryParam('pool') ? ['pool'] : []))

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [added, setAdded] = useState<{ txHash: string } | undefined>(undefined)

    const {
        pool,
        userSharesPercentage,
        totalShares,
        userShares,
        calculateSharesFromAmounts,
    } = useLiquidityPool(poolId)

    const { asset: baseAsset } = useAsset(pool?.base ?? '')
    const { asset: quoteAsset } = useAsset(pool?.quote ?? '')
    const { balance: baseBalance } = useBalance(pool?.base ?? '')
    const { balance: quoteBalance } = useBalance(pool?.quote ?? '')

    const baseTicker = baseAsset?.ticker ?? ''
    const quoteTicker = quoteAsset?.ticker ?? ''
    const pairLabel = baseAsset && quoteAsset ? `${baseTicker}/${quoteTicker}` : ''
    // The picker hides halted pools; a `?pool=` deep link to one lands on the notice instead.
    const isHalted = Boolean(baseAsset?.halted || quoteAsset?.halted)
    const isPoolValid = Boolean(pool && baseAsset && quoteAsset) && !isHalted
    const noPools = !isPoolsLoading && pools.length === 0

    // Deposits must match the pool ratio: typing on one side computes the other
    // from the current reserves, so the pair can never be sent unbalanced.
    const onBaseChange = (value: string) => {
        setBaseAmount(value)
        if (pool && baseAsset && quoteAsset) {
            setQuoteAmount(oppositeDeposit(pool, value, true, baseAsset.decimals, quoteAsset.decimals))
        }
    }

    const onQuoteChange = (value: string) => {
        setQuoteAmount(value)
        if (pool && baseAsset && quoteAsset) {
            setBaseAmount(oppositeDeposit(pool, value, false, quoteAsset.decimals, baseAsset.decimals))
        }
    }

    const onPoolSelect = (picked: { id: string }) => {
        setPoolId(picked.id)
        setBaseAmount('')
        setQuoteAmount('')
        setAnswered(prev => prev.filter(k => k !== 'amounts'))
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

    const minLpTokens = computeMinLpTokens(expectedLpTokens, slippage)
    const shareAfterDeposit = computeShareAfterDeposit(expectedLpTokens, userShares, totalShares)

    const poolPrice = useMemo(() => {
        if (!pool || !baseAsset || !quoteAsset) return undefined
        const reserveBase = uAmountToBigNumberAmount(pool.reserve_base, baseAsset.decimals)
        const reserveQuote = uAmountToBigNumberAmount(pool.reserve_quote, quoteAsset.decimals)
        if (reserveBase.isZero()) return undefined
        return reserveQuote.dividedBy(reserveBase)
    }, [pool, baseAsset, quoteAsset])

    const steps = useGuidedSteps(STEPS, {
        pool: answered.includes('pool') && isPoolValid,
        amounts: answered.includes('amounts') && amountsValid && expectedLpTokens.gt(0),
        protection: answered.includes('protection'),
    })

    const answer = (key: Step) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    const isComplete = STEPS.every(k => steps.state[k] === 'done') && isPoolValid && expectedLpTokens.gt(0)
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
        setAnswered(['pool', 'protection'])
        steps.close()
    }

    if (added && pool) {
        const poolUrl = `${getDexApp().href}/pools/details?id=${encodeURIComponent(pool.id)}`
        return (
            <SuccessPanel
                title={`Liquidity added to ${pairLabel}!`}
                text="Your deposit joined the pool reserves and LP tokens for your share were sent to your wallet."
                links={[
                    { label: 'DEX', href: poolUrl, app: 'dex' },
                    { label: 'Explorer', href: getExplorerTxURL(added.txHash), app: 'explorer' },
                ]}
                next={[{
                    label: 'Reward liquidity providers',
                    href: withReturn(`/reward/new?staking=${encodeURIComponent(pool.lp_denom)}`, returnTo),
                    icon: <LuGift />,
                }]}
                again={{ label: 'Add more liquidity', onClick: addMore }}
            />
        )
    }

    const depositSummary = amountsValid
        ? `${prettyAmount(new BigNumber(baseAmount))} ${baseTicker} + ${prettyAmount(new BigNumber(quoteAmount))} ${quoteTicker}`
        : ''

    const aside = (
        <>
            <OutcomePanel>
                {expectedLpTokens.gt(0) ? (
                    <Text>
                        You receive about <Text as="span" fontWeight="600">
                            {prettyAmount(uAmountToBigNumberAmount(expectedLpTokens, LP_ASSETS_DECIMALS))}
                        </Text> LP tokens (at least {prettyAmount(uAmountToBigNumberAmount(minLpTokens, LP_ASSETS_DECIMALS))} after {slippage}% price protection).
                        {shareAfterDeposit && <> Your share of the pool becomes <Text as="span" fontWeight="600">{shareAfterDeposit.toFixed(2)}%</Text>.</>}
                    </Text>
                ) : (
                    <Text color="fg.muted">
                        Pick a pool and an amount to see how many LP tokens you receive.
                    </Text>
                )}
            </OutcomePanel>

            <PayPanel rows={[{ label: 'Factory fee', text: 'None' }]} txKind={TX_KIND} />

            <SubmitBlock label="Add liquidity" onClick={submit} disabled={!canConfirm} loading={isSubmitting}>
                {!address && (
                    <SubmitNote>Connect your wallet to add liquidity.</SubmitNote>
                )}
            </SubmitBlock>
        </>
    )

    return (
        <GuidedForm
            title={<>Make trading <GradientText>smoother</GradientText></>}
            subtitle="Add to a pool so big trades move the price less. You get LP tokens you can withdraw later on the DEX."
            techTag="tradebin · add liquidity"
            aside={aside}
        >
            <Question
                number={1}
                title="Which pool?"
                state={steps.state.pool}
                summary={pairLabel}
                onChange={() => steps.open('pool')}
            >
                <VStack align="stretch" gap="16px">
                    {noPools ? (
                        <VStack align="start" gap="12px">
                            <Text fontSize="14px">No pools yet — create the first one.</Text>
                            <Button
                                variant={hgVariant('primary')}
                                size="sm"
                                onClick={() => navigate(withReturn('/pool/new', returnTo))}
                            >
                                <LuPlus />
                                Create a pool
                            </Button>
                        </VStack>
                    ) : (
                        <PoolPicker label="Pool" value={poolId} onSelect={onPoolSelect} excludeHalted />
                    )}

                    {pool && isHalted && (
                        <HaltedNotice tickers={[baseAsset, quoteAsset].filter(asset => asset?.halted).map(asset => asset!.ticker)}>
                            New liquidity cannot be added to this pool. Remove your existing position from the DEX pool page.
                        </HaltedNotice>
                    )}

                    {pool && baseAsset && quoteAsset && !isHalted && (
                        <Box
                            px="14px"
                            py="12px"
                            bg="hg.inset"
                            borderWidth="1px"
                            borderColor="hg.hairline"
                            borderRadius="hg.md"
                            role="group"
                            aria-label="Pool facts"
                        >
                            <VStack align="stretch" gap="8px">
                                <FactRow
                                    label="Pool reserves"
                                    value={<>
                                        {prettyAmount(uAmountToBigNumberAmount(pool.reserve_base, baseAsset.decimals))} {baseTicker}
                                        {' + '}
                                        {prettyAmount(uAmountToBigNumberAmount(pool.reserve_quote, quoteAsset.decimals))} {quoteTicker}
                                    </>}
                                />
                                {poolPrice && (
                                    <FactRow label="Pool price" value={`1 ${baseTicker} = ${prettyAmount(poolPrice)} ${quoteTicker}`} />
                                )}
                                <FactRow label="Your share" value={`${userSharesPercentage.toString()}%`} />
                            </VStack>
                        </Box>
                    )}

                    {!noPools && (
                        <ContinueRow disabled={!isPoolValid} onContinue={() => answer('pool')} />
                    )}
                </VStack>
            </Question>

            {!isHalted && (
                <>
                    <Question
                        number={2}
                        title="How much to add?"
                        state={steps.state.amounts}
                        summary={depositSummary}
                        onChange={() => steps.open('amounts')}
                    >
                        <VStack align="stretch" gap="16px">
                            <Text fontSize="14px" color="fg.muted">
                                Deposits follow the pool ratio: fill either side and the other is computed
                                from the current reserves.
                            </Text>
                            {pool && (
                                <>
                                    <DepositField label="First token" denom={pool.base} amount={baseAmount} onChange={onBaseChange} />
                                    <DepositField label="Second token" denom={pool.quote} amount={quoteAmount} onChange={onQuoteChange} />
                                </>
                            )}
                            <ContinueRow disabled={!amountsValid || !expectedLpTokens.gt(0)} onContinue={() => answer('amounts')} />
                        </VStack>
                    </Question>

                    <Question
                        number={3}
                        title="Price protection"
                        state={steps.state.protection}
                        summary={`${slippage}%`}
                        onChange={() => steps.open('protection')}
                    >
                        <VStack align="stretch" gap="16px">
                            <HStack gap="6px" flexWrap="wrap">
                                {SLIPPAGE_PRESETS.map(preset => (
                                    <AnswerChip key={preset} selected={slippage === preset} onClick={() => setSlippage(preset)}>
                                        {preset}%
                                    </AnswerChip>
                                ))}
                            </HStack>
                            <Text fontSize="14px" color="fg.muted">
                                If the price moves more than this before your deposit lands, it is cancelled and nothing is spent.
                            </Text>
                            <ContinueRow onContinue={() => answer('protection')} />
                        </VStack>
                    </Question>
                </>
            )}
        </GuidedForm>
    )
}

export default function PoolAddPage() {
    return (
        <FormPage>
            <PoolAddContent />
        </FormPage>
    )
}
