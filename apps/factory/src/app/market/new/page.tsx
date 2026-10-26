"use client"

import React, { useCallback, useMemo, useState } from 'react'
import { VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import {
    AppLink,
    GradientText,
    getChainName,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useCreationFees,
    useMarkets,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { AssetPicker } from '@/components/ui/asset-picker'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { type WizardTxDone, useWizardTx } from '@/hooks/useWizardTx'
import { MarketDone, type MarketDoneInput } from '@/components/market-wizard/market-done'
import {
    BlockerNote,
    FormPage,
    GuidedForm,
    PayPanel,
    Question,
    ReviewStep,
    SubmitNote,
    TxPanel,
    useGuidedSteps,
} from '@/components/guided'
import { dexMarketHref } from '@/lib/create-routes'
import { notEnoughText } from '@/lib/format'
import { createMarketMsgValue, marketPairProblem } from '@/lib/market-new'
import { VOCABULARY } from '@/lib/vocabulary'

const { createMarket } = bze.tradebin.MessageComposer.withTypeUrl

const CREATE_MARKET_TX_KIND = 'create-market'
const STEP_KEYS = ['pair', 'review'] as const

function MarketNewContent() {
    const { address } = useChain(getChainName())
    const { marketExists, updateMarkets, isLoading: isMarketsLoading } = useMarkets()
    const { fees, isLoading: isFeeLoading } = useCreationFees()

    // Chaining links (the token and pool Done screens, the Choose screen) preselect the pair.
    const { getQueryParam } = useNavigationWithParams()
    const [baseDenom, setBaseDenom] = useState(() => getQueryParam('base') ?? '')
    const [quoteDenom, setQuoteDenom] = useState(() => getQueryParam('quote') ?? '')
    // A deep link with both sides lands on Review (the pair still has to pass its checks).
    const [pairAnswered, setPairAnswered] = useState(() => Boolean(getQueryParam('base') && getQueryParam('quote')))
    const [done, setDone] = useState<{ input: MarketDoneInput; hash: string } | undefined>(undefined)

    // Looked up rather than captured from the picker, so query-param preselects resolve too.
    const { asset: baseAsset } = useAsset(baseDenom)
    const { asset: quoteAsset } = useAsset(quoteDenom)

    const fee = fees.createMarketFee
    const { canPayFee, isLoading: isBalanceLoading } = useFeePayment(fee, CREATE_MARKET_TX_KIND)
    const { asset: feeAsset } = useAsset(fee?.denom ?? '')
    const { balance: feeBalance } = useBalance(fee?.denom ?? '')

    const connected = Boolean(address)
    const baseTicker = baseAsset?.ticker ?? ''
    const quoteTicker = quoteAsset?.ticker ?? ''
    const pair = baseTicker && quoteTicker ? `${baseTicker}/${quoteTicker}` : ''

    const problem = useMemo(
        () => marketPairProblem(baseDenom, quoteDenom, baseAsset, quoteAsset, marketExists),
        [baseDenom, quoteDenom, baseAsset, quoteAsset, marketExists],
    )
    const isPairValid = Boolean(baseAsset) && Boolean(quoteAsset) && problem === undefined

    const steps = useGuidedSteps(STEP_KEYS, {
        pair: pairAnswered && isPairValid,
        review: false,
    })

    const answerPair = () => {
        setPairAnswered(true)
        steps.close()
    }

    const buildMsgs = useCallback(() => {
        if (!address || !baseDenom || !quoteDenom) return undefined
        return [createMarket(createMarketMsgValue({ creator: address, baseDenom, quoteDenom }))]
    }, [address, baseDenom, quoteDenom])

    const onDone = useCallback(({ input, hash }: WizardTxDone<MarketDoneInput>) => {
        // The new market joins the list, so its pair now reads as taken.
        void updateMarkets()
        if (input) setDone({ input, hash })
    }, [updateMarkets])
    const { submit, panelProps } = useWizardTx<MarketDoneInput>(buildMsgs, { title: `Create market ${pair}`, onDone })

    if (done) return <MarketDone input={done.input} hash={done.hash} />

    const isComplete = steps.state.pair === 'done'
    const canCreate = isComplete && connected && Boolean(fee) && !isBalanceLoading && canPayFee && !isMarketsLoading

    const create = () => {
        if (!canCreate) return
        submit({ base: baseDenom, quote: quoteDenom, baseTicker, quoteTicker })
    }

    const feeTicker = feeAsset?.ticker ?? fee?.denom ?? ''
    const feeBalanceText = prettyAmount(uAmountToBigNumberAmount(feeBalance.amount, feeAsset?.decimals ?? 6))
    const payRows = [{ label: 'Creation fee', coin: fee }]

    const aside = (
        <PayPanel
            rows={payRows}
            moduleFee={fee}
            txKind={CREATE_MARKET_TX_KIND}
            isLoading={isFeeLoading}
            feeUnknown={!fee}
        />
    )

    return (
        <GuidedForm
            crumb="Order-book market"
            title={<>Create an <GradientText>order-book market</GradientText></>}
            subtitle="Open an order book on the DEX."
            aside={aside}
        >
            <Question
                title="Pair"
                question="Which pair?"
                {...steps.step('pair')}
                summary={baseTicker && quoteTicker ? `${baseTicker} priced in ${quoteTicker}` : ''}
                action={{ label: 'Continue', onClick: answerPair, disabled: !isPairValid }}
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
                            action={problem.existingMarketId && (
                                <AppLink app="dex" href={dexMarketHref(getDexApp().href, problem.existingMarketId)}>
                                    Open it on the DEX
                                </AppLink>
                            )}
                        >
                            {problem.message}
                        </BlockerNote>
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
                    moduleFee={fee}
                    txKind={CREATE_MARKET_TX_KIND}
                    isLoading={isFeeLoading}
                    feeUnknown={!fee}
                    gets={[{ label: VOCABULARY.market.name, value: pair }]}
                    permanent={["This action can't be undone"]}
                    submitLabel="Create market"
                    onSubmit={create}
                    disabled={!canCreate}
                    onBack={steps.back}
                >
                    {!address ? (
                        <SubmitNote>Connect your wallet.</SubmitNote>
                    ) : isComplete && !isBalanceLoading && !canPayFee && (
                        <SubmitNote tone="error">{notEnoughText(feeTicker, feeBalanceText)}</SubmitNote>
                    )}
                </ReviewStep>
            )}
        </GuidedForm>
    )
}

export default function MarketNewPage() {
    return (
        <FormPage>
            <MarketNewContent />
        </FormPage>
    )
}
