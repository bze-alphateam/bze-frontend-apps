'use client'

import {Box, chakra, Flex, Grid, Input, InputGroup} from '@chakra-ui/react'
import {LuArrowRight, LuSearch} from 'react-icons/lu'
import {useMemo, useState} from 'react'
import NextLink from "next/link";
import {
    useAsset, useAssets, createMarketId, useAssetPrice, prettyAmount, formatUsdAmount, HighlightText, MarketData,
    useAssetsValue, useMarkets, LPTokenLogo, HaltedBadge, useHaltedDenoms,
    PageContainer, HeroGlow, PageHero, Eyebrow, HgCard, Shimmer,
} from "@bze/bze-ui-kit";
import {MarketSDKType} from "@bze/bzejs/bze/tradebin/store";
import BigNumber from "bignumber.js";
import {VerifiedBadge} from "@/components/ui/badge/verified";
import {marketPagePath} from "@/hooks/useNavigation";
import {VenueTag, VENUE_SUBTITLE} from "@/components/ui/trading/venue";
import {ChangePill} from "@/components/ui/trading/badges";
import {sortMarkets} from "@/lib/market-list";
import {marketPriceLabel} from "@/lib/market-price";

const DESKTOP_COLUMNS = 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) 140px'

/** The outlined order-book tile holding the pair's two logos. */
const PairTile = ({market}: { market: MarketSDKType }) => {
    const {asset: baseAsset} = useAsset(market.base)
    const {asset: quoteAsset} = useAsset(market.quote)

    return (
        <Flex
            boxSize="40px"
            flex="none"
            align="center"
            justify="center"
            borderRadius="10px"
            bg="hg.inset"
            borderWidth="1px"
            borderColor="app.border"
        >
            <LPTokenLogo
                baseAssetLogo={baseAsset?.logo || ''}
                quoteAssetLogo={quoteAsset?.logo || ''}
                baseAssetSymbol={baseAsset?.ticker || market.base}
                quoteAssetSymbol={quoteAsset?.ticker || market.quote}
                size="5"
            />
        </Flex>
    )
}

interface MarketRowProps {
    market: MarketSDKType
    marketData?: MarketData
}

const MarketRow = ({ market, marketData }: MarketRowProps) => {
    const {asset: baseAsset} = useAsset(market.base)
    const {asset: quoteAsset} = useAsset(market.quote)
    const {totalUsdValue: quoteUsdValue, isUSDC: quoteIsUSDC} = useAssetPrice(market.quote)

    const priceLabel = marketPriceLabel(marketData?.last_price, quoteAsset?.ticker)
    const displayVolume = marketData?.quote_volume || 0
    const displayUsdVolume = useMemo(() => formatUsdAmount(quoteUsdValue(new BigNumber(displayVolume))), [displayVolume, quoteUsdValue])
    const isVerifiedMarket = !!baseAsset?.verified && !!quoteAsset?.verified
    const isHaltedMarket = !!baseAsset?.halted || !!quoteAsset?.halted
    const pair = `${baseAsset?.ticker}/${quoteAsset?.ticker}`

    const badges = (
        <>
            {isVerifiedMarket && (<VerifiedBadge />)}
            {isHaltedMarket && (<HaltedBadge />)}
        </>
    )

    return (
        <Box
            asChild
            display="block"
            px={{base: '16px', md: '22px'}}
            py="16px"
            borderBottomWidth="1px"
            borderColor="hg.divider"
            color="fg"
            textDecoration="none"
            bg={isHaltedMarket ? 'hg.hoverFill/40' : undefined}
            transitionProperty="background"
            transitionDuration="moderate"
            _hover={{bg: 'hg.hoverFill', textDecoration: 'none'}}
            _focusVisible={{bg: 'hg.hoverFill', outline: '2px solid', outlineColor: 'app.focusRing', outlineOffset: '-2px'}}
            css={{'&:last-of-type': {borderBottomWidth: 0}}}
        >
            <NextLink
                href={marketPagePath(market.base, market.quote)}
                aria-label={`Trade ${pair}`}
                data-testid="market-row"
            >
                {/* Desktop */}
                <Grid templateColumns={DESKTOP_COLUMNS} gap="16px" alignItems="center" hideBelow="md">
                    <Flex align="center" gap="12px" minW="0">
                        <PairTile market={market}/>
                        <Flex direction="column" gap="3px" minW="0">
                            <Flex align="center" gap="8px" wrap="wrap">
                                <chakra.strong fontSize="16px" fontWeight="700">{pair}</chakra.strong>
                                {badges}
                            </Flex>
                            <chakra.span fontSize="12px" color="hg.text.faint" truncate>
                                {baseAsset?.name} / {quoteAsset?.name}
                            </chakra.span>
                        </Flex>
                    </Flex>

                    <Flex direction="column" align="flex-end" gap="4px">
                        <HighlightText fontWeight="700" fontSize="15px">
                            {priceLabel}
                        </HighlightText>
                        <ChangePill change={marketData?.change}/>
                    </Flex>

                    <Flex direction="column" align="flex-end" gap="4px">
                        <HighlightText fontWeight="700" fontSize="15px">
                            {prettyAmount(displayVolume)} {quoteAsset?.ticker}
                        </HighlightText>
                        {!quoteIsUSDC && (
                            <HighlightText fontSize="12px" color="hg.text.faint">
                                ${displayUsdVolume}
                            </HighlightText>
                        )}
                    </Flex>

                    <Flex justify="flex-end">
                        <TradeLabel/>
                    </Flex>
                </Grid>

                {/* Phone */}
                <Flex direction="column" gap="14px" hideFrom="md">
                    <Flex align="center" gap="12px" minW="0">
                        <PairTile market={market}/>
                        <Flex direction="column" gap="3px" minW="0">
                            <Flex align="center" gap="8px" wrap="wrap">
                                <chakra.strong fontSize="15px" fontWeight="700">{pair}</chakra.strong>
                                {badges}
                            </Flex>
                            <chakra.span fontSize="12px" color="hg.text.faint" truncate>
                                {baseAsset?.name} / {quoteAsset?.name}
                            </chakra.span>
                        </Flex>
                    </Flex>
                    <Grid templateColumns="1fr 1fr" gap="10px">
                        <Flex direction="column" gap="4px" bg="hg.inset" borderRadius="12px" px="12px" py="10px" align="flex-start">
                            <chakra.span fontSize="12px" color="hg.text.faint">24h Price</chakra.span>
                            <chakra.span fontWeight="700" fontSize="14px">{priceLabel}</chakra.span>
                            <ChangePill change={marketData?.change}/>
                        </Flex>
                        <Flex direction="column" gap="4px" bg="hg.inset" borderRadius="12px" px="12px" py="10px" align="flex-start">
                            <chakra.span fontSize="12px" color="hg.text.faint">24h Volume</chakra.span>
                            <chakra.span fontWeight="700" fontSize="14px">{prettyAmount(displayVolume)} {quoteAsset?.ticker}</chakra.span>
                            {!quoteIsUSDC && (
                                <chakra.span fontSize="12px" color="hg.text.faint">${displayUsdVolume}</chakra.span>
                            )}
                        </Flex>
                    </Grid>
                    <TradeLabel full/>
                </Flex>
            </NextLink>
        </Box>
    )
}

/** Looks like the secondary button; the whole row is the link. */
const TradeLabel = ({full}: { full?: boolean }) => (
    <Flex
        as="span"
        h="40px"
        px="16px"
        w={full ? 'full' : undefined}
        align="center"
        justify="center"
        gap="6px"
        borderRadius="hg.md"
        borderWidth="1px"
        borderColor="hg.lineStrong"
        bg="hg.secondaryFill"
        fontSize="14px"
        fontWeight="600"
        color="fg"
    >
        Trade <LuArrowRight size={14} aria-hidden="true"/>
    </Flex>
)

const LoadingRows = () => (
    <Flex direction="column" px="22px" py="12px" aria-busy="true">
        {[140, 110, 125].map((w, i) => (
            <Flex key={i} justify="space-between" align="center" py="10px" borderTopWidth={i > 0 ? '1px' : 0} borderColor="hg.divider">
                <Flex gap="12px" align="center">
                    <Shimmer boxSize="40px" borderRadius="10px"/>
                    <Shimmer w={`${w}px`} h="12px"/>
                </Flex>
                <Shimmer w="90px" h="36px" borderRadius="10px"/>
            </Flex>
        ))}
    </Flex>
)

export default function ExchangePage() {
    const [searchTerm, setSearchTerm] = useState('')
    const {markets, getMarketData, isLoading: isLoadingMarkets} = useMarkets()
    const {isVerifiedAsset, denomTicker} = useAssets()
    const {compareValues, isLoading: isLoadingAssetsValue} = useAssetsValue()
    const {isMarketHalted} = useHaltedDenoms()

    const sortedMarkets = useMemo(() => {
        if (!markets) return [];

        return sortMarkets(markets, {
            isHalted: isMarketHalted,
            getMarketData: (m) => getMarketData(createMarketId(m.base, m.quote)),
            isVerified: (m) => isVerifiedAsset(m.base) && isVerifiedAsset(m.quote),
            compareValues: isLoadingAssetsValue ? undefined : compareValues,
        })
    }, [markets, isVerifiedAsset, getMarketData, compareValues, isLoadingAssetsValue, isMarketHalted])

    const filteredMarkets = useMemo(() => {
        return sortedMarkets
            .filter(market =>
                denomTicker(market.base).toLowerCase().includes(searchTerm.toLowerCase()) ||
                denomTicker(market.quote).toLowerCase().includes(searchTerm.toLowerCase())
            )
    }, [sortedMarkets, searchTerm, denomTicker])

    return (
        <Box position="relative" minH="100vh">
            <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
                <HeroGlow strength="inner"/>
                <PageContainer position="relative" zIndex="1" pt={{base: '32px', md: '44px'}} pb="36px">
                    <PageHero
                        eyebrow={<Eyebrow app="dex" iconSize={24}>BeeZee DEX · Exchange</Eyebrow>}
                        title={
                            <Flex as="span" align="center" gap="12px" wrap="wrap">
                                Exchange Markets
                                <VenueTag venue="orderbook"/>
                            </Flex>
                        }
                        subtitle="Discover and trade verified trading pairs"
                        actions={<chakra.span fontSize="13px" color="hg.text.faint">{VENUE_SUBTITLE.orderbook}</chakra.span>}
                    />
                </PageContainer>
            </Box>

            <PageContainer pt="32px" pb="80px">
                <Flex direction="column" gap="20px">
                    <Flex justify="space-between" align="center" gap="16px" wrap="wrap">
                        <InputGroup startElement={<LuSearch size={16}/>} w="420px" maxW="100%">
                            <Input
                                aria-label="Search markets"
                                placeholder="Search markets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                h="44px"
                                borderRadius="12px"
                                bg="hg.inset"
                                borderColor="hg.hairline"
                                fontSize="15px"
                            />
                        </InputGroup>
                        <chakra.span
                            fontSize="13px"
                            fontWeight="600"
                            px="12px"
                            py="6px"
                            borderRadius="full"
                            color="hg.text.secondary"
                            bg="hg.secondaryFill"
                            borderWidth="1px"
                            borderColor="hg.lineStrong"
                        >
                            {filteredMarkets.length} trading pairs
                        </chakra.span>
                    </Flex>

                    <HgCard p="0" overflow="hidden">
                        <Grid
                            templateColumns={DESKTOP_COLUMNS}
                            gap="16px"
                            px="22px"
                            py="14px"
                            fontSize="12px"
                            fontWeight="600"
                            letterSpacing="0.06em"
                            textTransform="uppercase"
                            color="hg.text.faint"
                            borderBottomWidth="1px"
                            borderColor="hg.divider"
                            hideBelow="md"
                        >
                            <span>Market</span>
                            <chakra.span textAlign="right">24h Price</chakra.span>
                            <chakra.span textAlign="right">24h Volume</chakra.span>
                            <chakra.span textAlign="right">Action</chakra.span>
                        </Grid>

                        {isLoadingMarkets ? <LoadingRows/> : filteredMarkets.map((market) => (
                            <MarketRow
                                key={market.base + market.quote}
                                market={market}
                                marketData={getMarketData(createMarketId(market.base, market.quote))}
                            />
                        ))}

                        {filteredMarkets.length === 0 && !isLoadingMarkets && (
                            <Flex direction="column" align="center" textAlign="center" gap="6px" py="56px" px="24px">
                                <chakra.strong fontSize="17px" fontWeight="700">
                                    No markets found matching &quot;{searchTerm}&quot;
                                </chakra.strong>
                                <chakra.span fontSize="14px" color="fg.muted">
                                    Try adjusting your search terms
                                </chakra.span>
                            </Flex>
                        )}
                    </HgCard>
                </Flex>
            </PageContainer>
        </Box>
    )
}
