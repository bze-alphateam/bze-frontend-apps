"use client"

import React, { useMemo } from 'react'
import { Box, Button, Grid, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuCopy, LuPlus } from 'react-icons/lu'
import {
    Market,
    HgCard,
    Shimmer,
    TokenLogo,
    createMarketId,
    getChainName,
    AppLink,
    getDexApp,
    useAsset,
    useLiquidityPools,
    useMarkets,
    useToast,
} from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import { useChain } from '@interchain-kit/react'
import { useNavigation } from '@/hooks/useNavigation'
import { softButton } from '@/components/ui/soft-button'


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
        <HgCard px="14px" py="12px" borderRadius="14px">
            <HStack justify="space-between" align="center" gap="12px" flexWrap="wrap">{children}</HStack>
        </HgCard>
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
            <HStack gap="12px" minW={0} flex="1">
                {logos}
                <VStack align="start" gap="2px" minW={0}>
                    <HStack gap="8px" flexWrap="wrap">
                        <Text as="strong" fontWeight="700" fontSize="14px" wordBreak="break-all">{pair}</Text>
                        <Text fontSize="12px" color="fg.muted">{fee}</Text>
                    </HStack>
                    <HStack gap="4px" minW={0} maxW="full">
                        <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" truncate>{pool.lp_denom}</Text>
                        <IconButton aria-label="Copy LP denom" size="2xs" variant="ghost" color="hg.link" onClick={copyLpDenom}>
                            <LuCopy />
                        </IconButton>
                    </HStack>
                </VStack>
            </HStack>
            <HStack gap="6px" flexWrap="wrap">
                <Button {...softButton} size="xs" h="30px" fontSize="12px" onClick={() => navigate(`/pool/add?pool=${encodeURIComponent(pool.id)}`)}>
                    <LuPlus /> Add liquidity
                </Button>
                <AppLink app="dex" href={`${getDexApp().href}/pools/details?id=${encodeURIComponent(pool.id)}`}>DEX</AppLink>
            </HStack>
        </Row>
    )
}

function MarketRow({ market }: { market: Market }) {
    const { logos, pair } = usePair(market.base, market.quote)
    const marketId = createMarketId(market.base, market.quote)

    return (
        <Row>
            <HStack gap="12px" minW={0} flex="1">
                {logos}
                <VStack align="start" gap="2px" minW={0} maxW="full">
                    <Text as="strong" fontWeight="700" fontSize="14px" wordBreak="break-all">{pair}</Text>
                    <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" truncate maxW="full">{marketId}</Text>
                </VStack>
            </HStack>
            <AppLink app="dex" href={`${getDexApp().href}/exchange/market?id=${encodeURIComponent(marketId)}`}>DEX</AppLink>
        </Row>
    )
}

function GroupHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
    return (
        <HStack justify="space-between" gap="8px">
            <Text fontSize="14px" fontWeight="600" color="fg.muted">{title}</Text>
            <Button size="xs" h="30px" variant="ghost" color="hg.link" fontWeight="600" fontSize="13px" onClick={onAction}>
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
        <VStack as="section" aria-label="Markets and pools you created" align="stretch" gap="14px">
            <Text as="h2" fontSize="20px" fontWeight="700">Markets and pools you created</Text>

            {isLoading ? (
                <VStack align="stretch" gap="8px" aria-busy="true">
                    <Shimmer h="56px" borderRadius="14px" />
                    <Shimmer h="56px" borderRadius="14px" />
                </VStack>
            ) : myPools.length === 0 && myMarkets.length === 0 ? (
                <HgCard p="22px" display="flex" flexDirection="column" alignItems="center" gap="12px">
                    <Text fontSize="14px" color="fg.muted" textAlign="center">{"You haven't created a market or pool yet."}</Text>
                    <HStack gap="8px" flexWrap="wrap" justify="center">
                        <Button {...softButton} onClick={() => navigate('/pool/new')}>
                            <LuPlus /> Create a pool
                        </Button>
                        <Button {...softButton} onClick={() => navigate('/market/new')}>
                            <LuPlus /> Create a market
                        </Button>
                    </HStack>
                </HgCard>
            ) : (
                <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
                    <VStack align="stretch" gap="10px" data-testid="created-pools">
                        <GroupHeader title={`Pools (${myPools.length})`} action="New pool" onAction={() => navigate('/pool/new')} />
                        {myPools.length === 0
                            ? <Text fontSize="14px" color="hg.text.faint">No pools yet</Text>
                            : myPools.map(pool => <PoolRow key={pool.id} pool={pool} />)}
                    </VStack>
                    <VStack align="stretch" gap="10px" data-testid="created-markets">
                        <GroupHeader title={`Markets (${myMarkets.length})`} action="New market" onAction={() => navigate('/market/new')} />
                        {myMarkets.length === 0
                            ? <Text fontSize="14px" color="hg.text.faint">No markets yet</Text>
                            : myMarkets.map(m => <MarketRow key={createMarketId(m.base, m.quote)} market={m} />)}
                    </VStack>
                </Grid>
            )}
        </VStack>
    )
}
