"use client"

import React, { useMemo } from 'react'
import { Box, Button, chakra, HStack, IconButton, Stack, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuChartCandlestick, LuCopy, LuDroplets, LuPlus, LuSprout } from 'react-icons/lu'
import {
    HaltedNotice,
    HgCard,
    IconTile,
    Market,
    Shimmer,
    TokenLogo,
    createMarketId,
    getChainName,
    AppLink,
    getDexApp,
    hgVariant,
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
import { softButton } from '@/components/ui/soft-button'
import { VOCABULARY } from '@/lib/vocabulary'
import { workspaceHref } from '@/lib/workspace'
import { dexPoolHref } from '@/lib/create-routes'
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
    return (
        <chakra.span fontSize="11px" fontWeight="600" px="8px" py="3px" borderRadius="hg.pill" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border">
            You created it
        </chakra.span>
    )
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
        <HgCard as="article" px="20px" py="18px" data-testid={`trading-pool-${pool.id}`}>
            <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap="16px">
                <HStack gap="14px" minW="0" align="start">
                    <PairLogos base={baseAsset} quote={quoteAsset} />
                    <VStack align="start" gap="4px" minW="0">
                        <HStack gap="8px" flexWrap="wrap">
                            <Text as="strong" fontSize="16px" fontWeight="700">{`${baseTicker}/${quoteTicker}`}</Text>
                            <Text fontSize="13px" color="fg.muted">{`${feeLabel} swap fee`}</Text>
                            {address && pool.creator === address && <CreatedBadge />}
                        </HStack>
                        <Text fontSize="13px" color="fg.muted" data-testid="pool-reserves">
                            {`${prettyAmount(uAmountToBigNumberAmount(pool.reserve_base, baseAsset?.decimals ?? 0))} ${baseTicker} + ${prettyAmount(uAmountToBigNumberAmount(pool.reserve_quote, quoteAsset?.decimals ?? 0))} ${quoteTicker}`}
                        </Text>
                        <HStack gap="6px" minW="0" maxW="full">
                            <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" truncate maxW={{ base: '48', md: 'sm' }}>
                                {pool.lp_denom}
                            </Text>
                            <IconButton aria-label="Copy LP denom" size="2xs" variant="ghost" color="hg.link" onClick={copyLpDenom}>
                                <LuCopy />
                            </IconButton>
                        </HStack>
                    </VStack>
                </HStack>

                <HStack gap="8px" flexWrap="wrap" flexShrink={0} css={{ '& button svg': { color: 'var(--chakra-colors-hg-link)' } }}>
                    <Button
                        {...softButton}
                        fontSize="13px"
                        onClick={() => goTo(withReturn(`/reward/new?staking=${encodeURIComponent(pool.lp_denom)}`, back))}
                    >
                        <LuSprout /> Reward liquidity providers
                    </Button>
                    {/* Adding and removing liquidity live on the DEX pool page (BFE-262). */}
                    <AppLink app="dex" href={dexPoolHref(getDexApp().href, pool.id)}>
                        {pairHalted ? 'DEX' : 'Add liquidity on DEX'}
                    </AppLink>
                </HStack>
            </Stack>
        </HgCard>
    )
}

function MarketCard({ market, address }: Pick<RowProps, 'address'> & { market: Market }) {
    const { asset: baseAsset } = useAsset(market.base)
    const { asset: quoteAsset } = useAsset(market.quote)
    const marketId = createMarketId(market.base, market.quote)

    return (
        <HgCard as="article" px="20px" py="18px" data-testid={`trading-market-${marketId}`}>
            <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap="16px">
                <HStack gap="14px" minW="0">
                    <PairLogos base={baseAsset} quote={quoteAsset} />
                    <VStack align="start" gap="4px" minW="0">
                        <HStack gap="8px" flexWrap="wrap">
                            <Text as="strong" fontSize="16px" fontWeight="700">{`${baseAsset?.ticker ?? market.base}/${quoteAsset?.ticker ?? market.quote}`}</Text>
                            {address && market.creator === address && <CreatedBadge />}
                        </HStack>
                        <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" truncate maxW={{ base: '56', md: 'md' }}>
                            {marketId}
                        </Text>
                    </VStack>
                </HStack>
                <Box flexShrink={0}>
                    <AppLink app="dex" href={`${getDexApp().href}/exchange/market?id=${encodeURIComponent(marketId)}`}>DEX</AppLink>
                </Box>
            </Stack>
        </HgCard>
    )
}

function RowSkeletons() {
    return (
        <VStack align="stretch" gap="12px" data-testid="trading-skeleton">
            {[0, 1].map(i => (
                <HgCard key={i} px="20px" py="18px" aria-hidden>
                    <HStack gap="14px">
                        <Shimmer borderRadius="full" boxSize="40px" flex="none" />
                        <VStack align="stretch" gap="8px" flex="1">
                            <Shimmer h="16px" w="128px" />
                            <Shimmer h="12px" w="192px" />
                        </VStack>
                    </HStack>
                </HgCard>
            ))}
        </VStack>
    )
}

function EmptyCard({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
    return (
        <HgCard p="28px">
            <VStack gap="12px">
                <IconTile icon={icon} size={48} />
                <Text fontSize="14px" color="fg.muted" textAlign="center">{text}</Text>
                {children}
            </VStack>
        </HgCard>
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
        <VStack align="stretch" gap="36px">
            {isHalted && (
                <HaltedNotice tickers={[ticker]}>
                    New pools, markets and liquidity are refused. Existing positions can still be removed on the DEX.
                </HaltedNotice>
            )}

            <VStack as="section" aria-label="Pools" align="stretch" gap="14px">
                <HStack justify="space-between" align="flex-end" gap="12px" flexWrap="wrap">
                    <VStack align="start" gap="3px">
                        <Text as="h2" fontWeight="700" fontSize="20px">Pools</Text>
                        <Text fontSize="14px" color="fg.muted">{`${VOCABULARY.pool.name}s let people swap ${ticker}.`}</Text>
                    </VStack>
                    {!isHalted && !isPoolsLoading && pools.length > 0 && (
                        <Button {...softButton} onClick={() => goTo(newPoolHref)}>
                            <LuPlus /> Create another pool
                        </Button>
                    )}
                </HStack>
                {isPoolsLoading ? (
                    <RowSkeletons />
                ) : pools.length === 0 ? (
                    <EmptyCard icon={<LuDroplets size={24} />} text={`Nobody can buy ${ticker} yet.`}>
                        {!isHalted && (
                            <Button variant={hgVariant('primary')} size="lg" onClick={() => goTo(newPoolHref)}>
                                <LuDroplets /> {`Create a ${ticker} pool`}
                            </Button>
                        )}
                    </EmptyCard>
                ) : (
                    <VStack align="stretch" gap="12px">
                        {pools.map(pool => (
                            <PoolCard key={pool.id} pool={pool} address={address} back={back} isHalted={isHalted} goTo={goTo} />
                        ))}
                    </VStack>
                )}
            </VStack>

            <VStack as="section" aria-label="Order-book markets" align="stretch" gap="14px">
                <VStack align="start" gap="3px">
                    <Text as="h2" fontWeight="700" fontSize="20px">Order-book markets</Text>
                    <Text fontSize="14px" color="fg.muted">{`Traders place limit orders on ${ticker} here.`}</Text>
                </VStack>
                {isMarketsLoading ? (
                    <RowSkeletons />
                ) : markets.length === 0 ? (
                    <EmptyCard icon={<LuChartCandlestick size={24} />} text="No order book yet. Optional: traders can place limit orders on one.">
                        {!isHalted && (
                            <Button {...softButton} onClick={() => goTo(newMarketHref)}>
                                <LuChartCandlestick /> Create a market
                            </Button>
                        )}
                    </EmptyCard>
                ) : (
                    <VStack align="stretch" gap="12px">
                        {markets.map(market => (
                            <MarketCard key={createMarketId(market.base, market.quote)} market={market} address={address} />
                        ))}
                    </VStack>
                )}
            </VStack>
        </VStack>
    )
}
