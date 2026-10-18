"use client"

import React, { useState } from 'react'
import NextLink from 'next/link'
import {
    Badge,
    Box,
    Button,
    Card,
    Collapsible,
    Container,
    HStack,
    IconButton,
    Link,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import { LuChevronDown, LuCircleHelp, LuCoins, LuCopy, LuLock, LuPlus, LuTriangleAlert } from 'react-icons/lu'
import {
    AppButton,
    TokenLogo,
    getBurnerApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useToast,
} from '@bze/bze-ui-kit'
import { CreatedByYou } from '@/components/manage/created-by-you'
import { SetupProgress } from '@/components/manage/setup-progress'
import { rewardsHref } from '@/lib/rewards-directory'
import { workspaceHref } from '@/lib/workspace'
import { useMyTokens, type MyToken } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'

/** Setup progress runs a few chain queries per token, so only this many cards show at a time. */
const TOKENS_PAGE_SIZE = 10


// Same trust semantics as the dex assets page: an active admin can mint more,
// only a renounced admin makes the supply provably fixed. A failed lookup
// (undefined) gets a neutral badge — it must never read as "fixed supply".
function TrustBadge({ admin }: { admin: string | undefined }) {
    if (admin === undefined) {
        return (
            <Badge colorPalette="gray" variant="surface" size="sm">
                <LuCircleHelp size={12} /> Control unknown
            </Badge>
        )
    }
    return admin === '' ? (
        <Badge colorPalette="green" variant="surface" size="sm">
            <LuLock size={12} /> Fixed supply
        </Badge>
    ) : (
        <Badge colorPalette="orange" variant="surface" size="sm">
            <LuTriangleAlert size={12} /> Mintable
        </Badge>
    )
}

function TokenCard({ token }: { token: MyToken }) {
    const { asset, admin } = token
    const { toast } = useToast()
    const { navigate } = useNavigation()

    const burnerUrl = `${getBurnerApp().href}/coin?coin=${encodeURIComponent(asset.denom)}`

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <Card.Root variant="outline" p={4} borderColor="yellow.500/20" data-testid="my-token">
            <VStack align="stretch" gap={3}>
                <HStack justify="space-between" align="start" gap={3}>
                    <HStack gap={3} minW={0}>
                        <TokenLogo src={asset.logo} symbol={asset.ticker} size="10" circular={true} />
                        <VStack align="start" gap={0} minW={0}>
                            <HStack gap={2} flexWrap="wrap">
                                <Text fontWeight="semibold" wordBreak="break-word">{asset.name}</Text>
                                <Text fontSize="sm" color="fg.muted">{asset.ticker}</Text>
                            </HStack>
                            <SetupProgress denom={asset.denom} admin={admin} />
                        </VStack>
                    </HStack>
                    <Box flexShrink={0}><TrustBadge admin={admin} /></Box>
                </HStack>

                <HStack justify="space-between" align="end" gap={3} flexWrap="wrap">
                    <VStack align="start" gap={0.5} minW={0} maxW="full">
                        <Text fontSize="xs" color="fg.muted">Total supply</Text>
                        <Text fontSize="sm" fontWeight="medium">
                            {`${prettyAmount(uAmountToBigNumberAmount(asset.supply, asset.decimals))} ${asset.ticker}`}
                        </Text>
                        <HStack gap={1} minW={0} maxW="full">
                            <Text fontSize="xs" color="fg.muted" fontFamily="mono" truncate>{asset.denom}</Text>
                            <IconButton aria-label="Copy denom" size="2xs" variant="ghost" colorPalette="yellow" onClick={copyDenom}>
                                <LuCopy />
                            </IconButton>
                        </HStack>
                    </VStack>
                    <HStack gap={2}>
                        <AppButton app="burner" href={burnerUrl} size="sm">Burn on Burner</AppButton>
                        <Button size="sm" colorPalette="yellow" onClick={() => navigate(workspaceHref(asset.denom))}>
                            Open
                        </Button>
                    </HStack>
                </HStack>
            </VStack>
        </Card.Root>
    )
}

function TokenCardSkeleton() {
    return (
        <Card.Root variant="outline" p={4}>
            <HStack gap={3}>
                <Skeleton borderRadius="full" boxSize="10" />
                <VStack align="start" gap={2}>
                    <Skeleton height="4" width="32" />
                    <Skeleton height="3" width="48" />
                </VStack>
            </HStack>
        </Card.Root>
    )
}

function BadgesNote() {
    return (
        <Collapsible.Root lazyMount unmountOnExit>
            <Collapsible.Trigger asChild>
                <Button size="sm" variant="ghost" colorPalette="gray" alignSelf="start" px={1}>
                    <LuCircleHelp /> What do the badges mean? <LuChevronDown />
                </Button>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <Box mt={2} p={3} borderRadius="lg" bg="blue.500/10" borderWidth="1px" borderColor="blue.500/25" fontSize="sm" color="fg.muted">
                    <b>Mintable</b>{': you still control the token, so you can mint more, burn, and update metadata. '}
                    <b>Fixed supply</b>{': the supply was locked, so nobody can ever change the supply or metadata again. '}
                    <b>Control unknown</b>{": the chain couldn't be asked right now. Open a token to mint, burn, edit its profile, hand over control, or lock it for good."}
                </Box>
            </Collapsible.Content>
        </Collapsible.Root>
    )
}

export default function ManagePage() {
    const { tokens, isLoading } = useMyTokens()
    const { navigate } = useNavigation()
    const [shown, setShown] = useState(TOKENS_PAGE_SIZE)

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="4xl" py={{ base: 6, md: 10 }}>
                <VStack align="stretch" gap={6}>
                    <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                        <VStack align="start" gap={1}>
                            <Text as="h1" fontSize="2xl" fontWeight="bold" letterSpacing="tight">Your tokens</Text>
                            <Text fontSize="sm" color="fg.muted">
                                Everything created by your connected address, straight from the chain.
                            </Text>
                        </VStack>
                        <Button size="sm" colorPalette="yellow" onClick={() => navigate('/token/new')}>
                            <LuPlus />
                            New token
                        </Button>
                    </HStack>

                    {isLoading ? (
                        <VStack align="stretch" gap={3}>
                            <TokenCardSkeleton />
                            <TokenCardSkeleton />
                        </VStack>
                    ) : tokens.length === 0 ? (
                        <Card.Root variant="outline" p={10}>
                            <VStack gap={4}>
                                <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                                    <LuCoins size={28} />
                                </Box>
                                <VStack gap={1}>
                                    <Text fontWeight="semibold">No tokens yet.</Text>
                                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                                        {"Connect your wallet if you haven't already."}
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
                            {tokens.slice(0, shown).map(token => (
                                <TokenCard key={token.asset.denom} token={token} />
                            ))}
                            {tokens.length > shown && (
                                <Button variant="outline" colorPalette="yellow" onClick={() => setShown(n => n + TOKENS_PAGE_SIZE)}>
                                    {`Show more (${tokens.length - shown} left)`}
                                </Button>
                            )}
                        </VStack>
                    )}

                    <BadgesNote />

                    <CreatedByYou />

                    <Text fontSize="sm" data-testid="staking-programs-moved">
                        <Link asChild={true} colorPalette="yellow" fontWeight="medium">
                            <NextLink href={rewardsHref({ tab: 'programs' })}>
                                {"Looking for staking programs? They're under Rewards →"}
                            </NextLink>
                        </Link>
                    </Text>
                </VStack>
            </Container>
        </Box>
    )
}
