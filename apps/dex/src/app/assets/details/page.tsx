'use client';

import {Suspense, useCallback, useMemo} from 'react';
import {Box, Button, chakra, Flex, IconButton, Skeleton} from '@chakra-ui/react';
import {LuArrowLeft, LuLink, LuSearchX} from 'react-icons/lu';
import {
    AppLink,
    Asset,
    getExplorerTokenURL,
    useAsset,
    useAssetPrice,
    formatUsdAmount,
    HighlightText,
    TokenLogo,
    useToast,
    useBlockedIbcInbound,
    getLegacyAssetNotice,
    LegacyAssetNoticeBox,
    HaltedBadge, HaltedNotice,
    hgVariant, FeaturedCard, HgCard, HeroGlow, IconTile, PageContainer, Shimmer,
} from "@bze/bze-ui-kit";
import {useNavigationWithParams, assetPagePath} from "@/hooks/useNavigation";
import {VerifiedBadge} from "@/components/ui/badge/verified";
import {AssetDetails} from "@/components/ui/assets/asset-details";
import {PriceChange} from "@/components/ui/assets/price-change";
import {KindTag} from "@/components/ui/staking/staking-card-parts";

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

    return (
        <FeaturedCard as="section" aria-label={asset.name} borderRadius="21px" px={{base: '18px', md: '24px'}} py="22px">
            <Flex direction="column" gap="12px">
                <Flex align="center" gap="16px" wrap="wrap">
                    <Box
                        position="relative"
                        boxSize="56px"
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
                    <Flex direction="column" gap="4px" flex="1" minW="0">
                        <Flex align="center" gap="8px" wrap="wrap">
                            <chakra.h1 m="0" fontSize="26px" fontWeight="800" letterSpacing="-0.01em">{asset.name}</chakra.h1>
                            <KindTag>{asset.type.toUpperCase()}</KindTag>
                            {asset.verified && (<VerifiedBadge/>)}
                            {asset.halted && (<HaltedBadge/>)}
                        </Flex>
                        <chakra.span color="hg.text.faint" fontSize="14px">{asset.ticker}</chakra.span>
                    </Flex>

                    <Flex align="center" gap="10px">
                        <Flex direction="column" align="flex-end" gap="2px">
                            <Skeleton asChild loading={priceLoading}>
                                <HighlightText fontWeight="700" fontSize="20px">
                                    ${formattedPrice}
                                </HighlightText>
                            </Skeleton>
                            <Skeleton asChild loading={priceLoading}>
                                <PriceChange change={change} fontSize="13px"/>
                            </Skeleton>
                        </Flex>
                        <AppLink app="explorer" href={getExplorerTokenURL(asset.denom)}>Explorer</AppLink>
                        <IconButton
                            aria-label="Copy link to this asset"
                            size="lg"
                            variant={hgVariant('secondary')}
                            onClick={copyAssetLink}
                        >
                            <LuLink />
                        </IconButton>
                    </Flex>
                </Flex>

                <chakra.span fontSize="12px" fontFamily="mono" color="hg.text.faint" wordBreak="break-all">
                    {asset.denom}
                </chakra.span>
            </Flex>
        </FeaturedCard>
    )
}

const AssetDetailsPageContent = () => {
    const {toAssetsPage, denomParam} = useNavigationWithParams()
    const {asset, isLoading} = useAsset(denomParam ?? '')
    // Wind-down notice (e.g. USDC.n) — only while the chain refuses the asset's deposits.
    const blockedIbcInbound = useBlockedIbcInbound()
    const legacyNotice = useMemo(() => getLegacyAssetNotice(asset, blockedIbcInbound), [asset, blockedIbcInbound])

    const notFound = !isLoading && (!asset || asset.denom === '')

    return (
        <Box position="relative" minH="100vh">
            <HeroGlow strength="inner" h="420px"/>
            <PageContainer position="relative" zIndex="1" pt="28px" pb="80px">
                <Flex direction="column" gap="20px">
                    <Button
                        alignSelf="flex-start"
                        variant="ghost"
                        size="md"
                        px="12px"
                        color="hg.text.secondary"
                        onClick={() => toAssetsPage()}
                    >
                        <LuArrowLeft aria-hidden="true"/>Assets
                    </Button>

                    {isLoading && (
                        <Flex direction="column" gap="16px" aria-busy="true">
                            <Shimmer h="120px" borderRadius="22px" />
                            <Shimmer h="300px" borderRadius="22px" />
                        </Flex>
                    )}

                    {notFound && (
                        <HgCard borderRadius="22px">
                            <Flex direction="column" align="center" textAlign="center" gap="8px" py="10px">
                                <IconTile icon={<LuSearchX/>} variant="outline" size={48}/>
                                <chakra.strong fontSize="17px">Asset not found</chakra.strong>
                                <chakra.span fontSize="14px" color="fg.muted" maxW="360px" lineHeight="1.5">
                                    We couldn&apos;t find an asset for this link. It may have been removed or the link is incorrect.
                                </chakra.span>
                                <Button mt="4px" size="md" variant={hgVariant('secondary')} onClick={() => toAssetsPage()}>
                                    <LuArrowLeft aria-hidden="true"/>Browse all assets
                                </Button>
                            </Flex>
                        </HgCard>
                    )}

                    {!isLoading && asset && asset.denom !== '' && (
                        <>
                            <AssetHeader asset={asset} />
                            {legacyNotice && <LegacyAssetNoticeBox notice={legacyNotice} />}
                            {asset.halted && <HaltedNotice tickers={[asset.ticker]} />}
                            <HgCard as="section" aria-label="Asset details" borderRadius="22px" p={{base: '18px', md: '22px'}}>
                                <AssetDetails asset={asset} />
                            </HgCard>
                        </>
                    )}
                </Flex>
            </PageContainer>
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
