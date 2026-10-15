"use client"

import React, { useMemo } from 'react'
import { Box, Button, Card, HStack, IconButton, Skeleton, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuArrowUpRight, LuCopy, LuPlus } from 'react-icons/lu'
import {
    Market,
    TokenLogo,
    createMarketId,
    getChainName,
    getDexApp,
    useAsset,
    useLiquidityPools,
    useMarkets,
    useToast,
} from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import { useChain } from '@interchain-kit/react'
import { useNavigation } from '@/hooks/useNavigation'

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

function usePair(base: string, quote: string) {
    const { asset: baseAsset } = useAsset(base)
    const { asset: quoteAsset } = useAsset(quote)
    return {
        logos: (
            <HStack gap="0" flexShrink={0}>
                <TokenLogo src={baseAsset?.logo ?? ''} symbol={baseAsset?.ticker ?? '?'} size="8" circular={true} />
                <Box ml="-2.5">
                    <TokenLogo src={quoteAsset?.logo ?? ''} symbol={quoteAsset?.ticker ?? '?'} size="8" circular={true} />
                </Box>
            </HStack>
        ),
        // The raw denom when the asset list doesn't know the token.
        pair: `${baseAsset?.ticker ?? base}/${quoteAsset?.ticker ?? quote}`,
    }
}

function Row({ children }: { children: React.ReactNode }) {
    return (
        <Card.Root variant="outline" px={3} py={2.5}>
            <HStack justify="space-between" align="center" gap={3} flexWrap="wrap">{children}</HStack>
        </Card.Root>
    )
}

function PoolRow({ pool }: { pool: LiquidityPoolSDKType }) {
    const { logos, pair } = usePair(pool.base, pool.quote)
    const { toast } = useToast()
    const { navigate } = useNavigation()
    // The chain stores the fee as a decimal (e.g. "0.002" = 0.2%).
    const fee = `${new BigNumber(pool.fee).multipliedBy(100).toString()}% swap fee`

    const copyLpDenom = async () => {
        await navigator.clipboard.writeText(pool.lp_denom)
        toast.success('Copied', 'LP denom copied to clipboard.')
    }

    return (
        <Row>
            <HStack gap={3} minW={0} flex="1">
                {logos}
                <VStack align="start" gap={0} minW={0}>
                    <HStack gap={2} flexWrap="wrap">
                        <Text fontWeight="semibold" fontSize="sm" wordBreak="break-all">{pair}</Text>
                        <Text fontSize="xs" color="fg.muted">{fee}</Text>
                    </HStack>
                    <HStack gap={1} minW={0} maxW="full">
                        <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate>{pool.lp_denom}</Text>
                        <IconButton aria-label="Copy LP denom" size="2xs" variant="ghost" colorPalette="yellow" onClick={copyLpDenom}>
                            <LuCopy />
                        </IconButton>
                    </HStack>
                </VStack>
            </HStack>
            <HStack gap={1} flexWrap="wrap">
                <Button size="xs" variant="outline" colorPalette="yellow" onClick={() => navigate(`/pool/add?pool=${encodeURIComponent(pool.id)}`)}>
                    <LuPlus /> Add liquidity
                </Button>
                <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="yellow"
                    onClick={() => openExternal(`${getDexApp().href}/pools/details?id=${encodeURIComponent(pool.id)}`)}
                >
                    View on DEX <LuArrowUpRight />
                </Button>
            </HStack>
        </Row>
    )
}

function MarketRow({ market }: { market: Market }) {
    const { logos, pair } = usePair(market.base, market.quote)
    const marketId = createMarketId(market.base, market.quote)

    return (
        <Row>
            <HStack gap={3} minW={0} flex="1">
                {logos}
                <VStack align="start" gap={0} minW={0} maxW="full">
                    <Text fontWeight="semibold" fontSize="sm" wordBreak="break-all">{pair}</Text>
                    <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate maxW="full">{marketId}</Text>
                </VStack>
            </HStack>
            <Button
                size="xs"
                variant="ghost"
                colorPalette="yellow"
                onClick={() => openExternal(`${getDexApp().href}/exchange/market?id=${encodeURIComponent(marketId)}`)}
            >
                View on DEX <LuArrowUpRight />
            </Button>
        </Row>
    )
}

function GroupHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
    return (
        <HStack justify="space-between" gap={2}>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">{title}</Text>
            <Button size="xs" variant="ghost" colorPalette="yellow" onClick={onAction}>
                <LuPlus /> {action}
            </Button>
        </HStack>
    )
}

/** "Markets and pools you created": every pair, filtered by the on-chain creator. */
export function CreatedByYou() {
    const { pools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { markets, isLoading: isMarketsLoading } = useMarkets()
    const { address } = useChain(getChainName())
    const { navigate } = useNavigation()

    const myPools = useMemo(() => (address ? pools.filter(p => p.creator === address) : []), [pools, address])
    const myMarkets = useMemo(() => (address ? markets.filter(m => m.creator === address) : []), [markets, address])
    const isLoading = isPoolsLoading || isMarketsLoading

    return (
        <VStack as="section" aria-label="Markets and pools you created" align="stretch" gap={3}>
            <Text as="h2" fontSize="lg" fontWeight="bold" letterSpacing="tight">Markets and pools you created</Text>

            {isLoading ? (
                <VStack align="stretch" gap={2}>
                    <Skeleton height="14" borderRadius="lg" />
                    <Skeleton height="14" borderRadius="lg" />
                </VStack>
            ) : myPools.length === 0 && myMarkets.length === 0 ? (
                <Card.Root variant="outline" p={6}>
                    <VStack gap={3}>
                        <Text fontSize="sm" color="fg.muted" textAlign="center">{"You haven't created a market or pool yet."}</Text>
                        <HStack gap={2} flexWrap="wrap" justify="center">
                            <Button size="sm" colorPalette="yellow" variant="outline" onClick={() => navigate('/pool/new')}>
                                <LuPlus /> Create a pool
                            </Button>
                            <Button size="sm" colorPalette="yellow" variant="outline" onClick={() => navigate('/market/new')}>
                                <LuPlus /> Create a market
                            </Button>
                        </HStack>
                    </VStack>
                </Card.Root>
            ) : (
                <VStack align="stretch" gap={4}>
                    <VStack align="stretch" gap={2} data-testid="created-pools">
                        <GroupHeader title={`Pools (${myPools.length})`} action="New pool" onAction={() => navigate('/pool/new')} />
                        {myPools.length === 0
                            ? <Text fontSize="sm" color="fg.muted">No pools yet</Text>
                            : myPools.map(pool => <PoolRow key={pool.id} pool={pool} />)}
                    </VStack>
                    <VStack align="stretch" gap={2} data-testid="created-markets">
                        <GroupHeader title={`Markets (${myMarkets.length})`} action="New market" onAction={() => navigate('/market/new')} />
                        {myMarkets.length === 0
                            ? <Text fontSize="sm" color="fg.muted">No markets yet</Text>
                            : myMarkets.map(m => <MarketRow key={createMarketId(m.base, m.quote)} market={m} />)}
                    </VStack>
                </VStack>
            )}
        </VStack>
    )
}
