"use client"

import React, { useMemo } from 'react'
import { Box, HStack, Text, VStack, chakra } from '@chakra-ui/react'
import {
    AppLink,
    HaltedNotice,
    Market,
    Shimmer,
    createMarketId,
    getChainName,
    getDexApp,
    useAsset,
    useLiquidityPools,
    useMarkets,
} from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import { useChain } from '@interchain-kit/react'
import { withReturn } from '@/components/guided/return-to'
import { CHOOSE_MARKET_PATH, dexMarketHref, dexPoolHref } from '@/lib/create-routes'
import { poolLine } from '@/lib/token-page'
import { ActionGroup, ActionItem, ItemLink, type GroupProps } from './action-group'

function CreatedBadge() {
    return (
        <chakra.span fontSize="11px" fontWeight="600" px="8px" py="2px" borderRadius="hg.pill" color="fg.muted" bg="hg.inset" borderWidth="1px" borderColor="hg.divider" data-testid="created-badge">
            You created it
        </chakra.span>
    )
}

function PairTitle({ base, quote, isMine, kind }: { base: string; quote: string; isMine: boolean; kind: string }) {
    return (
        <HStack as="span" gap="8px" flexWrap="wrap">
            <span>{`${base}/${quote} ${kind}`}</span>
            {isMine && <CreatedBadge />}
        </HStack>
    )
}

function PoolRow({ pool, denom, address }: {
    pool: LiquidityPoolSDKType;
    denom: string;
    address?: string;
}) {
    const { asset: baseAsset } = useAsset(pool.base)
    const { asset: quoteAsset } = useAsset(pool.quote)
    const base = { ticker: baseAsset?.ticker ?? pool.base, decimals: baseAsset?.decimals ?? 0 }
    const quote = { ticker: quoteAsset?.ticker ?? pool.quote, decimals: quoteAsset?.decimals ?? 0 }

    return (
        <ActionItem
            testId={`trading-pool-${pool.id}`}
            title={<PairTitle base={base.ticker} quote={quote.ticker} kind="pool" isMine={Boolean(address) && pool.creator === address} />}
            line={poolLine(pool, denom, base, quote)}
            // Adding and removing liquidity live on the DEX pool page (BFE-262).
            action={<AppLink app="dex" href={dexPoolHref(getDexApp().href, pool.id)}>DEX</AppLink>}
        />
    )
}

function MarketRow({ market, address }: { market: Market; address?: string }) {
    const { asset: baseAsset } = useAsset(market.base)
    const { asset: quoteAsset } = useAsset(market.quote)
    const marketId = createMarketId(market.base, market.quote)

    return (
        <ActionItem
            testId={`trading-market-${marketId}`}
            title={(
                <PairTitle
                    base={baseAsset?.ticker ?? market.base}
                    quote={quoteAsset?.ticker ?? market.quote}
                    kind="order book"
                    isMine={Boolean(address) && market.creator === address}
                />
            )}
            action={<AppLink app="dex" href={dexMarketHref(getDexApp().href, marketId)}>DEX</AppLink>}
        />
    )
}

/**
 * Trading: every pool and order-book market with the token on either side, whoever created it, and
 * the way to create a DEX market for it. A halted token gets the notice and no create buttons.
 */
export function TradingGroup({ asset, back }: GroupProps) {
    const { address } = useChain(getChainName())
    const { pools: allPools, isLoading: isPoolsLoading } = useLiquidityPools()
    const { markets: allMarkets, isLoading: isMarketsLoading } = useMarkets()

    const denom = asset.denom
    const ticker = asset.ticker
    const isHalted = Boolean(asset.halted)
    const pools = useMemo(() => allPools.filter(p => p.base === denom || p.quote === denom), [allPools, denom])
    const markets = useMemo(() => allMarkets.filter(m => m.base === denom || m.quote === denom), [allMarkets, denom])
    const isLoading = isPoolsLoading || isMarketsLoading

    return (
        <ActionGroup id="trading" title="Trading">
            {isHalted && (
                <Box pb="12px">
                    <HaltedNotice tickers={[ticker]}>
                        New pools, markets and liquidity are refused. Existing positions can still be removed on the DEX.
                    </HaltedNotice>
                </Box>
            )}
            {isLoading ? (
                <VStack align="stretch" gap="10px" py="14px" borderTopWidth="1px" borderColor="hg.divider" data-testid="trading-loading">
                    <Shimmer h="16px" w="160px" />
                    <Shimmer h="12px" w="224px" />
                </VStack>
            ) : (
                <>
                    {pools.map(pool => (
                        <PoolRow key={pool.id} pool={pool} denom={denom} address={address} />
                    ))}
                    {markets.map(market => (
                        <MarketRow key={createMarketId(market.base, market.quote)} market={market} address={address} />
                    ))}
                    {pools.length === 0 && markets.length === 0 && (
                        <Text fontSize="14px" color="fg.muted" py="14px" borderTopWidth="1px" borderColor="hg.divider" data-testid="trading-empty">
                            {`Nobody can trade ${ticker} yet.`}
                        </Text>
                    )}
                </>
            )}
            {!isHalted && (
                <ActionItem
                    testId="pair-item"
                    title="Create DEX market"
                    action={(
                        <ItemLink href={withReturn(`${CHOOSE_MARKET_PATH}?base=${encodeURIComponent(denom)}`, back)} primary={!isLoading && pools.length === 0}>
                            Create
                        </ItemLink>
                    )}
                />
            )}
        </ActionGroup>
    )
}
