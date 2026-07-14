"use client"

import React from 'react'
import {
    Badge,
    Box,
    Button,
    Card,
    Container,
    HStack,
    IconButton,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import { LuCoins, LuCopy, LuLock, LuPlus, LuTriangleAlert } from 'react-icons/lu'
import {
    TokenLogo,
    prettyAmount,
    uAmountToBigNumberAmount,
    useToast,
} from '@bze/bze-ui-kit'
import { MyMarkets } from '@/components/manage/my-markets'
import { MyPools } from '@/components/manage/my-pools'
import { StakingRewards } from '@/components/manage/staking-rewards'
import { InfoBox } from '@/components/ui/info-box'
import { useMyTokens, type MyToken } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'

// Same trust semantics as the dex assets page: an active admin can mint more,
// only a renounced admin makes the supply provably fixed.
function TrustBadge({ renounced }: { renounced: boolean }) {
    return renounced ? (
        <Badge colorPalette="green" variant="surface" size="sm">
            <LuLock size={12} /> Fixed supply
        </Badge>
    ) : (
        <Badge colorPalette="orange" variant="surface" size="sm">
            <LuTriangleAlert size={12} /> Mintable
        </Badge>
    )
}

function TokenRow({ token }: { token: MyToken }) {
    const { asset, admin } = token
    const { toast } = useToast()
    const { navigate } = useNavigation()

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
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
                    <TokenLogo src={asset.logo} symbol={asset.ticker} size="10" circular={true} />
                    <VStack align="start" gap="0.5" minW="0">
                        <HStack gap="2">
                            <Text fontWeight="semibold">{asset.name}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {asset.ticker}
                            </Text>
                        </HStack>
                        <HStack gap="1">
                            <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate maxW={{ base: '52', md: 'md' }}>
                                {asset.denom}
                            </Text>
                            <IconButton
                                aria-label="Copy denom"
                                size="2xs"
                                variant="ghost"
                                colorPalette="yellow"
                                onClick={copyDenom}
                            >
                                <LuCopy />
                            </IconButton>
                        </HStack>
                    </VStack>
                </HStack>

                <HStack gap={4} flexWrap="wrap">
                    <VStack align="end" gap="0.5">
                        <Text fontSize="xs" color="fg.muted">
                            Total supply
                        </Text>
                        <Text fontSize="sm" fontWeight="medium">
                            {prettyAmount(uAmountToBigNumberAmount(asset.supply, asset.decimals))} {asset.ticker}
                        </Text>
                    </VStack>
                    <TrustBadge renounced={admin === ''} />
                    <Button
                        size="sm"
                        variant="outline"
                        colorPalette="yellow"
                        onClick={() => navigate(`/manage/token?denom=${encodeURIComponent(asset.denom)}`)}
                    >
                        Manage
                    </Button>
                </HStack>
            </HStack>
        </Card.Root>
    )
}

function TokenRowSkeleton() {
    return (
        <Card.Root variant="outline" p="4">
            <HStack justify="space-between" align="center" gap={4}>
                <HStack gap="3">
                    <Skeleton borderRadius="full" boxSize="10" />
                    <VStack align="start" gap="2">
                        <Skeleton height="4" width="32" />
                        <Skeleton height="3" width="48" />
                    </VStack>
                </HStack>
                <Skeleton height="6" width="24" />
            </HStack>
        </Card.Root>
    )
}

export default function ManagePage() {
    const { tokens, isLoading } = useMyTokens()
    const { navigate } = useNavigation()

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="4xl" py={{ base: 6, md: 10 }}>
                <VStack align="stretch" gap={6}>
                    <VStack align="start" gap={1}>
                        <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                            My Creations
                        </Text>
                        <Text fontSize="sm" color="fg.muted">
                            Everything created by your connected address — straight from the chain.
                        </Text>
                    </VStack>

                    <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                        <VStack align="start" gap={1}>
                            <Text fontSize="xl" fontWeight="bold" letterSpacing="tight">
                                My Tokens
                            </Text>
                        </VStack>
                        <Button size="sm" colorPalette="yellow" onClick={() => navigate('/token/new')}>
                            <LuPlus />
                            New token
                        </Button>
                    </HStack>

                    {isLoading ? (
                        <VStack align="stretch" gap={3}>
                            <TokenRowSkeleton />
                            <TokenRowSkeleton />
                        </VStack>
                    ) : tokens.length === 0 ? (
                        <Card.Root variant="outline" p="10">
                            <VStack gap={4}>
                                <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                                    <LuCoins size={28} />
                                </Box>
                                <VStack gap={1}>
                                    <Text fontWeight="semibold">No tokens yet</Text>
                                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                                        Tokens you create appear here, with their supply and admin status.
                                        Connect your wallet if you haven&apos;t already.
                                    </Text>
                                </VStack>
                                <Button colorPalette="yellow" onClick={() => navigate('/token/new')}>
                                    <LuPlus />
                                    Create your first token
                                </Button>
                            </VStack>
                        </Card.Root>
                    ) : (
                        <VStack align="stretch" gap={3}>
                            {tokens.map(token => (
                                <TokenRow key={token.asset.denom} token={token} />
                            ))}
                        </VStack>
                    )}

                    <InfoBox title="What do the badges mean?">
                        <b>Mintable</b> — the token still has an admin (you) who can mint more, burn, and
                        update metadata. <b>Fixed supply</b> — the admin was renounced: nobody can ever
                        change the supply or metadata again. Open Manage on a token to mint, burn,
                        edit its metadata, transfer the admin, or renounce it for good.
                    </InfoBox>

                    <MyMarkets />

                    <MyPools />

                    <StakingRewards />
                </VStack>
            </Container>
        </Box>
    )
}
