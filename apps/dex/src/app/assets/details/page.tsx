'use client';

import React, {Suspense, useCallback, useMemo} from 'react';
import {
    Box,
    Container,
    VStack,
    HStack,
    Text,
    Button,
    Badge,
    IconButton,
    Skeleton,
} from '@chakra-ui/react';
import {
    LuArrowLeft,
    LuArrowUpRight,
    LuArrowDownRight,
    LuLink,
    LuSearchX,
} from 'react-icons/lu';
import {
    Asset,
    ASSET_TYPE_FACTORY,
    ASSET_TYPE_IBC,
    ASSET_TYPE_NATIVE,
    useAsset,
    useAssetPrice,
    formatUsdAmount,
    HighlightText,
    TokenLogo,
    useToast,
} from "@bze/bze-ui-kit";
import {useNavigationWithParams, assetPagePath} from "@/hooks/useNavigation";
import {VerifiedBadge} from "@/components/ui/badge/verified";
import {AssetDetails} from "@/components/ui/assets/asset-details";

const getTypeColor = (type: string) => {
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
}

const AssetHeader = ({ asset }: { asset: Asset }) => {
    const { price, change, isLoading: priceLoading } = useAssetPrice(asset.denom)
    const {toast} = useToast()

    const formattedPrice = useMemo(() => formatUsdAmount(price), [price])

    const copyAssetLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${assetPagePath(asset.denom)}`)
            toast.success('Link copied', `Link to ${asset.ticker} copied to clipboard`)
        } catch { /* clipboard unavailable: ignore */ }
    }, [asset.denom, asset.ticker, toast])

    const renderChangeArrow = useMemo(() => {
        if (change > 0) return <LuArrowUpRight size={14} color="var(--chakra-colors-green-500)" />
        if (change < 0) return <LuArrowDownRight size={14} color="var(--chakra-colors-red-500)" />
        return null
    }, [change])

    const renderChangeText = useMemo(() => {
        if (change > 0) return <Text fontSize="sm" color="green.500">+{change}%</Text>
        if (change < 0) return <Text fontSize="sm" color="red.500">{change}%</Text>
        return <Text fontSize="sm" color="red.200">{change}%</Text>
    }, [change])

    return (
        <Box
            bgGradient="to-br"
            gradientFrom="blue.500/8"
            gradientTo="blue.600/8"
            borderWidth="1px"
            borderColor="blue.500/20"
            borderRadius="xl"
            shadow="sm"
            p={{ base: 4, md: 6 }}
        >
            <VStack align="stretch" gap={3}>
                <HStack justify="space-between" align="start" flexWrap="wrap" gap={4}>
                    <HStack gap={3}>
                        <Box
                            position="relative"
                            width="48px"
                            height="48px"
                            borderRadius="full"
                            bg="bg.surface"
                            borderWidth="1px"
                            borderColor="border.subtle"
                            flexShrink={0}
                        >
                            <TokenLogo
                                src={asset.logo}
                                symbol={asset.ticker}
                                circular={true}
                            />
                        </Box>
                        <Box>
                            <HStack gap={2} flexWrap="wrap">
                                <Text fontWeight="bold" fontSize="xl">
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

                    <HStack gap={3}>
                        <Box textAlign="right">
                            <Skeleton asChild loading={priceLoading}>
                                <HighlightText fontWeight="semibold" fontSize="lg">
                                    ${formattedPrice}
                                </HighlightText>
                            </Skeleton>
                            <Skeleton asChild loading={priceLoading}>
                                <HStack gap={1} justify="flex-end">
                                    {renderChangeArrow}
                                    {renderChangeText}
                                </HStack>
                            </Skeleton>
                        </Box>
                        <IconButton
                            aria-label="Copy link to this asset"
                            size="sm"
                            variant="ghost"
                            onClick={copyAssetLink}
                        >
                            <LuLink />
                        </IconButton>
                    </HStack>
                </HStack>

                <Text fontSize="xs" fontFamily="mono" color="fg.muted" wordBreak="break-all">
                    {asset.denom}
                </Text>
            </VStack>
        </Box>
    )
}

const AssetDetailsPageContent = () => {
    const {toAssetsPage, denomParam} = useNavigationWithParams()
    const {asset, isLoading} = useAsset(denomParam ?? '')

    const notFound = !isLoading && (!asset || asset.denom === '')

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="7xl" py={12}>
                <VStack align="stretch" gap={6}>
                    <Box>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toAssetsPage()}
                        >
                            <LuArrowLeft />Assets
                        </Button>
                    </Box>

                    {isLoading && (
                        <VStack align="stretch" gap={4}>
                            <Skeleton height="120px" borderRadius="xl" />
                            <Skeleton height="300px" borderRadius="xl" />
                        </VStack>
                    )}

                    {notFound && (
                        <Box
                            bgGradient="to-br"
                            gradientFrom="blue.500/8"
                            gradientTo="blue.600/8"
                            borderWidth="1px"
                            borderColor="blue.500/20"
                            borderRadius="xl"
                            shadow="sm"
                            p={10}
                        >
                            <VStack gap={3}>
                                <LuSearchX size={32} color="var(--chakra-colors-fg-muted)" />
                                <Text fontSize="lg" fontWeight="semibold">Asset not found</Text>
                                <Text fontSize="sm" color="fg.muted" textAlign="center">
                                    We couldn&apos;t find an asset for this link. It may have been removed or the link is incorrect.
                                </Text>
                                <Button size="sm" variant="outline" onClick={() => toAssetsPage()}>
                                    <LuArrowLeft />Browse all assets
                                </Button>
                            </VStack>
                        </Box>
                    )}

                    {!isLoading && asset && asset.denom !== '' && (
                        <>
                            <AssetHeader asset={asset} />
                            <Box
                                bgGradient="to-br"
                                gradientFrom="blue.500/5"
                                gradientTo="blue.600/5"
                                borderWidth="1px"
                                borderColor="blue.500/15"
                                borderRadius="xl"
                                shadow="sm"
                                p={{ base: 4, md: 6 }}
                            >
                                <AssetDetails asset={asset} />
                            </Box>
                        </>
                    )}
                </VStack>
            </Container>
        </Box>
    );
}

const AssetDetailsPage = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AssetDetailsPageContent />
        </Suspense>
    );
};

export default AssetDetailsPage;
