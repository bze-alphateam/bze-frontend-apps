"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, Grid, HStack, IconButton, Link, Text, VStack, chakra } from '@chakra-ui/react'
import { LuChevronRight, LuCopy } from 'react-icons/lu'
import {
    AppLink,
    Asset,
    HeroGlow,
    PageContainer,
    Shimmer,
    TokenLogo,
    getCommunitiesApp,
    getDexApp,
    getExplorerBaseURL,
    useToast,
} from '@bze/bze-ui-kit'
import { TrustBadge } from '@/components/ui/trust-badge'
import { StatBox } from '@/components/workspace/stat-box'
import { TOKENS_PATH } from '@/lib/tokens-directory'

/** The token's page in BZE Scan (one encoded path segment, like the explorer's own links). */
export const explorerTokenHref = (denom: string) => `${getExplorerBaseURL()}/tokens/${encodeURIComponent(denom)}`

/** The header's three numbers: total supply, what the wallet holds (when connected), what is staked. */
export interface HeaderStats {
    supply: React.ReactNode;
    /** Undefined without a wallet: the stat is left out. */
    held?: React.ReactNode;
    staked: React.ReactNode;
}

/**
 * The token page's band: breadcrumb, identity with the trust badge and the one owner badge, the denom
 * with copy, the stats and the links to the token's pages in other BZE apps.
 */
export function TokenHeader({ asset, admin, isAdminLoading, badge, stats }: {
    asset: Asset;
    /** The live admin (address, '' renounced, undefined unknown) for the trust badge. */
    admin: string | undefined;
    /** The admin query is still running: no trust badge yet. */
    isAdminLoading: boolean;
    /** "Created by you · you are admin" and friends; undefined shows none. */
    badge?: string;
    stats: HeaderStats;
}) {
    const { toast } = useToast()
    const encoded = encodeURIComponent(asset.denom)

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider" data-testid="token-header">
            <HeroGlow strength="inner" />
            <PageContainer position="relative" pt="24px" pb="28px">
                <VStack align="stretch" gap="18px">
                    <HStack as="nav" aria-label="Breadcrumb" gap="6px" fontSize="14px" color="fg.muted">
                        <Link asChild color="hg.link" fontWeight="600">
                            <NextLink href={TOKENS_PATH}>Tokens</NextLink>
                        </Link>
                        <LuChevronRight size={14} aria-hidden />
                        <Text as="span" color="fg" aria-current="page">{asset.ticker}</Text>
                    </HStack>

                    <HStack gap="16px" align="start">
                        <Box flexShrink={0} borderRadius="full" boxShadow="0 0 0 2px {colors.app.border}">
                            <TokenLogo src={asset.logo} symbol={asset.ticker} size="14" circular={true} />
                        </Box>
                        <VStack align="start" gap="6px" minW={0} flex="1">
                            <HStack gap="10px" flexWrap="wrap">
                                <Text as="h1" fontSize={{ base: '24px', md: '30px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.15" wordBreak="break-word">
                                    {asset.name}
                                </Text>
                                <Text fontSize="16px" color="fg.muted">{asset.ticker}</Text>
                                {!isAdminLoading && <TrustBadge admin={admin} />}
                            </HStack>
                            {badge && (
                                <chakra.span
                                    fontSize="12px"
                                    fontWeight="600"
                                    px="10px"
                                    py="3px"
                                    borderRadius="hg.pill"
                                    color="hg.link"
                                    bg="app.subtle"
                                    borderWidth="1px"
                                    borderColor="app.border"
                                    data-testid="owner-badge"
                                >
                                    {badge}
                                </chakra.span>
                            )}
                            <HStack gap="6px" minW={0} maxW="full">
                                <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" wordBreak="break-all">
                                    {asset.denom}
                                </Text>
                                <IconButton aria-label="Copy denom" size="2xs" variant="ghost" color="hg.link" onClick={copyDenom}>
                                    <LuCopy />
                                </IconButton>
                            </HStack>
                            <HStack gap="8px" flexWrap="wrap" mt="4px">
                                <AppLink app="dex" href={`${getDexApp().href}/assets/details?denom=${encoded}`}>DEX</AppLink>
                                <AppLink app="communities" href={`${getCommunitiesApp().href}/token?denom=${encoded}`}>Communities</AppLink>
                                <AppLink app="explorer" href={explorerTokenHref(asset.denom)}>Explorer</AppLink>
                            </HStack>
                        </VStack>
                    </HStack>

                    <Grid
                        templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: `repeat(${stats.held === undefined ? 2 : 3}, minmax(0, 1fr))` }}
                        gap={{ base: '12px', md: '16px' }}
                        data-testid="token-stats"
                    >
                        <StatBox minW="0" label="Supply" value={stats.supply} />
                        {stats.held !== undefined && <StatBox minW="0" label="You hold" value={stats.held} />}
                        <StatBox minW="0" label="Staked" value={stats.staked} />
                    </Grid>
                </VStack>
            </PageContainer>
        </Box>
    )
}

/** A stat's value while it loads. */
export const StatShimmer = () => <Shimmer h="18px" w="96px" />
