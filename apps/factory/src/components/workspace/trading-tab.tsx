"use client"

import React, { useMemo } from 'react'
import { Badge, Box, Button, Card, HStack, IconButton, Skeleton, Stack, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuChartCandlestick, LuCopy, LuDroplets, LuPlus, LuSprout } from 'react-icons/lu'
import {
    HaltedNotice,
    Market,
    TokenLogo,
    createMarketId,
    getChainName,
    AppLink,
    getDexApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useLiquidityPools,
    useMarkets,
    useToast,
} from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import { useChain } from '@interchain-kit/react'
import { withReturn, type ReturnTo } from '@/components/guided/return-to'
import { VOCABULARY } from '@/lib/vocabulary'
import { workspaceHref } from '@/lib/workspace'
import type { WorkspaceTabProps } from './types'


function PairLogos({ base, quote }: { base?: { logo: string; ticker: string }; quote?: { logo: string; ticker: string } }) {
    return (
        <HStack gap="0" flexShrink={0}>
            <TokenLogo src={base?.logo ?? ''} symbol={base?.ticker ?? '?'} size="10" circular={true} />
            <Box ml="-3">
                <TokenLogo src={quote?.logo ?? ''} symbol={quote?.ticker ?? '?'} size="10" circular={true} />
            </Box>
        </HStack>
    )
}

function CreatedBadge() {
    return <Badge size="sm" colorPalette="yellow" variant="surface">You created it</Badge>
}

interface RowProps {
    address?: string;
    back: ReturnTo;
    isHalted: boolean;
    goTo: (href: string) => void;
}

function PoolCard({ pool, address, back, isHalted, goTo }: RowProps & { pool: LiquidityPoolSDKType }) {
    const { asset: baseAsset } = useAsset(pool.base)
    const { asset: quoteAsset } = useAsset(pool.quote)
    const { toast } = useToast()

    const baseTicker = baseAsset?.ticker ?? pool.base
    const quoteTicker = quoteAsset?.ticker ?? pool.quote
    // The chain stores the fee as a decimal (e.g. "0.002" = 0.2%).
    const feeLabel = `${new BigNumber(pool.fee).multipliedBy(100).toString()}%`
    const pairHalted = isHalted || Boolean(baseAsset?.halted || quoteAsset?.halted)

    const copyLpDenom = async () => {
        await navigator.clipboard.writeText(pool.lp_denom)
        toast.success('LP denom copied')
    }

    return (
        <Card.Root variant="outline" p="4" data-testid={`trading-pool-${pool.id}`}>
            <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={4}>
                <HStack gap="3" minW="0" align="start">
                    <PairLogos base={baseAsset} quote={quoteAsset} />
                    <VStack align="start" gap="0.5" minW="0">
                        <HStack gap="2" flexWrap="wrap">
                            <Text fontWeight="semibold">{`${baseTicker}/${quoteTicker}`}</Text>
                            <Text fontSize="sm" color="fg.muted">{`${feeLabel} swap fee`}</Text>
                            {address && pool.creator === address && <CreatedBadge />}
                        </HStack>
                        <Text fontSize="xs" color="fg.muted" data-testid="pool-reserves">
                            {`${prettyAmount(uAmountToBigNumberAmount(pool.reserve_base, baseAsset?.decimals ?? 0))} ${baseTicker} + ${prettyAmount(uAmountToBigNumberAmount(pool.reserve_quote, quoteAsset?.decimals ?? 0))} ${quoteTicker}`}
                        </Text>
                        <HStack gap="1" minW="0" maxW="full">
                            <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate maxW={{ base: '48', md: 'sm' }}>
                                {pool.lp_denom}
                            </Text>
                            <IconButton aria-label="Copy LP denom" size="2xs" variant="ghost" colorPalette="yellow" onClick={copyLpDenom}>
                                <LuCopy />
                            </IconButton>
                        </HStack>
                    </VStack>
                </HStack>

                <HStack gap={2} flexWrap="wrap" flexShrink={0}>
                    {!pairHalted && (
                        <Button
                            size="sm"
                            variant="outline"
                            colorPalette="yellow"
                            onClick={() => goTo(withReturn(`/pool/add?pool=${encodeURIComponent(pool.id)}`, back))}
                        >
                            <LuPlus /> Add liquidity
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        colorPalette="yellow"
                        onClick={() => goTo(withReturn(`/reward/new?staking=${encodeURIComponent(pool.lp_denom)}`, back))}
                    >
                        <LuSprout /> Reward liquidity providers
                    </Button>
                    <AppLink app="dex" href={`${getDexApp().href}/pools/details?id=${encodeURIComponent(pool.id)}`}>DEX</AppLink>
                </HStack>
            </Stack>
        </Card.Root>
    )
}

function MarketCard({ market, address }: Pick<RowProps, 'address'> & { market: Market }) {
    const { asset: baseAsset } = useAsset(market.base)
    const { asset: quoteAsset } = useAsset(market.quote)
    const marketId = createMarketId(market.base, market.quote)

    return (
        <Card.Root variant="outline" p="4" data-testid={`trading-market-${marketId}`}>
            <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={4}>
                <HStack gap="3" minW="0">
                    <PairLogos base={baseAsset} quote={quoteAsset} />
                    <VStack align="start" gap="0.5" minW="0">
                        <HStack gap="2" flexWrap="wrap">
                            <Text fontWeight="semibold">{`${baseAsset?.ticker ?? market.base}/${quoteAsset?.ticker ?? market.quote}`}</Text>
                            {address && market.creator === address && <CreatedBadge />}
                        </HStack>
                        <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate maxW={{ base: '56', md: 'md' }}>
                            {marketId}
                        </Text>
                    </VStack>
                </HStack>
                <Box flexShrink={0}>
                    <AppLink app="dex" href={`${getDexApp().href}/exchange/market?id=${encodeURIComponent(marketId)}`}>DEX</AppLink>
                </Box>
            </Stack>
        </Card.Root>
    )
}

function RowSkeletons() {
    return (
        <VStack align="stretch" gap={3} data-testid="trading-skeleton">
            {[0, 1].map(i => (
                <Card.Root key={i} variant="outline" p="4">
                    <HStack gap="3">
                        <Skeleton borderRadius="full" boxSize="10" />
                        <VStack align="start" gap="2" flex="1">
                            <Skeleton height="4" width="32" />
                            <Skeleton height="3" width="48" />
                        </VStack>
                    </HStack>
                </Card.Root>
            ))}
        </VStack>
    )
}

function EmptyCard({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
    return (
        <Card.Root variant="outline" p="6">
            <VStack gap={3}>
                <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">{icon}</Box>
                <Text fontSize="sm" color="fg.muted" textAlign="center">{text}</Text>
                {children}
            </VStack>
        </Card.Root>
    )
}

/**
 * Where the token trades: every pool and order-book market with it on either side, whoever
 * created it. Form links come back to this tab; a halted token gets no create or add buttons.
 */
export function TradingTab({ asset, goTo }: WorkspaceTabProps) {
    const { address } = useChain(getChainName())
    const { pools: allPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { markets: allMarkets, isLoading: isMarketsLoading } = useMarkets()

    const denom = asset.denom
    const ticker = asset.ticker
    const isHalted = Boolean(asset.halted)
    const back: ReturnTo = { href: workspaceHref(denom, 'trading'), label: ticker }
    const newPoolHref = withReturn(`/pool/new?base=${encodeURIComponent(denom)}`, back)
    const newMarketHref = withReturn(`/market/new?base=${encodeURIComponent(denom)}`, back)

    const pools = useMemo(() => allPools.filter(p => p.base === denom || p.quote === denom), [allPools, denom])
    const markets = useMemo(() => allMarkets.filter(m => m.base === denom || m.quote === denom), [allMarkets, denom])

    return (
        <VStack align="stretch" gap={8}>
            {isHalted && (
                <HaltedNotice tickers={[ticker]}>
                    New pools, markets and liquidity are refused. Existing positions can still be removed on the DEX.
                </HaltedNotice>
            )}

            <VStack as="section" aria-label="Pools" align="stretch" gap={3}>
                <HStack justify="space-between" gap={3} flexWrap="wrap">
                    <VStack align="start" gap={0.5}>
                        <Text fontWeight="semibold" fontSize="lg">Pools</Text>
                        <Text fontSize="sm" color="fg.muted">{`${VOCABULARY.pool.name}s let people swap ${ticker}.`}</Text>
                    </VStack>
                    {!isHalted && !isPoolsLoading && pools.length > 0 && (
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => goTo(newPoolHref)}>
                            <LuPlus /> Create another pool
                        </Button>
                    )}
                </HStack>
                {isPoolsLoading ? (
                    <RowSkeletons />
                ) : pools.length === 0 ? (
                    <EmptyCard icon={<LuDroplets size={24} />} text={`Nobody can buy ${ticker} yet.`}>
                        {!isHalted && (
                            <Button colorPalette="yellow" onClick={() => goTo(newPoolHref)}>
                                <LuDroplets /> {`Create a ${ticker} pool`}
                            </Button>
                        )}
                    </EmptyCard>
                ) : (
                    <VStack align="stretch" gap={3}>
                        {pools.map(pool => (
                            <PoolCard key={pool.id} pool={pool} address={address} back={back} isHalted={isHalted} goTo={goTo} />
                        ))}
                    </VStack>
                )}
            </VStack>

            <VStack as="section" aria-label="Order-book markets" align="stretch" gap={3}>
                <VStack align="start" gap={0.5}>
                    <Text fontWeight="semibold" fontSize="lg">Order-book markets</Text>
                    <Text fontSize="sm" color="fg.muted">{`Traders place limit orders on ${ticker} here.`}</Text>
                </VStack>
                {isMarketsLoading ? (
                    <RowSkeletons />
                ) : markets.length === 0 ? (
                    <EmptyCard icon={<LuChartCandlestick size={24} />} text="No order book yet. Optional: traders can place limit orders on one.">
                        {!isHalted && (
                            <Button colorPalette="yellow" variant="outline" onClick={() => goTo(newMarketHref)}>
                                <LuChartCandlestick /> Create a market
                            </Button>
                        )}
                    </EmptyCard>
                ) : (
                    <VStack align="stretch" gap={3}>
                        {markets.map(market => (
                            <MarketCard key={createMarketId(market.base, market.quote)} market={market} address={address} />
                        ))}
                    </VStack>
                )}
            </VStack>
        </VStack>
    )
}
