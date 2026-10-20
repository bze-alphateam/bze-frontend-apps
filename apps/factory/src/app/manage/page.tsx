"use client"

import React, { useState } from 'react'
import NextLink from 'next/link'
import {
    Box,
    Button,
    chakra,
    Collapsible,
    Flex,
    Grid,
    HStack,
    IconButton,
    Text,
    VStack,
} from '@chakra-ui/react'
import { LuChevronDown, LuCircleHelp, LuCoins, LuCopy, LuInfo, LuPlus } from 'react-icons/lu'
import {
    HgCard,
    PageContainer,
    PageState,
    Shimmer,
    TokenLogo,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useToast,
} from '@bze/bze-ui-kit'
import { CreatedByYou } from '@/components/manage/created-by-you'
import { SetupProgress } from '@/components/manage/setup-progress'
import { InnerHero } from '@/components/ui/inner-hero'
import { TrustBadge } from '@/components/ui/trust-badge'
import { rewardsHref } from '@/lib/rewards-directory'
import { workspaceHref } from '@/lib/workspace'
import { useMyTokens, type MyToken } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'

/** Setup progress runs a few chain queries per token, so only this many cards show at a time. */
const TOKENS_PAGE_SIZE = 10


function TokenCard({ token }: { token: MyToken }) {
    const { asset, admin } = token
    const { toast } = useToast()
    const { navigate } = useNavigation()

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <HgCard as="article" interactive p="20px" display="flex" flexDirection="column" gap="16px" minW={0} data-testid="my-token">
            <Flex justify="space-between" align="start" gap="12px">
                <HStack gap="12px" minW={0} align="start">
                    <TokenLogo src={asset.logo} symbol={asset.ticker} size="10" circular={true} />
                    <VStack align="start" gap="4px" minW={0}>
                        <HStack gap="8px" flexWrap="wrap" align="baseline">
                            <Text as="strong" fontSize="16px" fontWeight="700" wordBreak="break-word">{asset.name}</Text>
                            <Text fontSize="14px" color="fg.muted">{asset.ticker}</Text>
                        </HStack>
                        <SetupProgress denom={asset.denom} admin={admin} />
                    </VStack>
                </HStack>
                <Box flexShrink={0}><TrustBadge admin={admin} /></Box>
            </Flex>

            <Flex justify="space-between" align="end" gap="12px" wrap="wrap">
                <VStack align="start" gap="3px" minW={0} maxW="full">
                    <Text fontSize="12px" color="hg.text.faint">Total supply</Text>
                    <Text fontSize="14px" fontWeight="600">
                        {`${prettyAmount(uAmountToBigNumberAmount(asset.supply, asset.decimals))} ${asset.ticker}`}
                    </Text>
                    <HStack gap="6px" minW={0} maxW="full">
                        <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" truncate>{asset.denom}</Text>
                        <IconButton aria-label="Copy denom" size="2xs" variant="ghost" color="hg.link" onClick={copyDenom}>
                            <LuCopy />
                        </IconButton>
                    </HStack>
                </VStack>
                <Button size="md" variant={hgVariant('primary')} onClick={() => navigate(workspaceHref(asset.denom))}>
                    Open
                </Button>
            </Flex>
        </HgCard>
    )
}

function TokenCardSkeleton() {
    return (
        <HgCard p="20px" aria-hidden>
            <HStack gap="12px">
                <Shimmer borderRadius="full" boxSize="40px" flex="none" />
                <VStack align="stretch" gap="8px" flex="1">
                    <Shimmer h="16px" w="45%" />
                    <Shimmer h="12px" w="65%" />
                </VStack>
            </HStack>
        </HgCard>
    )
}

function BadgesNote() {
    return (
        <Collapsible.Root lazyMount unmountOnExit>
            <Collapsible.Trigger asChild>
                <Button size="sm" variant="ghost" color="hg.text.secondary" fontWeight="600" fontSize="14px" alignSelf="start" px="6px">
                    <LuCircleHelp /> What do the badges mean? <LuChevronDown />
                </Button>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <HgCard mt="10px" px="16px" py="14px" borderRadius="14px" display="flex" gap="10px" alignItems="flex-start" fontSize="14px" lineHeight="1.6" color="fg.muted">
                    <Box color="hg.link" mt="4px" flexShrink={0} aria-hidden><LuInfo size={16} /></Box>
                    <chakra.span>
                        <chakra.b color="fg">Mintable</chakra.b>{': you still control the token, so you can mint more, burn, and update metadata. '}
                        <chakra.b color="fg">Fixed supply</chakra.b>{': the supply was locked, so nobody can ever change the supply or metadata again. '}
                        <chakra.b color="fg">Control unknown</chakra.b>{": the chain couldn't be asked right now. Open a token to mint, burn, edit its profile, hand over control, or lock it for good."}
                    </chakra.span>
                </HgCard>
            </Collapsible.Content>
        </Collapsible.Root>
    )
}

export default function ManagePage() {
    const { tokens, isLoading } = useMyTokens()
    const { navigate } = useNavigation()
    const [shown, setShown] = useState(TOKENS_PAGE_SIZE)

    return (
        <Box minH="100vh">
            <InnerHero
                title="Your tokens"
                subtitle="Everything created by your connected address, straight from the chain."
                actions={(
                    <Button variant={hgVariant('primary')} size="lg" onClick={() => navigate('/token/new')}>
                        <LuPlus />
                        New token
                    </Button>
                )}
            />
            <PageContainer as="main" pt="32px" pb="64px">
                <VStack align="stretch" gap="36px">
                    <VStack as="section" aria-label="Your tokens" align="stretch" gap="14px">
                        {isLoading ? (
                            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px">
                                <TokenCardSkeleton />
                                <TokenCardSkeleton />
                            </Grid>
                        ) : tokens.length === 0 ? (
                            <HgCard p="16px">
                                <PageState
                                    kind="empty"
                                    icon={<LuCoins />}
                                    title="No tokens yet."
                                    description="Connect your wallet if you haven't already."
                                    action={(
                                        <Button variant={hgVariant('primary')} size="lg" onClick={() => navigate('/token/new')}>
                                            <LuPlus />
                                            Create your first token
                                        </Button>
                                    )}
                                />
                            </HgCard>
                        ) : (
                            <>
                                <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px">
                                    {tokens.slice(0, shown).map(token => (
                                        <TokenCard key={token.asset.denom} token={token} />
                                    ))}
                                </Grid>
                                {tokens.length > shown && (
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        borderColor="app.border"
                                        bg="app.subtle"
                                        color="fg"
                                        borderRadius="hg.md"
                                        _hover={{ bg: 'app.muted' }}
                                        onClick={() => setShown(n => n + TOKENS_PAGE_SIZE)}
                                    >
                                        {`Show more (${tokens.length - shown} left)`}
                                    </Button>
                                )}
                            </>
                        )}
                    </VStack>

                    <BadgesNote />

                    <CreatedByYou />

                    <Text fontSize="14px" data-testid="staking-programs-moved">
                        <chakra.a asChild color="hg.link" fontWeight="600" _hover={{ color: 'hg.link.hover' }}>
                            <NextLink href={rewardsHref({ tab: 'programs' })}>
                                {"Looking for staking programs? They're under Rewards →"}
                            </NextLink>
                        </chakra.a>
                    </Text>
                </VStack>
            </PageContainer>
        </Box>
    )
}
