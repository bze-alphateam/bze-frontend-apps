"use client"

import React, {useCallback, useMemo, useState} from 'react'

import {Box, chakra, Flex, Grid, IconButton, Input, InputGroup, Skeleton} from '@chakra-ui/react'
import {
    LuChevronDown,
    LuChevronUp,
    LuLink,
    LuSearch,
} from 'react-icons/lu'
import {Asset, ASSET_TYPE_FACTORY, ASSET_TYPE_IBC, ASSET_TYPE_NATIVE, useAssets, useAssetPrice, formatUsdAmount, HighlightText, TokenLogo, useToast, HaltedBadge, PageContainer, HgCard, Shimmer} from "@bze/bze-ui-kit";
import {VerifiedBadge} from "@/components/ui/badge/verified";
import {AssetDetails} from "@/components/ui/assets/asset-details";
import {assetPagePath} from "@/hooks/useNavigation";
import {sortAssetsForDirectory, filterAssetsBySearch} from "@/lib/asset-list";
import {InnerHero} from "@/components/ui/layout/inner-hero";
import {PriceChange} from "@/components/ui/assets/price-change";
import {KindTag} from "@/components/ui/staking/staking-card-parts";

function AssetItem({ asset, isExpanded, toggleExpanded }: { asset: Asset, isExpanded: boolean, toggleExpanded: (denom: string) => void}) {
    const [priceLoadedOnce, setPriceLoadedOnce] = useState(false)

    const { price, change, isLoading: priceLoading } = useAssetPrice(asset.denom)
    const {toast} = useToast()

    // Keep the skeleton hidden once the price has loaded at least once
    // (state-during-render pattern; avoids a cascading setState in an effect).
    if (!priceLoadedOnce && !priceLoading) {
        setPriceLoadedOnce(true)
    }

    const formattedPrice = useMemo(() => {
        return formatUsdAmount(price)
    }, [price])

    const changeLine = <PriceChange change={change}/>

    const copyAssetLink = useCallback(async (e: React.MouseEvent) => {
        // Don't toggle the expanded details when copying the link
        e.stopPropagation()
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${assetPagePath(asset.denom)}`)
            toast.success('Link copied', `Link to ${asset.ticker} copied to clipboard`)
        } catch { /* clipboard unavailable: ignore */ }
    }, [asset.denom, asset.ticker, toast])

    return (
        <Box
            bg="hg.card"
            borderWidth="1px"
            borderColor={isExpanded ? 'app.border' : 'hg.hairline'}
            borderRadius="16px"
            overflow="hidden"
            transitionProperty="border-color"
            transitionDuration="moderate"
            _hover={{borderColor: 'app.border'}}
        >
            {/* Main Asset Info */}
            <Flex
                px={{base: '14px', md: '18px'}}
                py="14px"
                align="center"
                gap="14px"
                cursor="pointer"
                onClick={() => toggleExpanded(asset.denom)}
            >
                <Box
                    position="relative"
                    boxSize="40px"
                    flex="none"
                    borderRadius="full"
                    borderWidth="1px"
                    borderColor="hg.hairline"
                >
                    <TokenLogo
                        src={asset.logo}
                        symbol={asset.ticker}
                        circular={true}
                    />
                </Box>
                <Flex direction="column" gap="3px" flex="1" minW="0">
                    <Flex align="center" gap="8px" wrap="wrap">
                        <chakra.strong fontSize="15px">{asset.name}</chakra.strong>
                        <KindTag>{asset.type.toUpperCase()}</KindTag>
                        {asset.verified && (<VerifiedBadge/>)}
                        {asset.halted && (<HaltedBadge/>)}
                    </Flex>
                    <chakra.span color="hg.text.faint" fontSize="13px">{asset.ticker}</chakra.span>
                </Flex>

                <Flex direction="column" align="flex-end" gap="2px" hideBelow="sm">
                    <Skeleton asChild loading={!priceLoadedOnce}>
                        <HighlightText fontWeight="600" fontSize="15px">
                            ${formattedPrice}
                        </HighlightText>
                    </Skeleton>
                    <Skeleton asChild loading={!priceLoadedOnce}>
                        {changeLine}
                    </Skeleton>
                </Flex>
                <Flex gap="2px" flex="none">
                    <IconButton
                        aria-label="Copy link to this asset"
                        size="md"
                        variant="ghost"
                        color="hg.text.muted"
                        onClick={copyAssetLink}
                    >
                        <LuLink />
                    </IconButton>
                    <IconButton
                        aria-label="Toggle details"
                        aria-expanded={isExpanded}
                        size="md"
                        variant="ghost"
                        color="hg.text.secondary"
                        bg={isExpanded ? 'hg.secondaryFill' : undefined}
                    >
                        {isExpanded ? <LuChevronUp /> : <LuChevronDown />}
                    </IconButton>
                </Flex>
            </Flex>

            {/* Phone Price Display */}
            <Flex hideFrom="sm" justify="space-between" align="center" px="14px" pb="12px">
                <Skeleton asChild loading={!priceLoadedOnce}>
                    <HighlightText fontWeight="600" fontSize="15px">${formattedPrice}</HighlightText>
                </Skeleton>
                <Skeleton asChild loading={!priceLoadedOnce}>
                    {changeLine}
                </Skeleton>
            </Flex>

            {/* Expanded Details */}
            {isExpanded && (
                <Box borderTopWidth="1px" borderColor="hg.divider" p={{base: '14px', md: '18px'}} bg="hg.inset">
                    <AssetDetails asset={asset} surface="card"/>
                </Box>
            )}
        </Box>
    )
}

/** One of the four counts over the list. */
const CountCard = ({label, loading, children}: { label: string; loading: boolean; children: React.ReactNode }) => (
    <HgCard px="18px" py="16px">
        <Flex direction="column" gap="6px">
            <chakra.span fontSize="12px" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">{label}</chakra.span>
            {loading ? <Shimmer h="30px" w="40%"/> : <HighlightText fontSize="26px" fontWeight="700">{children}</HighlightText>}
        </Flex>
    </HgCard>
)

export default function AssetsPage() {
    const [expandedAsset, setExpandedAsset] = useState<string>('')
    const [searchTerm, setSearchTerm] = useState('')
    const {isLoading, assetsLpExcluded} = useAssets()

    const filteredAssets = useMemo(() => {
        if (searchTerm === '') {
            return sortAssetsForDirectory(assetsLpExcluded)
        }

        return filterAssetsBySearch(assetsLpExcluded, searchTerm)
    }, [assetsLpExcluded, searchTerm])

    const toggleExpanded = (assetId: string) => {
        setExpandedAsset(assetId !== expandedAsset ? assetId : '')
    }

    return (
        <Box minH="100vh">
            <InnerHero
                section="Assets"
                title="Assets"
                subtitle="Explore all available tokens on the BeeZee blockchain"
            />

            <PageContainer pt="32px" pb="80px">
                <Flex direction="column" gap="20px">
                    {/* Stats Overview */}
                    <Grid templateColumns={{ base: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }} gap="12px">
                        <CountCard label="Total Assets" loading={isLoading}>{assetsLpExcluded.length}</CountCard>
                        <CountCard label="Native" loading={isLoading}>{assetsLpExcluded.filter(a => a.type === ASSET_TYPE_NATIVE).length}</CountCard>
                        <CountCard label="Factory" loading={isLoading}>{assetsLpExcluded.filter(a => a.type === ASSET_TYPE_FACTORY).length}</CountCard>
                        <CountCard label="IBC" loading={isLoading}>{assetsLpExcluded.filter(a => a.type === ASSET_TYPE_IBC).length}</CountCard>
                    </Grid>

                    {/* Search */}
                    <InputGroup startElement={<LuSearch size={16}/>} w="500px" maxW="100%">
                        <Input
                            aria-label="Search assets"
                            placeholder="Search assets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            h="44px"
                            borderRadius="12px"
                            bg="hg.inset"
                            borderColor="hg.hairline"
                            fontSize="15px"
                        />
                    </InputGroup>

                    {/* Assets List */}
                    <Flex direction="column" gap="10px">
                        {filteredAssets.map(asset =>
                            <AssetItem asset={asset} isExpanded={expandedAsset === asset.denom} key={asset.denom} toggleExpanded={toggleExpanded}/>
                        )}
                    </Flex>
                </Flex>
            </PageContainer>
        </Box>
    )
}
