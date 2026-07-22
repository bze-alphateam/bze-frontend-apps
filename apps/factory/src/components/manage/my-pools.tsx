"use client"

import React, { useMemo } from 'react'
import {
    Box,
    Button,
    Card,
    HStack,
    IconButton,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuArrowUpRight, LuCopy, LuDroplets, LuPlus } from 'react-icons/lu'
import {
    TokenLogo,
    getChainName,
    getDexApp,
    useAsset,
    useLiquidityPools,
    useToast,
} from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import { useChain } from '@interchain-kit/react'
import { useNavigation } from '@/hooks/useNavigation'

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

function PoolRow({ pool }: { pool: LiquidityPoolSDKType }) {
    const { asset: baseAsset } = useAsset(pool.base)
    const { asset: quoteAsset } = useAsset(pool.quote)
    const { toast } = useToast()
    const { navigate } = useNavigation()

    const dexUrl = getDexApp().href
    const poolUrl = `${dexUrl}/pools/details?id=${encodeURIComponent(pool.id)}`
    // The chain stores the fee as a decimal (e.g. "0.002" = 0.2%).
    const feeLabel = `${new BigNumber(pool.fee).multipliedBy(100).toString()}%`

    const copyLpDenom = async () => {
        await navigator.clipboard.writeText(pool.lp_denom)
        toast.success('Copied', 'LP denom copied to clipboard.')
    }

    return (
        <Card.Root
            variant="outline"
            p="4"
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderColor="yellow.500/20"
        >
            <HStack justify="space-between" align="center" gap={4} flexWrap="wrap">
                <HStack gap="3" minW="0">
                    <HStack gap="0">
                        <TokenLogo src={baseAsset?.logo ?? ''} symbol={baseAsset?.ticker ?? '?'} size="10" circular={true} />
                        <Box ml="-3">
                            <TokenLogo src={quoteAsset?.logo ?? ''} symbol={quoteAsset?.ticker ?? '?'} size="10" circular={true} />
                        </Box>
                    </HStack>
                    <VStack align="start" gap="0.5" minW="0">
                        <HStack gap="2">
                            <Text fontWeight="semibold">
                                {baseAsset?.ticker ?? pool.base}/{quoteAsset?.ticker ?? pool.quote}
                            </Text>
                            <Text fontSize="sm" color="fg.muted">
                                {feeLabel} swap fee
                            </Text>
                        </HStack>
                        <HStack gap="1">
                            <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate maxW={{ base: '52', md: 'md' }}>
                                {pool.lp_denom}
                            </Text>
                            <IconButton
                                aria-label="Copy LP denom"
                                size="2xs"
                                variant="ghost"
                                colorPalette="yellow"
                                onClick={copyLpDenom}
                            >
                                <LuCopy />
                            </IconButton>
                        </HStack>
                    </VStack>
                </HStack>

                <HStack gap={2} flexWrap="wrap">
                    <Button
                        size="sm"
                        variant="outline"
                        colorPalette="yellow"
                        onClick={() => navigate(`/pool/add?pool=${encodeURIComponent(pool.id)}`)}
                    >
                        <LuPlus />
                        Add liquidity
                    </Button>
                    <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => openExternal(poolUrl)}>
                        View on DEX <LuArrowUpRight />
                    </Button>
                </HStack>
            </HStack>
        </Card.Root>
    )
}

function PoolRowSkeleton() {
    return (
        <Card.Root variant="outline" p="4">
            <HStack justify="space-between" align="center" gap={4}>
                <HStack gap="3">
                    <Skeleton borderRadius="full" boxSize="10" />
                    <VStack align="start" gap="2">
                        <Skeleton height="4" width="24" />
                        <Skeleton height="3" width="48" />
                    </VStack>
                </HStack>
                <Skeleton height="6" width="24" />
            </HStack>
        </Card.Root>
    )
}

/** The liquidity pools the connected address created (creator is on-chain). */
export function MyPools() {
    const { pools, isLoading } = useLiquidityPools()
    const { address } = useChain(getChainName())
    const { navigate } = useNavigation()

    const myPools = useMemo(
        () => (address ? pools.filter(p => p.creator === address) : []),
        [pools, address]
    )

    return (
        <VStack align="stretch" gap={4}>
            <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                <VStack align="start" gap={1}>
                    <Text fontSize="xl" fontWeight="bold" letterSpacing="tight">
                        My Pools
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        Liquidity pools you seeded — anyone can add liquidity or swap.
                    </Text>
                </VStack>
                <Button size="sm" colorPalette="yellow" variant="outline" onClick={() => navigate('/pool/new')}>
                    <LuPlus />
                    New pool
                </Button>
            </HStack>

            {isLoading ? (
                <VStack align="stretch" gap={3}>
                    <PoolRowSkeleton />
                </VStack>
            ) : myPools.length === 0 ? (
                <Card.Root variant="outline" p="8">
                    <VStack gap={4}>
                        <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                            <LuDroplets size={24} />
                        </Box>
                        <VStack gap={1}>
                            <Text fontWeight="semibold">No pools yet</Text>
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Seed an AMM pool for any pair — including your own tokens — and
                                earn swap fees as liquidity provider.
                            </Text>
                        </VStack>
                        <Button colorPalette="yellow" variant="outline" onClick={() => navigate('/pool/new')}>
                            <LuPlus />
                            Create a pool
                        </Button>
                    </VStack>
                </Card.Root>
            ) : (
                <VStack align="stretch" gap={3}>
                    {myPools.map(pool => (
                        <PoolRow key={pool.id} pool={pool} />
                    ))}
                </VStack>
            )}
        </VStack>
    )
}
