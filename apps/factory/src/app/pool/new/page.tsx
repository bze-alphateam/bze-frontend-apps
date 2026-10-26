"use client"

import React, { useCallback, useMemo, useState } from 'react'
import { Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { bze } from '@bze/bzejs'
import {
    AppLink,
    GradientText,
    amountToUAmount,
    createPoolId,
    getChainName,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetPrice,
    useBalance,
    useCreationFees,
    useLiquidityPools,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { AssetPicker } from '@/components/ui/asset-picker'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import { DEFAULT_FEE_SPLIT, type FeeSplit, FeeSplitSlider } from '@/components/pool-form/fee-split-slider'
import { PoolDone, type PoolDoneInput } from '@/components/pool-wizard/pool-done'
import { CREATE_POOL_TX_KIND, ReserveField } from '@/components/pool-wizard/reserve-field'
import { validateAmount } from '@/components/token-wizard/validation'
import {
    AnswerChip,
    BlockerNote,
    FormPage,
    GuidedForm,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    WarningNote,
    useGuidedSteps,
} from '@/components/guided'
import { dexPoolHref } from '@/lib/create-routes'
import {
    DEFAULT_SWAP_FEE_PCT,
    SWAP_FEE_PRESETS,
    createPoolMsgValue,
    pairProblem,
    startingPrice,
    swapFeeSummary,
    validateSwapFee,
} from '@/lib/pool-new'
import { notEnoughText } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary'

const { createLiquidityPool } = bze.tradebin.MessageComposer.withTypeUrl

const FORM_STEPS = ['pair', 'amounts', 'fees'] as const
type FormStep = typeof FORM_STEPS[number]
const STEP_KEYS = [...FORM_STEPS, 'review'] as const

function PoolNewContent() {
    const { address } = useChain(getChainName())
    const { getDenomsPool, updateLiquidityPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { fees, isLoading: isFeeLoading } = useCreationFees()

    const { getQueryParam } = useNavigationWithParams()
    const [baseDenom, setBaseDenom] = useState(() => getQueryParam('base') ?? '')
    const [quoteDenom, setQuoteDenom] = useState(() => getQueryParam('quote') ?? '')
    const [baseAmount, setBaseAmount] = useState('')
    const [quoteAmount, setQuoteAmount] = useState('')
    const [swapFee, setSwapFee] = useState(DEFAULT_SWAP_FEE_PCT)
    const [feeSplit, setFeeSplit] = useState<FeeSplit>(DEFAULT_FEE_SPLIT)
    // A deep link with both sides lands on step 2 (the pair still has to pass its checks).
    const [answered, setAnswered] = useState<FormStep[]>(() => (getQueryParam('base') && getQueryParam('quote') ? ['pair'] : []))
    const [done, setDone] = useState<{ input: PoolDoneInput; hash: string } | undefined>(undefined)

    const { asset: baseAsset } = useAsset(baseDenom)
    const { asset: quoteAsset } = useAsset(quoteDenom)
    const { balance: baseBalance } = useBalance(baseDenom)
    const { balance: quoteBalance } = useBalance(quoteDenom)
    const quotePrice = useAssetPrice(quoteDenom)

    const fee = fees.createMarketFee
    const { asset: feeAsset } = useAsset(fee?.denom ?? '')
    const { balance: feeBalance, isLoading: isFeeBalanceLoading } = useBalance(fee?.denom ?? '')
    const feePayment = useFeePayment(fee, CREATE_POOL_TX_KIND)

    const connected = Boolean(address)
    const baseTicker = baseAsset?.ticker ?? ''
    const quoteTicker = quoteAsset?.ticker ?? ''
    const pair = baseTicker && quoteTicker ? `${baseTicker}/${quoteTicker}` : ''

    const problem = useMemo(
        () => pairProblem(baseDenom, quoteDenom, baseAsset, quoteAsset, getDenomsPool),
        [baseDenom, quoteDenom, baseAsset, quoteAsset, getDenomsPool],
    )
    const isPairValid = Boolean(baseAsset) && Boolean(quoteAsset) && problem === undefined

    const amountsValid = useMemo(() => {
        if (!baseAsset || !quoteAsset) return false
        if (validateAmount(baseAmount, baseAsset.decimals) !== '') return false
        if (validateAmount(quoteAmount, quoteAsset.decimals) !== '') return false
        if (!connected) return true
        return baseBalance.amount.gte(amountToUAmount(baseAmount, baseAsset.decimals)) &&
            quoteBalance.amount.gte(amountToUAmount(quoteAmount, quoteAsset.decimals))
    }, [baseAsset, quoteAsset, baseAmount, quoteAmount, baseBalance, quoteBalance, connected])

    const price = amountsValid ? startingPrice(baseAmount, quoteAmount) : undefined
    const priceText = price ? prettyAmount(price) : ''
    const priceUsd = price && quotePrice.hasPrice ? quotePrice.totalUsdValue(price) : undefined

    const swapFeeError = validateSwapFee(swapFee)
    const feeSummary = swapFeeSummary(swapFee, feeSplit)

    const steps = useGuidedSteps(STEP_KEYS, {
        pair: answered.includes('pair') && isPairValid,
        amounts: answered.includes('amounts') && amountsValid,
        fees: answered.includes('fees') && swapFeeError === '',
        review: false,
    })

    const answer = (key: FormStep) => {
        setAnswered(prev => (prev.includes(key) ? prev : [...prev, key]))
        steps.close()
    }

    // The creation fee comes on top of the starting amounts: when one of them IS the fee denom,
    // the wallet must cover both together.
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
        if (feePayment.gasFee.denom === fee.denom) needed = needed.plus(feePayment.gasFee.amount)
        return feeBalance.amount.gte(needed)
    }, [fee, feeBalance, feeDenomReserve, feePayment.gasFee.denom, feePayment.gasFee.amount])

    // Paying the fee in the Settings fee token keeps the native balance for the starting amounts.
    const canPayFee = hasEnoughForFee || feePayment.paysWithAlt

    const uBase = baseAsset && amountsValid ? amountToUAmount(baseAmount, baseAsset.decimals) : ''
    const uQuote = quoteAsset && amountsValid ? amountToUAmount(quoteAmount, quoteAsset.decimals) : ''

    const buildMsgs = useCallback(() => {
        if (!address || !uBase || !uQuote) return undefined
        return [createLiquidityPool(createPoolMsgValue({
            creator: address,
            baseDenom,
            quoteDenom,
            baseUAmount: uBase,
            quoteUAmount: uQuote,
            swapFeePct: swapFee,
            split: feeSplit,
        }))]
    }, [address, baseDenom, quoteDenom, uBase, uQuote, swapFee, feeSplit])

    const onDone = useCallback(({ input, hash }: WizardTxDone<PoolDoneInput>) => {
        // The new pool joins the list, so its pair now reads as taken.
        void updateLiquidityPools()
        if (input) setDone({ input, hash })
    }, [updateLiquidityPools])
    const { submit, panelProps } = useWizardTx<PoolDoneInput>(buildMsgs, { title: `Create pool ${pair}`, onDone })

    if (done) return <PoolDone input={done.input} hash={done.hash} />

    const isComplete = FORM_STEPS.every(k => steps.state[k] === 'done')
    const canCreate = isComplete && connected && Boolean(fee) && !isFeeBalanceLoading && canPayFee && !isPoolsLoading

    const create = () => {
        if (!canCreate) return
        submit({ poolId: createPoolId(baseDenom, quoteDenom), base: baseDenom, quote: quoteDenom, baseTicker, quoteTicker, price: priceText })
    }

    const deposit = price
        ? `${prettyAmount(new BigNumber(baseAmount))} ${baseTicker} + ${prettyAmount(new BigNumber(quoteAmount))} ${quoteTicker}`
        : ''
    const pricePer = price ? `${priceText} ${quoteTicker} per ${baseTicker}` : ''

    const feeTicker = feeAsset?.ticker ?? fee?.denom ?? ''
    const feeBalanceText = prettyAmount(uAmountToBigNumberAmount(feeBalance.amount, feeAsset?.decimals ?? 6))
    // The same rows in the pay panel and in Review: the fee, then the starting amounts.
    const payRows = [
        { label: 'Creation fee', coin: fee },
        ...(uBase ? [{ label: `Starting ${baseTicker}`, coin: { denom: baseDenom, amount: uBase } }] : []),
        ...(uQuote ? [{ label: `Starting ${quoteTicker}`, coin: { denom: quoteDenom, amount: uQuote } }] : []),
    ]

    const aside = (
        <PayPanel
            rows={payRows}
            moduleFee={fee}
            txKind={CREATE_POOL_TX_KIND}
            isLoading={isFeeLoading}
            feeUnknown={!fee}
        />
    )

    return (
        <GuidedForm
            crumb="Liquidity pool"
            title={<>Create a <GradientText>liquidity pool</GradientText></>}
            subtitle="Pair two tokens and set the starting price."
            aside={aside}
        >
            <Question
                title="Pair"
                question="Which pair?"
                {...steps.step('pair')}
                summary={baseTicker && quoteTicker ? `${baseTicker} / ${quoteTicker}` : ''}
                action={{ label: 'Continue', onClick: () => answer('pair'), disabled: !isPairValid }}
            >
                <VStack align="stretch" gap="16px">
                    <AssetPicker
                        label="Base token"
                        value={baseDenom}
                        excludeDenoms={quoteDenom ? [quoteDenom] : undefined}
                        excludeHalted
                        onSelect={(asset) => setBaseDenom(asset.denom)}
                    />
                    <AssetPicker
                        label="Quote token"
                        value={quoteDenom}
                        excludeDenoms={baseDenom ? [baseDenom] : undefined}
                        excludeHalted
                        ownFirst={false}
                        onSelect={(asset) => setQuoteDenom(asset.denom)}
                    />

                    {problem && (
                        <BlockerNote
                            action={problem.existingPoolId && (
                                <AppLink app="dex" href={dexPoolHref(getDexApp().href, problem.existingPoolId)}>
                                    Add liquidity to it on the DEX
                                </AppLink>
                            )}
                        >
                            {problem.message}
                        </BlockerNote>
                    )}
                </VStack>
            </Question>

            <Question
                title="Starting amounts"
                question="How much goes in first?"
                {...steps.step('amounts')}
                summary={deposit && `${deposit} · ${pricePer}`}
                onBack={steps.back}
                action={{ label: 'Continue', onClick: () => answer('amounts'), disabled: !amountsValid }}
            >
                <VStack align="stretch" gap="16px">
                    <ReserveField denom={baseDenom} amount={baseAmount} onChange={setBaseAmount} fee={fee} connected={connected} />
                    <ReserveField denom={quoteDenom} amount={quoteAmount} onChange={setQuoteAmount} fee={fee} connected={connected} />

                    {price && (
                        <HStack justify="space-between" align="start" gap="12px" p="14px" borderRadius="hg.md" bg="hg.inset"
                            borderWidth="1px" borderColor="hg.divider" data-testid="starting-price">
                            <Text fontSize="14px" color="fg.muted">Starting price</Text>
                            <Text fontSize="14px" fontWeight="600" textAlign="right">
                                {`1 ${baseTicker} = ${priceText} ${quoteTicker}`}{priceUsd && ` ≈ $${prettyAmount(priceUsd)}`}
                            </Text>
                        </HStack>
                    )}

                    <WarningNote>This first deposit stays in the pool forever.</WarningNote>
                </VStack>
            </Question>

            <Question
                title="Fees"
                question="What do swappers pay?"
                {...steps.step('fees')}
                summary={feeSummary}
                onBack={steps.back}
                action={{ label: 'Review pool', onClick: () => answer('fees'), disabled: swapFeeError !== '' }}
            >
                <VStack align="stretch" gap="16px">
                    <VStack align="stretch" gap="8px">
                        <Text fontSize="13px" fontWeight="600" color="hg.text.secondary">Swap fee</Text>
                        <HStack gap="6px" flexWrap="wrap">
                            {SWAP_FEE_PRESETS.map(preset => (
                                <AnswerChip key={preset} selected={swapFee === preset} onClick={() => setSwapFee(preset)}>
                                    {preset}%
                                </AnswerChip>
                            ))}
                            <Field.Root invalid={swapFeeError !== ''} maxW="112px">
                                <Input
                                    size="xs"
                                    h="30px"
                                    borderRadius="hg.pill"
                                    inputMode="decimal"
                                    aria-label="Custom swap fee (%)"
                                    value={swapFee}
                                    onChange={(e) => setSwapFee(e.target.value)}
                                />
                            </Field.Root>
                        </HStack>
                        {swapFeeError !== '' && (
                            <Text fontSize="14px" color="hg.danger.text">{swapFeeError}</Text>
                        )}
                    </VStack>

                    <VStack align="stretch" gap="8px">
                        <Text fontSize="13px" fontWeight="600" color="hg.text.secondary">Where the fees go</Text>
                        <FeeSplitSlider value={feeSplit} onChange={setFeeSplit} />
                    </VStack>
                </VStack>
            </Question>

            {panelProps ? (
                <TxPanel {...panelProps} />
            ) : (
                <ReviewStep
                    {...steps.step('review')}
                    question="Everything right?"
                    leaves={payRows}
                    moduleFee={fee}
                    txKind={CREATE_POOL_TX_KIND}
                    isLoading={isFeeLoading}
                    feeUnknown={!fee}
                    gets={[{ label: VOCABULARY.pool.name, value: pair }]}
                    extra={[{ label: 'Swap fee', value: feeSummary }]}
                    permanent={["This action can't be undone"]}
                    submitLabel="Create pool"
                    onSubmit={create}
                    disabled={!canCreate}
                    onBack={steps.back}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet.</SubmitNote>
                    ) : isComplete && !isFeeBalanceLoading && !canPayFee && (
                        <SubmitNote tone="error">{notEnoughText(feeTicker, feeBalanceText)}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function PoolNewPage() {
    return (
        <FormPage>
            <PoolNewContent />
        </FormPage>
    )
}
