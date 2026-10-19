"use client"

import React, {useEffect, useMemo, useState} from 'react'

import {Box, chakra, Flex, Grid, Skeleton} from '@chakra-ui/react'
import {
    LuInfo,
    LuDroplets,
    LuArrowLeftRight,
    LuFactory,
} from 'react-icons/lu'
import {
    Asset,
    ASSET_TYPE_FACTORY,
    ASSET_TYPE_IBC,
    useAsset,
    shortNumberFormat,
    prettyAmount,
    toBigNumber,
    uAmountToBigNumberAmount,
    createMarketId,
    HighlightText,
    getFactoryDenomAdminAddress,
    LiquidityPoolData,
    useAssetLiquidityPools,
    useAssetMarkets,
    useMarket,
    LPTokenLogo,
    Notice,
} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {PriceChange} from "@/components/ui/assets/price-change";

const MAX_MARKETS_PER_ASSET = 5;

function AssetItemLiquidityPool({ pool, asset, poolData, surface }: { pool: LiquidityPoolSDKType, asset: Asset, poolData?: LiquidityPoolData, surface: RowSurface }) {
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
        <LinkRow surface={surface} onClick={() => toLpPage(pool.id)} label={`${base?.ticker}/${quote?.ticker} liquidity pool`}>
            <Flex align="center" gap="12px" flex="1" minW="0">
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
                <RowName title={`${base?.ticker}/${quote?.ticker}`} kind="Liquidity Pool"/>
            </Flex>

            {poolData ? (
                <RowFigures>
                    <RowFigure label="24h Volume">
                        <Skeleton asChild loading={quoteLoading}>
                            <HighlightText fontSize="14px" fontWeight="700">
                                {prettyAmount(assetLpVolume)} {asset?.ticker}
                            </HighlightText>
                        </Skeleton>
                    </RowFigure>
                    <RowFigure label="TVL">
                        {hasUsdValue ? (
                            <HighlightText fontSize="14px" fontWeight="700">
                                ${shortNumberFormat(poolData.usdValue)}
                            </HighlightText>
                        ) : (
                            <Flex direction="column" align={{ base: 'flex-start', sm: 'flex-end' }} gap="2px">
                                <Skeleton asChild loading={baseLoading}>
                                    <HighlightText fontSize="14px" fontWeight="700">
                                        {shortNumberFormat(uAmountToBigNumberAmount(pool.reserve_base, base?.decimals ?? 0))} {base?.ticker}
                                    </HighlightText>
                                </Skeleton>
                                <Skeleton asChild loading={quoteLoading}>
                                    <HighlightText fontSize="14px" fontWeight="700">
                                        {shortNumberFormat(uAmountToBigNumberAmount(pool.reserve_quote, quote?.decimals ?? 0))} {quote?.ticker}
                                    </HighlightText>
                                </Skeleton>
                            </Flex>
                        )}
                    </RowFigure>
                </RowFigures>
            ) : (
                <chakra.span fontSize="14px" color="fg.muted" flexShrink={0}>No data available</chakra.span>
            )}
        </LinkRow>
    )
}

function AssetItemMarkets({ marketId, surface }: { marketId: string, surface: RowSurface }) {
    const { marketSymbol, market, marketData, isLoading: marketLoading } = useMarket(marketId)
    const {asset: base, isLoading: baseLoading} = useAsset(market?.base ?? "")
    const {asset: quote, isLoading: quoteLoading} = useAsset(market?.quote ?? "")
    const {toMarketPage} = useNavigation()

    return (
        <LinkRow surface={surface} onClick={() => toMarketPage(base?.denom ?? "", quote?.denom ?? "")} label={`${marketSymbol} market`}>
            <Flex align="center" gap="12px" flex="1" minW="0">
                <Skeleton asChild loading={baseLoading}>
                    <Flex boxSize="36px" flex="none" align="center" justify="center" borderRadius="10px" bg="hg.ground" borderWidth="1px" borderColor="app.border">
                        <LPTokenLogo
                            baseAssetLogo={base?.logo ?? ""}
                            quoteAssetLogo={quote?.logo ?? ""}
                            baseAssetSymbol={base?.ticker ?? ""}
                            quoteAssetSymbol={quote?.ticker ?? ""}
                            size="4"
                        />
                    </Flex>
                </Skeleton>
                <RowName title={marketSymbol} kind="Market"/>
            </Flex>

            {marketData ? (
                <RowFigures>
                    <RowFigure label="24h Volume">
                        <Skeleton asChild loading={marketLoading || quoteLoading}>
                            <HighlightText fontSize="14px" fontWeight="700">
                                {marketData?.quote_volume} {quote?.ticker}
                            </HighlightText>
                        </Skeleton>
                    </RowFigure>
                    <RowFigure label="24h Change" minW="80px">
                        <Skeleton asChild loading={marketLoading}>
                            <Box fontWeight="700">
                                <PriceChange change={marketData?.change ?? 0} fontSize="14px"/>
                            </Box>
                        </Skeleton>
                    </RowFigure>
                </RowFigures>
            ) : (
                <chakra.span fontSize="14px" color="fg.muted" flexShrink={0}>No data available</chakra.span>
            )}
        </LinkRow>
    )
}

type RowSurface = 'inset' | 'card'

/** A market or pool row: the whole row opens its page. */
const LinkRow = ({surface, onClick, label, children}: { surface: RowSurface; onClick: () => void; label: string; children: React.ReactNode }) => (
    <chakra.button
        type="button"
        aria-label={label}
        onClick={onClick}
        display="flex"
        flexDirection={{ base: 'column', sm: 'row' }}
        alignItems={{ base: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap="12px"
        w="full"
        px="16px"
        py="12px"
        textAlign="left"
        color="fg"
        bg={surface === 'inset' ? 'hg.inset' : 'hg.card'}
        borderRadius="14px"
        borderWidth="1px"
        borderColor={surface === 'inset' ? 'transparent' : 'hg.hairline'}
        cursor="pointer"
        transitionProperty="border-color"
        transitionDuration="moderate"
        focusVisibleRing="outside"
        _hover={{ borderColor: 'app.border' }}
    >
        {children}
    </chakra.button>
)

const RowName = ({title, kind}: { title: React.ReactNode; kind: string }) => (
    <Flex direction="column" minW="0">
        <chakra.strong fontSize="15px">{title}</chakra.strong>
        <chakra.span fontSize="12px" color="hg.text.faint">{kind}</chakra.span>
    </Flex>
)

const RowFigures = ({children}: { children: React.ReactNode }) => (
    <Flex gap="24px" align="center" flexShrink={0} justify={{ base: 'space-between', sm: 'flex-end' }}>
        {children}
    </Flex>
)

const RowFigure = ({label, minW, children}: { label: string; minW?: string; children: React.ReactNode }) => (
    <Flex direction="column" align={{ base: 'flex-start', sm: 'flex-end' }} minW={minW}>
        <chakra.span fontSize="11px" color="hg.text.faint">{label}</chakra.span>
        {children}
    </Flex>
)

/** A labelled figure tile; the figure in the DEX link colour. */
const FigureTile = ({label, surface, children}: { label: string; surface: RowSurface; children: React.ReactNode }) => (
    <Flex direction="column" gap="6px" p="16px" borderRadius="14px" bg={surface === 'inset' ? 'hg.inset' : 'hg.card'} borderWidth="1px" borderColor={surface === 'inset' ? 'transparent' : 'hg.hairline'}>
        <chakra.span fontSize="12px" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">{label}</chakra.span>
        <HighlightText fontWeight="700" fontSize="20px" color="hg.link">{children}</HighlightText>
    </Flex>
)

/** A small key/value tile of the IBC and factory blocks. */
const InfoTile = ({label, mono, link, span, surface, children}: {
    label: string;
    mono?: boolean;
    link?: boolean;
    span?: boolean;
    surface: RowSurface;
    children: React.ReactNode;
}) => (
    <Flex
        direction="column"
        gap="3px"
        px="14px"
        py="12px"
        borderRadius="12px"
        bg={surface === 'inset' ? 'hg.inset' : 'hg.card'}
        borderWidth="1px"
        borderColor={surface === 'inset' ? 'transparent' : 'hg.hairline'}
        gridColumn={span ? { base: '1', sm: 'span 2' } : undefined}
        minW="0"
    >
        <chakra.span fontSize="12px" color="hg.text.faint">{label}</chakra.span>
        <chakra.span
            fontSize={mono ? '12px' : '14px'}
            fontFamily={mono ? 'mono' : undefined}
            fontWeight={mono ? '500' : '700'}
            color={link ? 'hg.link' : 'fg'}
            wordBreak="break-all"
        >
            {children}
        </chakra.span>
    </Flex>
)

/** A block title with its icon and, on the right, which trading venue the rows belong to. */
const BlockTitle = ({icon, title, tag}: { icon: React.ReactNode; title: string; tag?: React.ReactNode }) => (
    <Flex align="baseline" justify="space-between" gap="12px" wrap="wrap">
        <chakra.strong fontSize="16px" display="inline-flex" alignItems="center" gap="8px">
            <Box as="span" color="hg.accent" display="inline-flex" aria-hidden>{icon}</Box>
            {title}
        </chakra.strong>
        {tag}
    </Flex>
)

const VenueLabel = ({venue}: { venue: 'orderbook' | 'amm' }) => (
    <chakra.span
        fontSize="10px"
        fontWeight="700"
        letterSpacing="0.08em"
        px="6px"
        py="3px"
        borderRadius="6px"
        color="hg.link"
        {...(venue === 'amm' ? {bg: 'app.subtle'} : {borderWidth: '1px', borderColor: 'app.border'})}
    >
        {venue === 'amm' ? 'AMM · SWAP' : 'ORDER BOOK · EXCHANGE'}
    </chakra.span>
)

const Divider = () => <Box h="1px" bg="hg.divider"/>

/**
 * The full details body of an asset: supply/volume stats, IBC or Factory
 * sections, trading pairs and liquidity pools. Shared between the assets
 * listing (expanded row) and the asset details page (/assets/details?denom=).
 * `surface` is the tiles' fill: inset on a card (the details page), card on an inset (the expanded row).
 */
export function AssetDetails({ asset, surface = 'inset' }: { asset: Asset; surface?: RowSurface }) {
    const [adminAddress, setAdminAddress] = useState<string>("")

    const {assetMarketsData, asset24hTradedVolume: marketsVolume, assetMarkets} = useAssetMarkets(asset.denom)
    const {assetPools, asset24HoursVolume: lpVolume, assetPoolsData} = useAssetLiquidityPools(asset.denom)

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

    const formattedSupply = useMemo(() => {
        return shortNumberFormat(uAmountToBigNumberAmount(asset.supply, asset.decimals))
    }, [asset.supply, asset.decimals])

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
        if (asset.denom === '' || asset.type !== ASSET_TYPE_FACTORY) return;
        const loadAdminAddress = async () => setAdminAddress(await getFactoryDenomAdminAddress(asset.denom))

        loadAdminAddress()
    }, [asset.denom, asset.type]);

    return (
        <Flex direction="column" gap="16px">
            {/* Coin Stats */}
            <Grid gridTemplateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} gap="12px">
                <FigureTile label={supplyLabel} surface={surface}>{formattedSupply} {asset.ticker}</FigureTile>
                <FigureTile label="24h Volume" surface={surface}>{prettyAmount(total24HoursVolume)} {asset.ticker}</FigureTile>
            </Grid>

            {/* IBC Details */}
            {asset.type === ASSET_TYPE_IBC && (
                <>
                    <Divider/>
                    <BlockTitle icon={<LuInfo size={16}/>} title="IBC Details"/>
                    <Grid gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }} gap="10px">
                        <InfoTile label="Source Chain" surface={surface}>{asset.IBCData?.counterparty.chainPrettyName}</InfoTile>
                        <InfoTile label="Channel ID" mono surface={surface}>{asset.IBCData?.chain.channelId}</InfoTile>
                        <InfoTile label="Base Denom" mono span surface={surface}>{asset.IBCData?.counterparty.baseDenom}</InfoTile>
                        <InfoTile label="IBC Denom on BeeZee" mono span surface={surface}>{asset.denom}</InfoTile>
                        <InfoTile label="Path" mono span surface={surface}>
                            transfer/{asset.IBCData?.chain.channelId}/{asset.IBCData?.counterparty.baseDenom}
                        </InfoTile>
                    </Grid>
                </>
            )}

            {/* Factory Details */}
            {asset.type === ASSET_TYPE_FACTORY && (
                <>
                    <Divider/>
                    <BlockTitle icon={<LuFactory size={16}/>} title="Factory Details"/>
                    <Grid gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }} gap="10px">
                        <InfoTile label="Creator" mono link surface={surface}>{assetCreatorAddress}</InfoTile>
                        <InfoTile label="Admin" mono link surface={surface}>{adminAddress !== '' ? adminAddress : 'Nobody'}</InfoTile>
                    </Grid>

                    {/* Admin Warning/Notice */}
                    {adminAddress !== '' ? (
                        <Notice status="warning" title="Centralized Supply Control">
                            This token has an admin who can mint new tokens or burn existing ones, potentially affecting the total supply.
                        </Notice>
                    ) : (
                        <Notice status="success" title="Decentralized Supply">
                            Ownership has been renounced. No new tokens can ever be minted, so the supply can never increase.
                        </Notice>
                    )}
                </>
            )}

            <Divider/>

            {/* Trading Pairs */}
            <Flex direction="column" gap="10px">
                <BlockTitle icon={<LuArrowLeftRight size={16}/>} title="Trading Pairs" tag={<VenueLabel venue="orderbook"/>}/>
                {markets.length > 0 ? (
                    markets.map((market) => (
                        <AssetItemMarkets key={market.market_id} marketId={market.market_id} surface={surface}/>
                    ))
                ) : (
                    <chakra.span color="hg.text.faint" fontSize="13px" py="6px">No trading pairs available</chakra.span>
                )}
            </Flex>

            {/* Liquidity Pools */}
            <Flex direction="column" gap="10px" mt="8px">
                <BlockTitle icon={<LuDroplets size={16}/>} title="Liquidity Pools" tag={<VenueLabel venue="amm"/>}/>
                {assetPools.length > 0 ? (
                    assetPools.map((pool) => (
                        <AssetItemLiquidityPool key={pool.id} pool={pool} poolData={assetPoolsData.get(pool.id)} asset={asset} surface={surface}/>
                    ))
                ) : (
                    <chakra.span color="hg.text.faint" fontSize="13px" py="6px">No liquidity pools available</chakra.span>
                )}
            </Flex>
        </Flex>
    )
}
