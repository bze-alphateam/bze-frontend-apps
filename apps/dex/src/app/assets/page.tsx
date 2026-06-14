"use client"

import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {
    Box,
    Container,
    Text,
    Flex,
    Badge,
    Grid,
    IconButton,
    HStack,
    VStack,
    Separator, Input, Skeleton,
} from '@chakra-ui/react'
import {
    LuChevronDown,
    LuChevronUp,
    LuArrowUpRight,
    LuArrowDownRight,
    LuInfo,
    LuDroplets,
    LuArrowLeftRight,
    LuSearch,
    LuFactory,
} from 'react-icons/lu'
import {Asset, ASSET_TYPE_FACTORY, ASSET_TYPE_IBC, ASSET_TYPE_NATIVE, isNativeDenom, useAsset, useAssets, useAssetPrice, formatUsdAmount, shortNumberFormat, prettyAmount, toBigNumber, uAmountToBigNumberAmount, createMarketId, HighlightText, getFactoryDenomAdminAddress, LiquidityPoolData, useAssetLiquidityPools, useAssetMarkets, useMarket, TokenLogo, LPTokenLogo} from "@bze/bze-ui-kit";
import {VerifiedBadge} from "@/components/ui/badge/verified";
import {useNavigation} from "@/hooks/useNavigation";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";

const MAX_MARKETS_PER_ASSET = 5;

function AssetItemLiquidityPool({ pool, asset, poolData }: { pool: LiquidityPoolSDKType, asset: Asset, poolData?: LiquidityPoolData }) {
    const {asset: base, isLoading: baseLoading} = useAsset(pool.base)
    const {asset: quote, isLoading: quoteLoading} = useAsset(pool.quote)
    const {toLpPage} = useNavigation()

    const hasUsdValue = poolData?.isComplete && poolData?.usdValue && poolData.usdValue.gt(0)

    const assetLpVolume = useMemo(() => {
        const volume = toBigNumber(0)
        if (!poolData) return volume

        if (poolData.base === asset.denom) {
            return volume.plus(poolData.baseVolume)
        } else if (poolData.quote === asset.denom) {
            return volume.plus(poolData.quoteVolume)
        }

        return volume
    },[poolData, asset])

    return (
        <Box
            p={3}
            bg="bg.emphasized"
            borderWidth="1px"
            borderColor="border"
            borderRadius="md"
            cursor="pointer"
            onClick={() => toLpPage(pool.id)}
            transition="all 0.2s"
            _hover={{
                bg: "bg.muted",
                borderColor: "border.emphasized",
                transform: "translateY(-1px)",
                shadow: "sm"
            }}
        >
            <Flex
                justify="space-between"
                align="center"
                gap={3}
                flexDirection={{ base: 'column', sm: 'row' }}
            >
                <HStack gap={3} flex="1">
                    <Skeleton asChild loading={baseLoading || quoteLoading}>
                        <Box flexShrink={0}>
                            <LPTokenLogo
                                baseAssetLogo={base?.logo ?? ""}
                                quoteAssetLogo={quote?.logo ?? ""}
                                baseAssetSymbol={base?.ticker ?? ""}
                                quoteAssetSymbol={quote?.ticker ?? ""}
                            />
                        </Box>
                    </Skeleton>
                    <Box minW={0}>
                        <Text fontWeight="semibold" fontSize="md">
                            {base?.ticker}/{quote?.ticker}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">Liquidity Pool</Text>
                    </Box>
                </HStack>

                {poolData && (
                    <Flex
                        gap={4}
                        align="center"
                        flexShrink={0}
                        w={{ base: 'full', sm: 'auto' }}
                        justify={{ base: 'space-between', sm: 'flex-end' }}
                    >
                        <Box textAlign={{ base: 'left', sm: 'right' }}>
                            <Text fontSize="xs" color="fg.muted">24h Volume</Text>
                            <Skeleton asChild loading={quoteLoading}>
                                <HighlightText fontSize="sm" fontWeight="medium">
                                    {prettyAmount(assetLpVolume)} {asset?.ticker}
                                </HighlightText>
                            </Skeleton>
                        </Box>
                        <Box textAlign="right">
                            <Text fontSize="xs" color="fg.muted">TVL</Text>
                            <HStack gap={1} justify={{ base: 'flex-start', sm: 'flex-end' }}>
                                {hasUsdValue ? (
                                        <HighlightText fontSize="sm" fontWeight="semibold">
                                            ${shortNumberFormat(poolData.usdValue)}
                                        </HighlightText>
                                    ) : (
                                        <VStack align={{ base: 'flex-start', sm: 'flex-end' }} gap={0.5}>
                                            <Skeleton asChild loading={baseLoading}>
                                                <HighlightText fontSize="sm" fontWeight="medium">
                                                    {shortNumberFormat(uAmountToBigNumberAmount(pool.reserve_base, base?.decimals ?? 0))} {base?.ticker}
                                                </HighlightText>
                                            </Skeleton>
                                            <Skeleton asChild loading={quoteLoading}>
                                                <HighlightText fontSize="sm" fontWeight="medium">
                                                    {shortNumberFormat(uAmountToBigNumberAmount(pool.reserve_quote, quote?.decimals ?? 0))} {quote?.ticker}
                                                </HighlightText>
                                            </Skeleton>
                                        </VStack>
                                    )}
                            </HStack>
                        </Box>
                    </Flex>
                )}
                {!poolData && (
                    <Box textAlign="right" flexShrink={0}>
                        <Text fontSize="sm" color="fg.muted">No data available</Text>
                    </Box>
                )}
            </Flex>
        </Box>
    )
}

function AssetItemMarkets({ marketId }: { marketId: string }) {
    const { marketSymbol, market, marketData, isLoading: marketLoading } = useMarket(marketId)
    const {asset: base, isLoading: baseLoading} = useAsset(market?.base ?? "")
    const {asset: quote, isLoading: quoteLoading} = useAsset(market?.quote ?? "")
    const {toMarketPage} = useNavigation()

    return (
        <Box
            p={3}
            bg="bg.emphasized"
            borderWidth="1px"
            borderColor="border"
            borderRadius="md"
            cursor="pointer"
            onClick={() => toMarketPage(base?.denom ?? "", quote?.denom ?? "")}
            transition="all 0.2s"
            _hover={{
                bg: "bg.muted",
                borderColor: "border.emphasized",
                transform: "translateY(-1px)",
                shadow: "sm"
            }}
        >
            <Flex
                justify="space-between"
                align="center"
                gap={3}
                flexDirection={{ base: 'column', sm: 'row' }}
            >
                <HStack gap={3} flex="1">
                    <Skeleton asChild loading={baseLoading}>
                        <Box flexShrink={0}>
                            <LPTokenLogo
                                baseAssetLogo={base?.logo ?? ""}
                                quoteAssetLogo={quote?.logo ?? ""}
                                baseAssetSymbol={base?.ticker ?? ""}
                                quoteAssetSymbol={quote?.ticker ?? ""}
                            />
                        </Box>
                    </Skeleton>
                    <Box minW={0}>
                        <Text fontWeight="semibold" fontSize="md">
                            {marketSymbol}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">Market</Text>
                    </Box>
                </HStack>

                {marketData && (
                    <Flex
                        gap={4}
                        align="center"
                        flexShrink={0}
                        w={{ base: 'full', sm: 'auto' }}
                        justify={{ base: 'space-between', sm: 'flex-end' }}
                    >
                        <Box textAlign={{ base: 'left', sm: 'right' }}>
                            <Text fontSize="xs" color="fg.muted">24h Volume</Text>
                            <Skeleton asChild loading={marketLoading || quoteLoading}>
                                <HighlightText fontSize="sm" fontWeight="medium">
                                    {marketData?.quote_volume} {quote?.ticker}
                                </HighlightText>
                            </Skeleton>
                        </Box>
                        <Box textAlign="right">
                            <Text fontSize="xs" color="fg.muted">24h Change</Text>
                            <Skeleton asChild loading={marketLoading}>
                                <HStack gap={1} justify={{ base: 'flex-start', sm: 'flex-end' }}>
                                    {marketData && marketData?.change !== 0 && (
                                        marketData.change > 0 ? (
                                            <LuArrowUpRight size={14} color="var(--chakra-colors-green-500)" />
                                        ) : (
                                            <LuArrowDownRight size={14} color="var(--chakra-colors-red-500)" />
                                        )
                                    )}
                                    <HighlightText
                                        fontSize="sm"
                                        fontWeight="semibold"
                                        color={marketData && marketData?.change > 0 ? 'green.500' : marketData?.change < 0 ? 'red.500' : 'fg.muted'}
                                    >
                                        {marketData && marketData?.change > 0 ? '+' : ''}{marketData?.change}%
                                    </HighlightText>
                                </HStack>
                            </Skeleton>
                        </Box>
                    </Flex>
                )}
                {!marketData && (
                    <Box textAlign="right" flexShrink={0}>
                        <Text fontSize="sm" color="fg.muted">No data available</Text>
                    </Box>
                )}
            </Flex>
        </Box>)
}

function AssetItem({ asset, isExpanded, toggleExpanded }: { asset: Asset, isExpanded: boolean, toggleExpanded: (denom: string) => void}) {
    const [priceLoadedOnce, setPriceLoadedOnce] = useState(false)
    const [adminAddress, setAdminAddress] = useState<string>("")

    const {assetMarketsData, asset24hTradedVolume: marketsVolume, assetMarkets} = useAssetMarkets(asset.denom)
    const {assetPools, asset24HoursVolume: lpVolume, assetPoolsData} = useAssetLiquidityPools(asset.denom)
    const { price, change, isLoading: priceLoading } = useAssetPrice(asset.denom)

    const markets = useMemo(() => {
        const marketsWithData = assetMarketsData
            .sort((a, b) => {
                // Get the relevant volume for market 'a'
                const volumeA = asset.denom === a.base ? (a.base_volume || 0) : (a.quote_volume || 0);
                // Get the relevant volume for market 'b'
                const volumeB = asset.denom === b.base ? (b.base_volume || 0) : (b.quote_volume || 0);

                // Sort descending (the highest volume first)
                return volumeB - volumeA;
            })
            .slice(0, MAX_MARKETS_PER_ASSET)
            .map(market => ({market_id: market.market_id}))

        const missingMarkets = MAX_MARKETS_PER_ASSET - marketsWithData.length
        if (missingMarkets > 0) {
            //fill the rest with markets without data
            let added = 0
            for (const market of assetMarkets) {
                const mId = createMarketId(market.base, market.quote)
                const reverseMId = createMarketId(market.quote, market.base)
                const found = marketsWithData.find(item => item.market_id === mId || item.market_id === reverseMId)
                if (found) continue

                marketsWithData.push({market_id: mId})
                added++
                if (added >= missingMarkets) break
            }
        }

        return marketsWithData
    }, [assetMarketsData, assetMarkets, asset])

    const getTypeColor = useCallback((type: string) => {
        switch (type) {
            case ASSET_TYPE_NATIVE:
                return 'purple'
            case ASSET_TYPE_FACTORY:
                return 'blue'
            case ASSET_TYPE_IBC:
                return 'teal'
            default:
                return 'gray'
        }
    }, [])

    const formattedPrice = useMemo(() => {
        return formatUsdAmount(price)
    }, [price])

    const formattedSupply = useMemo(() => {
        return shortNumberFormat(uAmountToBigNumberAmount(asset.supply, asset.decimals))
    }, [asset.supply, asset.decimals])

    const renderChangeArrow = useMemo(() => {
        if (change > 0) {
            return  <LuArrowUpRight size={14} color="var(--chakra-colors-green-500)" />
        }
        if (change < 0) {
            return  <LuArrowDownRight size={14} color="var(--chakra-colors-red-500)" />
        }
        return null
    }, [change])

    const renderChangeText = useMemo(() => {
        if (change > 0) {
            return <Text fontSize="sm" color="green.500">+{change}%</Text>
        }

        if (change < 0) {
            return <Text fontSize="sm" color="red.500">{change}%</Text>
        }

        return <Text fontSize="sm" color="red.200">{change}%</Text>
    }, [change])

    const assetCreatorAddress = useMemo(() => {
        const split = asset.denom.split('/')
        return split.length > 1 ? split[1] : "Unknown"
    }, [asset.denom])

    const supplyLabel = useMemo(() => {
        if (asset.type === ASSET_TYPE_FACTORY) return "Total Supply"
        if (asset.type === ASSET_TYPE_IBC) return "Supply on BeeZee"
        return "Current Supply"
    }, [asset.type])

    const total24HoursVolume = useMemo(() => {
        return marketsVolume.plus(lpVolume)
    }, [marketsVolume, lpVolume])

    useEffect(() => {
        //change the state of it only if it wasn't loaded yet
        if (priceLoadedOnce) return;

        setPriceLoadedOnce(!priceLoading)
        //eslint-disable-next-line
    }, [priceLoading]);

    useEffect(() => {
        if (asset.denom === '' || asset.type !== ASSET_TYPE_FACTORY) return;
        const loadAdminAddress = async () => setAdminAddress(await getFactoryDenomAdminAddress(asset.denom))

        loadAdminAddress()
    }, [asset.denom, asset.type]);

    return (
        <Box
            key={asset.denom}
            bgGradient="to-br"
            gradientFrom="blue.500/5"
            gradientTo="blue.600/5"
            borderWidth="1px"
            borderColor="blue.500/15"
            borderRadius="lg"
            overflow="hidden"
            transition="all 0.2s"
            shadow="sm"
            _hover={{
                gradientFrom: "blue.500/10",
                gradientTo: "blue.600/10",
                borderColor: "blue.500/25",
                shadow: "md"
            }}
        >
            {/* Main Asset Info */}
            <Flex
                p={4}
                align="center"
                justify="space-between"
                cursor="pointer"
                onClick={() => toggleExpanded(asset.denom)}
            >
                <HStack gap={3}>
                    <Box
                        position="relative"
                        width="40px"
                        height="40px"
                        borderRadius="full"
                        bg="bg.surface"
                        borderWidth="1px"
                        borderColor="border.subtle"
                    >
                        <TokenLogo
                            src={asset.logo}
                            symbol={asset.ticker}
                            circular={true}
                        />
                    </Box>
                    <Box>
                        <HStack gap={2}>
                            <Text fontWeight="semibold" fontSize="md">
                                {asset.name}
                            </Text>
                            <Badge colorPalette={getTypeColor(asset.type)} size="sm">
                                {asset.type.toUpperCase()}
                            </Badge>
                            {asset.verified && (<VerifiedBadge/>)}
                        </HStack>
                        <Text color="fg.muted" fontSize="sm">
                            {asset.ticker}
                        </Text>
                    </Box>
                </HStack>

                <HStack gap={4}>
                    <Box textAlign="right" display={{ base: 'none', sm: 'block' }}>
                        <Skeleton asChild loading={!priceLoadedOnce}>
                            <HighlightText fontWeight="medium" fontSize="md">
                                ${formattedPrice}
                            </HighlightText>
                        </Skeleton>
                        <Skeleton asChild loading={!priceLoadedOnce}>
                            <HStack gap={1} justify="flex-end">
                                {renderChangeArrow}
                                {renderChangeText}
                            </HStack>
                        </Skeleton>
                    </Box>
                    <IconButton
                        aria-label="Toggle details"
                        size="sm"
                        variant="ghost"
                    >
                        {isExpanded ? <LuChevronUp /> : <LuChevronDown />}
                    </IconButton>
                </HStack>
            </Flex>

            {/* Mobile Price Display */}
            <Box display={{ base: 'block', sm: 'none' }} px={4} pb={2}>
                <HStack justify="space-between">
                    <Skeleton asChild loading={!priceLoadedOnce}>
                        <HighlightText fontWeight="medium">${formattedPrice}</HighlightText>
                    </Skeleton>
                    <HStack gap={1}>
                        <Skeleton asChild loading={!priceLoadedOnce}>
                            <HStack gap={1} justify="flex-end">
                                {renderChangeArrow}
                                {renderChangeText}
                            </HStack>
                        </Skeleton>
                    </HStack>
                </HStack>
            </Box>

            {/* Expanded Details */}
            <Box
                display={isExpanded ? 'block' : 'none'}
                borderTopWidth="1px"
                borderColor="border"
                p={4}
                bg="bg.subtle"
                style={{
                    transition: 'max-height 0.3s ease-in-out',
                }}
            >
                <VStack align="stretch" gap={4}>
                    {/* Coin Stats */}
                    <Grid gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
                        <Box
                            bgGradient="to-br"
                            gradientFrom="blue.500/10"
                            gradientTo="blue.600/10"
                            borderWidth="1px"
                            borderColor="blue.500/20"
                            borderRadius="lg"
                            p={4}
                        >
                            <Text color="fg.muted" fontSize="xs" fontWeight="semibold" textTransform="uppercase" mb={2}>
                                {supplyLabel}
                            </Text>
                            <HighlightText fontWeight="bold" fontSize="lg" color="blue.600">
                                {formattedSupply} {asset.ticker}
                            </HighlightText>
                        </Box>
                        <Box
                            bgGradient="to-br"
                            gradientFrom="blue.500/10"
                            gradientTo="blue.600/10"
                            borderWidth="1px"
                            borderColor="blue.500/20"
                            borderRadius="lg"
                            p={4}
                        >
                            <Text color="fg.muted" fontSize="xs" fontWeight="semibold" textTransform="uppercase" mb={2}>
                                24h Volume
                            </Text>
                            <HighlightText fontWeight="bold" fontSize="lg" color="blue.600">
                                {prettyAmount(total24HoursVolume)} {asset.ticker}
                            </HighlightText>
                        </Box>
                    </Grid>
                    {/* IBC Details */}
                    {asset.type === ASSET_TYPE_IBC && (
                        <>
                            <Separator />
                            <Box>
                                <HStack mb={3} gap={2}>
                                    <LuInfo size={16} color="var(--chakra-colors-teal-500)" />
                                    <Text fontWeight="semibold" fontSize="md">IBC Details</Text>
                                </HStack>
                                <Grid gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={3}>
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="teal.500/8"
                                        gradientTo="teal.600/8"
                                        borderWidth="1px"
                                        borderColor="teal.500/20"
                                        borderRadius="md"
                                        p={3}
                                    >
                                        <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb={1}>
                                            Source Chain
                                        </Text>
                                        <Text fontSize="sm" fontWeight="medium" color="teal.600">
                                            {asset.IBCData?.counterparty.chainPrettyName}
                                        </Text>
                                    </Box>
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="teal.500/8"
                                        gradientTo="teal.600/8"
                                        borderWidth="1px"
                                        borderColor="teal.500/20"
                                        borderRadius="md"
                                        p={3}
                                    >
                                        <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb={1}>
                                            Channel ID
                                        </Text>
                                        <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color="teal.600">
                                            {asset.IBCData?.chain.channelId}
                                        </Text>
                                    </Box>
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="teal.500/8"
                                        gradientTo="teal.600/8"
                                        borderWidth="1px"
                                        borderColor="teal.500/20"
                                        borderRadius="md"
                                        p={3}
                                        gridColumn={{ base: '1', sm: 'span 2' }}
                                    >
                                        <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb={1}>
                                            Base Denom
                                        </Text>
                                        <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color="teal.600" wordBreak="break-all">
                                            {asset.IBCData?.counterparty.baseDenom}
                                        </Text>
                                    </Box>
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="teal.500/8"
                                        gradientTo="teal.600/8"
                                        borderWidth="1px"
                                        borderColor="teal.500/20"
                                        borderRadius="md"
                                        p={3}
                                        gridColumn={{ base: '1', sm: 'span 2' }}
                                    >
                                        <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb={1}>
                                            IBC Denom on BeeZee
                                        </Text>
                                        <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color="teal.600" wordBreak="break-all">
                                            {asset.denom}
                                        </Text>
                                    </Box>
                                    <Box
                                        bgGradient="to-br"
                                        gradientFrom="teal.500/8"
                                        gradientTo="teal.600/8"
                                        borderWidth="1px"
                                        borderColor="teal.500/20"
                                        borderRadius="md"
                                        p={3}
                                        gridColumn={{ base: '1', sm: 'span 2' }}
                                    >
                                        <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb={1}>
                                            Path
                                        </Text>
                                        <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color="teal.600" wordBreak="break-all">
                                            transfer/{asset.IBCData?.chain.channelId}/{asset.IBCData?.counterparty.baseDenom}
                                        </Text>
                                    </Box>
                                </Grid>
                            </Box>
                        </>
                    )}
                    {/* Factory Details */}
                    {asset.type === ASSET_TYPE_FACTORY && (
                        <>
                            <Separator />
                            <Box>
                                <HStack mb={3} gap={2}>
                                    <LuFactory size={16} color="var(--chakra-colors-blue-500)" />
                                    <Text fontWeight="semibold" fontSize="md">Factory Details</Text>
                                </HStack>
                                <VStack align="stretch" gap={3}>
                                    <Grid gridTemplateColumns={{ base: '1fr', sm: '1fr 1fr' }} gap={3}>
                                        <Box
                                            bgGradient="to-br"
                                            gradientFrom="blue.500/8"
                                            gradientTo="blue.600/8"
                                            borderWidth="1px"
                                            borderColor="blue.500/20"
                                            borderRadius="md"
                                            p={3}
                                        >
                                            <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb={1}>
                                                Creator
                                            </Text>
                                            <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color="blue.600" wordBreak="break-all">
                                                {assetCreatorAddress}
                                            </Text>
                                        </Box>
                                        <Box
                                            bgGradient="to-br"
                                            gradientFrom="blue.500/8"
                                            gradientTo="blue.600/8"
                                            borderWidth="1px"
                                            borderColor="blue.500/20"
                                            borderRadius="md"
                                            p={3}
                                        >
                                            <Text color="fg.muted" fontSize="xs" fontWeight="semibold" mb={1}>
                                                Admin
                                            </Text>
                                            <Text fontSize="sm" fontFamily="mono" fontWeight="medium" color="blue.600" wordBreak="break-all">
                                                {adminAddress !== '' ? adminAddress : 'Nobody'}
                                            </Text>
                                        </Box>
                                    </Grid>

                                    {/* Admin Warning/Notice */}
                                    {adminAddress !== '' ? (
                                        <Box
                                            bgGradient="to-br"
                                            gradientFrom="orange.500/10"
                                            gradientTo="orange.600/10"
                                            borderWidth="1px"
                                            borderColor="orange.500/30"
                                            borderRadius="md"
                                            p={3}
                                        >
                                            <HStack gap={2} align="start">
                                                <Box flexShrink={0} mt={0.5}>
                                                    <LuInfo size={16} color="var(--chakra-colors-orange-500)" />
                                                </Box>
                                                <VStack align="start" gap={1}>
                                                    <Text fontSize="sm" fontWeight="semibold" color="orange.600">
                                                        Centralized Supply Control
                                                    </Text>
                                                    <Text fontSize="xs" color="fg.muted">
                                                        This token has an admin who can mint new tokens or burn existing ones, potentially affecting the total supply.
                                                    </Text>
                                                </VStack>
                                            </HStack>
                                        </Box>
                                    ) : (
                                        <Box
                                            bgGradient="to-br"
                                            gradientFrom="green.500/10"
                                            gradientTo="green.600/10"
                                            borderWidth="1px"
                                            borderColor="green.500/30"
                                            borderRadius="md"
                                            p={3}
                                        >
                                            <HStack gap={2} align="start">
                                                <Box flexShrink={0} mt={0.5}>
                                                    <LuInfo size={16} color="var(--chakra-colors-green-500)" />
                                                </Box>
                                                <VStack align="start" gap={1}>
                                                    <Text fontSize="sm" fontWeight="semibold" color="green.600">
                                                        Decentralized Supply
                                                    </Text>
                                                    <Text fontSize="xs" color="fg.muted">
                                                        Ownership has been renounced. No one can mint or burn tokens, ensuring the supply remains fixed.
                                                    </Text>
                                                </VStack>
                                            </HStack>
                                        </Box>
                                    )}
                                </VStack>
                            </Box>
                        </>
                    )}

                    <Separator />

                    {/* Trading Pairs */}
                    <Box>
                        <HStack mb={3}>
                            <LuArrowLeftRight size={16} />
                            <Text fontWeight="semibold">Trading Pairs</Text>
                        </HStack>
                        {markets.length > 0 ? (
                            <VStack align="stretch" gap={2}>
                                {markets.map((market) => (
                                    <AssetItemMarkets key={market.market_id} marketId={market.market_id} />
                                ))}
                            </VStack>
                        ) : (
                            <Text color="fg.muted" fontSize="sm">No trading pairs available</Text>
                        )}
                    </Box>

                    {/* Liquidity Pools */}
                    <Box>
                        <HStack mb={3}>
                            <LuDroplets size={16} />
                            <Text fontWeight="semibold">Liquidity Pools</Text>
                        </HStack>
                        {assetPools.length > 0 ? (
                            <VStack align="stretch" gap={2}>
                                {assetPools.map((pool) => (
                                    <AssetItemLiquidityPool key={pool.id} pool={pool} poolData={assetPoolsData.get(pool.id)} asset={asset} />
                                ))}
                            </VStack>
                        ) : (
                        <Text color="fg.muted" fontSize="sm">No liquidity pools available</Text>
                        )}
                    </Box>
                </VStack>
            </Box>
        </Box>
    )
}

export default function AssetsPage() {
    const [expandedAsset, setExpandedAsset] = useState<string>('')
    const [searchTerm, setSearchTerm] = useState('')
    const {isLoading, assetsLpExcluded} = useAssets()

    const filteredAssets = useMemo(() => {
        if (searchTerm === '') {
            return assetsLpExcluded.sort((token1: Asset, token2: Asset) => {
                // Native denom should always be first
                const token1IsNative = isNativeDenom(token1.denom);
                const token2IsNative = isNativeDenom(token2.denom);

                if (token1IsNative && !token2IsNative) {
                    return -1;
                }
                if (!token1IsNative && token2IsNative) {
                    return 1;
                }

                // Then verified tokens
                if (token1.verified && !token2.verified) {
                    return -1;
                }

                if (token2.verified && !token1.verified) {
                    return 1;
                }

                // Finally alphabetically by name
                return token1.name > token2.name ? 1 : -1;
            })
        } else {
            return assetsLpExcluded.filter(asset =>
                asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.ticker.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }
    }, [assetsLpExcluded, searchTerm])

    const toggleExpanded = (assetId: string) => {
        setExpandedAsset(assetId !== expandedAsset ? assetId : '')
    }

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="7xl" py={12}>
                <VStack align="stretch" gap="8">
                    {/* Page Header */}
                    <VStack gap={3} align="center" mb={4}>
                        <Text fontSize="3xl" fontWeight="bold" letterSpacing="tight">
                            Assets
                        </Text>
                        <Text fontSize="md" color="fg.muted">
                            Explore all available tokens on the BeeZee blockchain
                        </Text>
                    </VStack>

                    {/* Stats Overview */}
                    <Grid templateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap="3">
                        <Box
                            p={4}
                            bgGradient="to-br"
                            gradientFrom="blue.500/8"
                            gradientTo="blue.600/8"
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor="blue.500/20"
                            shadow="sm"
                        >
                            <VStack align="start" gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                                    Total Assets
                                </Text>
                                <Skeleton asChild loading={isLoading}>
                                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                                        {assetsLpExcluded.length}
                                    </Text>
                                </Skeleton>
                            </VStack>
                        </Box>
                        <Box
                            p={4}
                            bgGradient="to-br"
                            gradientFrom="blue.500/8"
                            gradientTo="blue.600/8"
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor="blue.500/20"
                            shadow="sm"
                        >
                            <VStack align="start" gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                                    Native
                                </Text>
                                <Skeleton asChild loading={isLoading}>
                                    <HighlightText fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                                        {assetsLpExcluded.filter(a => a.type === ASSET_TYPE_NATIVE).length}
                                    </HighlightText>
                                </Skeleton>
                            </VStack>
                        </Box>
                        <Box
                            p={4}
                            bgGradient="to-br"
                            gradientFrom="blue.500/8"
                            gradientTo="blue.600/8"
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor="blue.500/20"
                            shadow="sm"
                        >
                            <VStack align="start" gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                                    Factory
                                </Text>
                                <Skeleton asChild loading={isLoading}>
                                    <HighlightText fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                                        {assetsLpExcluded.filter(a => a.type === ASSET_TYPE_FACTORY).length}
                                    </HighlightText>
                                </Skeleton>
                            </VStack>
                        </Box>
                        <Box
                            p={4}
                            bgGradient="to-br"
                            gradientFrom="blue.500/8"
                            gradientTo="blue.600/8"
                            borderRadius="lg"
                            borderWidth="1px"
                            borderColor="blue.500/20"
                            shadow="sm"
                        >
                            <VStack align="start" gap={2}>
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                                    IBC
                                </Text>
                                <Skeleton asChild loading={isLoading}>
                                    <HighlightText fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                                        {assetsLpExcluded.filter(a => a.type === ASSET_TYPE_IBC).length}
                                    </HighlightText>
                                </Skeleton>
                            </VStack>
                        </Box>
                    </Grid>

                    {/* Search Section */}
                    <Box
                        p={6}
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="blue.600/8"
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor="blue.500/20"
                        shadow="sm"
                    >
                        <Box position="relative" w="full" maxW="500px">
                            <Input
                                placeholder="Search assets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                size="lg"
                                pl="12"
                                borderRadius="lg"
                            />
                            <Box position="absolute" left="4" top="50%" transform="translateY(-50%)" color="fg.muted">
                                <LuSearch size={20} />
                            </Box>
                        </Box>
                    </Box>
                    {/* Assets List */}
                    <VStack align="stretch" gap={3}>
                        {filteredAssets.map(asset =>
                            <AssetItem asset={asset} isExpanded={expandedAsset === asset.denom} key={asset.denom} toggleExpanded={toggleExpanded}/>
                        )}
                    </VStack>
                </VStack>
            </Container>
        </Box>
    )
}