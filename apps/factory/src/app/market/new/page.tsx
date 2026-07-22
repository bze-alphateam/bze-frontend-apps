"use client"

import React, { Suspense, useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Container,
    HStack,
    Separator,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import {
    LuArrowLeft,
    LuArrowUpRight,
    LuChartCandlestick,
    LuCircleCheck,
    LuDroplets,
    LuPlus,
} from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    createMarketId,
    getChainExplorerURL,
    getChainName,
    getDexApp,
    useAsset,
    useCreationFees,
    useMarkets,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { AssetPicker } from '@/components/ui/asset-picker'
import { FeeDisclosure } from '@/components/ui/fee-disclosure'
import { InfoBox } from '@/components/ui/info-box'
import { useFeePayment } from '@/hooks/useFeePayment'
import { useNavigationWithParams } from '@/hooks/useNavigation'

const { createMarket } = bze.tradebin.MessageComposer.withTypeUrl

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

function MarketNewContent() {
    const { getQueryParam, navigate } = useNavigationWithParams()
    const { address } = useChain(getChainName())
    const { marketExists, updateMarkets, isLoading: isMarketsLoading } = useMarkets()
    const { fees, isLoading: isFeeLoading } = useCreationFees()
    const { tx } = useFactoryTx()

    // Chaining links (e.g. the token wizard's success screen) preselect the pair.
    const [baseDenom, setBaseDenom] = useState(() => getQueryParam('base') ?? '')
    const [quoteDenom, setQuoteDenom] = useState(() => getQueryParam('quote') ?? '')
    // Looked up rather than captured from the picker, so query-param preselects
    // (where onSelect never fires) resolve to full assets too.
    const { asset: baseAsset } = useAsset(baseDenom)
    const { asset: quoteAsset } = useAsset(quoteDenom)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [created, setCreated] = useState<{ txHash: string } | undefined>(undefined)

    const fee = fees.createMarketFee
    const { canPayFee, isLoading: isBalanceLoading } = useFeePayment(fee)

    // The pair must not exist in EITHER direction — the chain would reject the
    // reversed pair too, so catch it here as a friendly form error instead.
    const error = useMemo(() => {
        if (!baseDenom || !quoteDenom) return ''
        if (baseDenom === quoteDenom) {
            return 'Base and quote must be different assets.'
        }
        if (marketExists(createMarketId(baseDenom, quoteDenom)) || marketExists(createMarketId(quoteDenom, baseDenom))) {
            return 'A market for this pair already exists on the DEX — every pair can have only one order book.'
        }
        return ''
    }, [baseDenom, quoteDenom, marketExists])

    const isComplete = Boolean(baseDenom) && Boolean(quoteDenom) && error === ''
    const canConfirm = isComplete && Boolean(address) && Boolean(fee) &&
        !isBalanceLoading && canPayFee && !isMarketsLoading

    const pairLabel = baseAsset && quoteAsset ? `${baseAsset.ticker}/${quoteAsset.ticker}` : ''

    const submit = async () => {
        if (!address || !canConfirm) return

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
    }

    if (created) {
        const dexUrl = getDexApp().href
        const marketUrl = `${dexUrl}/exchange/market?id=${encodeURIComponent(createMarketId(baseDenom, quoteDenom))}`
        const txUrl = `${getChainExplorerURL(getChainName())}/tx/${created.txHash}`

        return (
            <VStack align="stretch" gap={6} py={{ base: 4, md: 8 }}>
                <VStack gap={3} align="center">
                    <Box color="green.500">
                        <LuCircleCheck size={56} />
                    </Box>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        The {pairLabel} market is live!
                    </Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Anyone can now place {baseAsset?.ticker ?? 'base'} orders priced
                        in {quoteAsset?.ticker ?? 'quote'} on the DEX order book.
                    </Text>
                </VStack>

                <HStack gap={3} justify="center" wrap="wrap">
                    <Button colorPalette="yellow" onClick={() => openExternal(marketUrl)}>
                        View market on DEX <LuArrowUpRight />
                    </Button>
                    <Button variant="outline" colorPalette="yellow" onClick={() => openExternal(txUrl)}>
                        View transaction <LuArrowUpRight />
                    </Button>
                </HStack>

                <VStack align="stretch" gap={3}>
                    <Text fontSize="sm" color="fg.muted" fontWeight="medium" textAlign="center">
                        What&apos;s next?
                    </Text>
                    {/* A market starts empty — the natural next step is liquidity. */}
                    <HStack gap={3} justify="center" wrap="wrap">
                        <Button
                            variant="outline"
                            colorPalette="yellow"
                            size="sm"
                            onClick={() => navigate(`/pool/new?base=${encodeURIComponent(baseDenom)}&quote=${encodeURIComponent(quoteDenom)}`)}
                        >
                            <LuDroplets />
                            Create a liquidity pool
                        </Button>
                        <Button variant="outline" colorPalette="yellow" size="sm" onClick={createAnother}>
                            <LuPlus />
                            Create another market
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
                    <LuChartCandlestick size={22} />
                </Box>
                <VStack align="start" gap={0}>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        Create Market
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        Open an order-book market on the DEX for any pair of assets.
                    </Text>
                </VStack>
            </HStack>

            <Card.Root variant="outline" p={{ base: 5, md: 6 }}>
                <VStack align="stretch" gap={5}>
                    <AssetPicker
                        label="Base asset — the one being traded"
                        value={baseDenom}
                        excludeDenoms={quoteDenom ? [quoteDenom] : undefined}
                        onSelect={(asset) => setBaseDenom(asset.denom)}
                    />
                    <AssetPicker
                        label="Quote asset — the one it's priced in"
                        value={quoteDenom}
                        excludeDenoms={baseDenom ? [baseDenom] : undefined}
                        ownFirst={false}
                        onSelect={(asset) => setQuoteDenom(asset.denom)}
                    />

                    {error !== '' && (
                        <Text fontSize="sm" color="fg.error" fontWeight="medium">
                            {error}
                        </Text>
                    )}

                    <InfoBox title="How a market works">
                        Orders on the {pairLabel || 'pair'} order book trade the base asset, priced in
                        the quote asset{quoteAsset ? ` (e.g. "1 ${baseAsset?.ticker ?? 'BASE'} costs X ${quoteAsset.ticker}")` : ''}.
                        Anyone can place orders once the market exists — creating it is a one-time,
                        permanent action, and every pair can have only one market.
                    </InfoBox>

                    <Separator />

                    <FeeDisclosure fee={fee} isLoading={isFeeLoading} label="Market creation fee" />

                    <VStack align="stretch" gap={2}>
                        <Button
                            size="lg"
                            colorPalette="yellow"
                            onClick={submit}
                            disabled={!canConfirm}
                            loading={isSubmitting}
                            loadingText="Waiting for signature..."
                        >
                            Create market
                        </Button>
                        {!address ? (
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Connect your wallet to create this market.
                            </Text>
                        ) : isComplete && !isBalanceLoading && !canPayFee && (
                            <Text fontSize="sm" color="fg.error" textAlign="center">
                                Not enough balance to cover the creation fee.
                            </Text>
                        )}
                    </VStack>
                </VStack>
            </Card.Root>
        </VStack>
    )
}

export default function MarketNewPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="2xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <MarketNewContent />
                </Suspense>
            </Container>
        </Box>
    )
}
