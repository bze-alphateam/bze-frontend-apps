"use client"

import React, { useMemo } from 'react'
import {
    Box,
    Button,
    Card,
    HStack,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import { LuArrowUpRight, LuChartCandlestick, LuPlus } from 'react-icons/lu'
import {
    Market,
    TokenLogo,
    createMarketId,
    getChainName,
    getEcosystemApps,
    useAsset,
    useMarkets,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useNavigation } from '@/hooks/useNavigation'

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

function MarketRow({ market }: { market: Market }) {
    const { asset: baseAsset } = useAsset(market.base)
    const { asset: quoteAsset } = useAsset(market.quote)

    const marketId = createMarketId(market.base, market.quote)
    const dexUrl = getEcosystemApps().find(app => app.key === 'dex')?.href ?? 'https://dex.getbze.com'
    const marketUrl = `${dexUrl}/exchange/market?id=${encodeURIComponent(marketId)}`

    return (
        <Card.Root
            variant="outline"
            p="4"
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderColor="yellow.500/20"
        >
            <HStack justify="space-between" align="center" gap={4} flexWrap="wrap">
                <HStack gap="3" minW="0">
                    <HStack gap="0">
                        <TokenLogo src={baseAsset?.logo ?? ''} symbol={baseAsset?.ticker ?? '?'} size="10" circular={true} />
                        <Box ml="-3">
                            <TokenLogo src={quoteAsset?.logo ?? ''} symbol={quoteAsset?.ticker ?? '?'} size="10" circular={true} />
                        </Box>
                    </HStack>
                    <VStack align="start" gap="0.5" minW="0">
                        <Text fontWeight="semibold">
                            {baseAsset?.ticker ?? market.base}/{quoteAsset?.ticker ?? market.quote}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate maxW={{ base: '52', md: 'md' }}>
                            {marketId}
                        </Text>
                    </VStack>
                </HStack>

                <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => openExternal(marketUrl)}>
                    View on DEX <LuArrowUpRight />
                </Button>
            </HStack>
        </Card.Root>
    )
}

function MarketRowSkeleton() {
    return (
        <Card.Root variant="outline" p="4">
            <HStack justify="space-between" align="center" gap={4}>
                <HStack gap="3">
                    <Skeleton borderRadius="full" boxSize="10" />
                    <VStack align="start" gap="2">
                        <Skeleton height="4" width="24" />
                        <Skeleton height="3" width="48" />
                    </VStack>
                </HStack>
                <Skeleton height="6" width="24" />
            </HStack>
        </Card.Root>
    )
}

/** The markets the connected address opened on the DEX (creator is on-chain). */
export function MyMarkets() {
    const { markets, isLoading } = useMarkets()
    const { address } = useChain(getChainName())
    const { navigate } = useNavigation()

    const myMarkets = useMemo(
        () => (address ? markets.filter(m => m.creator === address) : []),
        [markets, address]
    )

    return (
        <VStack align="stretch" gap={4}>
            <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                <VStack align="start" gap={1}>
                    <Text fontSize="xl" fontWeight="bold" letterSpacing="tight">
                        My Markets
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        Order-book markets you opened on the DEX.
                    </Text>
                </VStack>
                <Button size="sm" colorPalette="yellow" variant="outline" onClick={() => navigate('/market/new')}>
                    <LuPlus />
                    New market
                </Button>
            </HStack>

            {isLoading ? (
                <VStack align="stretch" gap={3}>
                    <MarketRowSkeleton />
                </VStack>
            ) : myMarkets.length === 0 ? (
                <Card.Root variant="outline" p="8">
                    <VStack gap={4}>
                        <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                            <LuChartCandlestick size={24} />
                        </Box>
                        <VStack gap={1}>
                            <Text fontWeight="semibold">No markets yet</Text>
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Open an order-book market on the DEX for any pair — including your own tokens.
                            </Text>
                        </VStack>
                        <Button colorPalette="yellow" variant="outline" onClick={() => navigate('/market/new')}>
                            <LuPlus />
                            Create a market
                        </Button>
                    </VStack>
                </Card.Root>
            ) : (
                <VStack align="stretch" gap={3}>
                    {myMarkets.map(market => (
                        <MarketRow key={createMarketId(market.base, market.quote)} market={market} />
                    ))}
                </VStack>
            )}
        </VStack>
    )
}
