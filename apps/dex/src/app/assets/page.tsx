"use client"

import React, {useCallback, useMemo, useState} from 'react'

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
    Input,
    Skeleton,
} from '@chakra-ui/react'
import {
    LuChevronDown,
    LuChevronUp,
    LuArrowUpRight,
    LuArrowDownRight,
    LuLink,
    LuSearch,
} from 'react-icons/lu'
import {Asset, ASSET_TYPE_FACTORY, ASSET_TYPE_IBC, ASSET_TYPE_NATIVE, useAssets, useAssetPrice, formatUsdAmount, HighlightText, TokenLogo, useToast} from "@bze/bze-ui-kit";
import {VerifiedBadge} from "@/components/ui/badge/verified";
import {AssetDetails} from "@/components/ui/assets/asset-details";
import {assetPagePath} from "@/hooks/useNavigation";
import {sortAssetsForDirectory, filterAssetsBySearch} from "@/lib/asset-list";

function AssetItem({ asset, isExpanded, toggleExpanded }: { asset: Asset, isExpanded: boolean, toggleExpanded: (denom: string) => void}) {
    const [priceLoadedOnce, setPriceLoadedOnce] = useState(false)

    const { price, change, isLoading: priceLoading } = useAssetPrice(asset.denom)
    const {toast} = useToast()

    // Keep the skeleton hidden once the price has loaded at least once
    // (state-during-render pattern; avoids a cascading setState in an effect).
    if (!priceLoadedOnce && !priceLoading) {
        setPriceLoadedOnce(true)
    }

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
                    <HStack gap={1}>
                        <IconButton
                            aria-label="Copy link to this asset"
                            size="sm"
                            variant="ghost"
                            onClick={copyAssetLink}
                        >
                            <LuLink />
                        </IconButton>
                        <IconButton
                            aria-label="Toggle details"
                            size="sm"
                            variant="ghost"
                        >
                            {isExpanded ? <LuChevronUp /> : <LuChevronDown />}
                        </IconButton>
                    </HStack>
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
            {isExpanded && (
                <Box
                    borderTopWidth="1px"
                    borderColor="border"
                    p={4}
                    bg="bg.subtle"
                >
                    <AssetDetails asset={asset} />
                </Box>
            )}
        </Box>
    )
}

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
