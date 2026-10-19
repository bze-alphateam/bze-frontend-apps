"use client"

import React, { useMemo, useState } from 'react'
import { Box, Text, VStack } from '@chakra-ui/react'
import { LuDroplets } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    AppLink,
    GradientText,
    createMarketId,
    getExplorerTxURL,
    getChainName,
    getDexApp,
    useAsset,
    useCreationFees,
    useMarkets,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { haltedPairError } from '@/lib/halted'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import {
    BlockerNote,
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

const { createMarket } = bze.tradebin.MessageComposer.withTypeUrl

const STEPS = ['base', 'quote'] as const

const marketUrl = (marketId: string) => `${getDexApp().href}/exchange/market?id=${encodeURIComponent(marketId)}`

function MarketNewContent() {
    const { getQueryParam } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const { address } = useChain(getChainName())
    const { marketExists, updateMarkets, isLoading: isMarketsLoading } = useMarkets()
    const { fees, isLoading: isFeeLoading } = useCreationFees()
    const { tx } = useFactoryTx()

    // Chaining links (e.g. the token success screen) preselect the pair.
    const [baseDenom, setBaseDenom] = useState(() => getQueryParam('base') ?? '')
    const [quoteDenom, setQuoteDenom] = useState(() => getQueryParam('quote') ?? '')
    // Looked up rather than captured from the picker, so query-param preselects
    // (where onSelect never fires) resolve to full assets too.
    const { asset: baseAsset } = useAsset(baseDenom)
    const { asset: quoteAsset } = useAsset(quoteDenom)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [created, setCreated] = useState<{ txHash: string } | undefined>(undefined)

    const fee = fees.createMarketFee
    const { canPayFee, isLoading: isBalanceLoading } = useFeePayment(fee, 'create-market')

    // The pair must not exist in EITHER direction — the chain would reject the
    // reversed pair too, so catch it here as a friendly form error instead.
    const pairError = useMemo((): { message: string; existingId?: string } | undefined => {
        if (!baseDenom || !quoteDenom) return undefined
        if (baseDenom === quoteDenom) {
            return { message: 'Base and quote must be different assets.' }
        }
        const halted = haltedPairError(baseAsset, quoteAsset)
        if (halted !== '') return { message: halted }
        const direct = createMarketId(baseDenom, quoteDenom)
        const reversed = createMarketId(quoteDenom, baseDenom)
        const existingId = marketExists(direct) ? direct : marketExists(reversed) ? reversed : undefined
        if (existingId) {
            return {
                message: 'A market for this pair already exists on the DEX — every pair can have only one order book.',
                existingId,
            }
        }
        return undefined
    }, [baseDenom, quoteDenom, marketExists, baseAsset, quoteAsset])

    const steps = useGuidedSteps(STEPS, {
        base: baseDenom !== '',
        quote: quoteDenom !== '' && pairError === undefined,
    })

    const isComplete = Boolean(baseDenom) && Boolean(quoteDenom) && pairError === undefined
    const canConfirm = isComplete && Boolean(address) && Boolean(fee) &&
        !isBalanceLoading && canPayFee && !isMarketsLoading

    const baseTicker = baseAsset?.ticker ?? baseDenom
    const quoteTicker = quoteAsset?.ticker ?? quoteDenom
    const pairLabel = baseTicker && quoteTicker ? `${baseTicker}/${quoteTicker}` : ''

    const submit = async () => {
        if (!address || !canConfirm) return

        // The user's order, not sorted: base is what trades, quote is what it's priced in.
        const msg = createMarket({ creator: address, base: baseDenom, quote: quoteDenom })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: (res) => {
                    setCreated({ txHash: res.txhash })
                    // Refresh the markets context so the duplicate check (and the
                    // rest of the ecosystem data) knows about the new market.
                    void updateMarkets()
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
        steps.close()
    }

    if (created) {
        const poolHref = `/pool/new?base=${encodeURIComponent(baseDenom)}&quote=${encodeURIComponent(quoteDenom)}`
        return (
            <SuccessPanel
                title={`The ${pairLabel} market is live!`}
                text={`Anyone can now place ${baseTicker} orders priced in ${quoteTicker} on the DEX order book.`}
                links={[
                    { label: 'DEX', href: marketUrl(createMarketId(baseDenom, quoteDenom)), app: 'dex' },
                    { label: 'Explorer', href: getExplorerTxURL(created.txHash), app: 'explorer' },
                ]}
                // A market starts empty — the natural next step is liquidity.
                next={[{ label: 'Create a liquidity pool', href: withReturn(poolHref, returnTo), icon: <LuDroplets /> }]}
                again={{ label: 'Create another market', onClick: createAnother }}
            />
        )
    }

    const aside = (
        <>
            <OutcomePanel>
                <VStack align="stretch" gap="8px">
                    <Text>
                        {pairLabel && isComplete
                            ? <>A {pairLabel} order book opens on the DEX. Anyone can place buy and sell orders on it; 1 {baseTicker} will cost whatever {quoteTicker} traders agree on.</>
                            : <>An order book for your pair opens on the DEX. Pick the asset being traded and the one it is priced in.</>}
                    </Text>
                    <Text fontSize="12px" lineHeight="1.45" color="hg.text.faint">
                        <Text as="span" fontWeight="600" color="hg.text.secondary">How a market works: </Text>
                        orders trade the base asset, priced in the quote asset
                        {baseAsset && quoteAsset ? ` ("1 ${baseTicker} costs X ${quoteTicker}")` : ''}.
                        Creating it is a one-time, permanent action, and every pair can have only one market.
                    </Text>
                </VStack>
            </OutcomePanel>

            <PayPanel
                rows={[{ label: 'Market creation fee', coin: fee }]}
                moduleFee={fee}
                txKind="create-market"
                isLoading={isFeeLoading}
                feeUnknown={!fee}
            />

            <SubmitBlock label="Create market" onClick={submit} disabled={!canConfirm} loading={isSubmitting}>
                {!address ? (
                    <SubmitNote>Connect your wallet to create this market.</SubmitNote>
                ) : isComplete && !isBalanceLoading && !canPayFee && (
                    <SubmitNote tone="error">Not enough balance to cover the creation fee.</SubmitNote>
                )}
            </SubmitBlock>
        </>
    )

    return (
        <GuidedForm
            title={<>Allow <GradientText>limit orders</GradientText></>}
            subtitle="Open an order book on the DEX so traders can buy and sell at the price they name."
            techTag="tradebin · order-book market"
            aside={aside}
        >
            <Question
                number={1}
                title="What is being traded?"
                state={steps.state.base}
                summary={baseTicker}
                onChange={() => steps.open('base')}
            >
                <AssetPicker
                    label="Base asset — the one being traded"
                    value={baseDenom}
                    excludeDenoms={quoteDenom ? [quoteDenom] : undefined}
                    excludeHalted
                    onSelect={(asset) => {
                        setBaseDenom(asset.denom)
                        steps.close()
                    }}
                />
            </Question>

            <Question
                number={2}
                title="What is it priced in?"
                state={steps.state.quote}
                summary={quoteTicker}
                onChange={() => steps.open('quote')}
            >
                <VStack align="stretch" gap="12px">
                    <AssetPicker
                        label="Quote asset — the one it's priced in"
                        value={quoteDenom}
                        excludeDenoms={baseDenom ? [baseDenom] : undefined}
                        excludeHalted
                        ownFirst={false}
                        onSelect={(asset) => {
                            setQuoteDenom(asset.denom)
                            steps.close()
                        }}
                    />
                    {pairError && (
                        <BlockerNote
                            action={pairError.existingId && (
                                <Box ms="-6px"><AppLink app="dex" href={marketUrl(pairError.existingId)}>DEX</AppLink></Box>
                            )}
                        >
                            {pairError.message}
                        </BlockerNote>
                    )}
                </VStack>
            </Question>
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
