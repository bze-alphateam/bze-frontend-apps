'use client';

import React, {Suspense, useCallback, useEffect, useMemo, useState} from "react";
import {Box, Button, Container, HStack, IconButton, Skeleton, Text, VStack} from "@chakra-ui/react";
import {LuArrowLeft, LuCheck, LuCopy, LuSearchX} from "react-icons/lu";
import {Asset, isFactoryDenom, prettyAmount, TokenLogo, uAmountToAmount, useAsset, useToast} from "@bze/bze-ui-kit";

import {useDenomParam, useNavigation} from "@/hooks/useNavigation";
import {useTokenBranding} from "@/contexts/token_branding_context";
import {VerifiedBadge} from "@/components/ui/badge/verified";
import {TokenBurnStats} from "@/components/ui/tokens/token-burn-stats";
import {TokenStakingRewards} from "@/components/ui/tokens/token-staking-rewards";

const CopyableDenom = ({denom, ticker}: { denom: string; ticker: string }) => {
    const {toast} = useToast();
    const [copied, setCopied] = useState(false);

    const onCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(denom);
            setCopied(true);
            toast.success("Denom copied", `${ticker} denom copied to clipboard`);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable: ignore */
        }
    }, [denom, ticker, toast]);

    return (
        <HStack
            gap={2}
            align="center"
            justify="space-between"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="md"
            bg="bg.surface"
            px={3}
            py={2}
        >
            <Text fontFamily="mono" fontSize="xs" color="fg.muted" wordBreak="break-all">
                {denom}
            </Text>
            <IconButton aria-label="Copy denom" size="xs" variant="ghost" colorPalette="green" onClick={onCopy} flexShrink={0}>
                {copied ? <LuCheck/> : <LuCopy/>}
            </IconButton>
        </HStack>
    );
};

const TokenOverview = ({asset}: { asset: Asset }) => {
    const formattedSupply = useMemo(
        () => prettyAmount(uAmountToAmount(asset.supply, asset.decimals)),
        [asset.supply, asset.decimals],
    );

    return (
        <Box
            bgGradient="to-br"
            gradientFrom="green.500/8"
            gradientTo="green.600/8"
            borderWidth="1px"
            borderColor="green.500/20"
            borderRadius="xl"
            shadow="sm"
            p={{base: 4, md: 6}}
        >
            <VStack align="stretch" gap={5}>
                <HStack gap={4} align="center">
                    <Box
                        position="relative"
                        width="56px"
                        height="56px"
                        borderRadius="full"
                        bg="bg.surface"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        flexShrink={0}
                    >
                        <TokenLogo src={asset.logo} symbol={asset.ticker} circular={true}/>
                    </Box>
                    <Box minW={0}>
                        <HStack gap={2} flexWrap="wrap">
                            <Text fontWeight="bold" fontSize={{base: "xl", md: "2xl"}} lineClamp={1}>
                                {asset.name}
                            </Text>
                            {asset.verified && <VerifiedBadge/>}
                        </HStack>
                        <Text color="fg.muted" fontSize="md">
                            {asset.ticker}
                        </Text>
                    </Box>
                </HStack>

                {asset.description && (
                    <Text fontSize="sm" color="fg.default" whiteSpace="pre-line">
                        {asset.description}
                    </Text>
                )}

                <Box>
                    <Text fontSize="xs" color="fg.muted" textTransform="uppercase" mb={1}>
                        Total supply
                    </Text>
                    <Text fontWeight="semibold" fontSize="lg">
                        {formattedSupply} {asset.ticker}
                    </Text>
                </Box>

                <Box>
                    <Text fontSize="xs" color="fg.muted" textTransform="uppercase" mb={1}>
                        Denom
                    </Text>
                    <CopyableDenom denom={asset.denom} ticker={asset.ticker}/>
                </Box>
            </VStack>
        </Box>
    );
};

const NotFound = () => {
    const {navigate} = useNavigation();

    return (
        <Box
            bgGradient="to-br"
            gradientFrom="green.500/8"
            gradientTo="green.600/8"
            borderWidth="1px"
            borderColor="green.500/20"
            borderRadius="xl"
            shadow="sm"
            p={10}
        >
            <VStack gap={3}>
                <LuSearchX size={32} color="var(--chakra-colors-fg-muted)"/>
                <Text fontSize="lg" fontWeight="semibold">Token not found</Text>
                <Text fontSize="sm" color="fg.muted" textAlign="center" maxW="md">
                    We couldn&apos;t find a Token Factory token for this link. It may have been removed,
                    the denom is not a factory token, or the link is incorrect.
                </Text>
                <Button size="sm" variant="outline" colorPalette="green" onClick={() => navigate("/")}>
                    <LuArrowLeft/>Browse all tokens
                </Button>
            </VStack>
        </Box>
    );
};

const TokenPageContent = () => {
    const {navigate} = useNavigation();
    const denom = useDenomParam();
    const {asset, isLoading} = useAsset(denom ?? "");
    const {setBrand} = useTokenBranding();

    // Only factory tokens get a page (Business Logic §1, §3). A resolved non-factory
    // denom (BZE, IBC) exists in the assets map but must render the not-found state.
    const resolved = useMemo(() => {
        if (isLoading || !asset || asset.denom === "" || !isFactoryDenom(asset.denom)) {
            return null;
        }

        return asset;
    }, [isLoading, asset]);

    const notFound = !isLoading && !resolved;

    // Rebrand the shared chrome to this token while the page is mounted; restore
    // normal branding when the token changes or we leave the page.
    useEffect(() => {
        if (resolved) {
            setBrand({name: resolved.name, ticker: resolved.ticker, logo: resolved.logo});
        } else {
            setBrand(null);
        }

        return () => setBrand(null);
    }, [resolved, setBrand]);

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="3xl" py={{base: 8, md: 12}}>
                <VStack align="stretch" gap={6}>
                    <Box>
                        <Button variant="ghost" size="sm" colorPalette="green" onClick={() => navigate("/")}>
                            <LuArrowLeft/>Directory
                        </Button>
                    </Box>

                    {isLoading && (
                        <VStack align="stretch" gap={4}>
                            <Skeleton height="200px" borderRadius="xl"/>
                        </VStack>
                    )}

                    {notFound && <NotFound/>}

                    {resolved && (
                        <>
                            <TokenOverview asset={resolved}/>
                            <TokenStakingRewards asset={resolved}/>
                            <TokenBurnStats asset={resolved}/>
                        </>
                    )}
                </VStack>
            </Container>
        </Box>
    );
};

export default function TokenPage() {
    return (
        <Suspense fallback={
            <Box minH="100vh" bg="bg.subtle">
                <Container maxW="3xl" py={{base: 8, md: 12}}>
                    <Skeleton height="200px" borderRadius="xl"/>
                </Container>
            </Box>
        }>
            <TokenPageContent/>
        </Suspense>
    );
}
