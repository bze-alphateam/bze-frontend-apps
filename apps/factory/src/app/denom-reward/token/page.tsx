"use client"

import React, { Suspense } from 'react'
import { Box, Button, Container, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft } from 'react-icons/lu'
import { TokenLogo, useAsset } from '@bze/bze-ui-kit'
import { HolderRewardsPanel } from '@/components/rewards/holder-rewards-panel'
import { Notice } from '@/components/manage/denom-reward-form-parts'
import { useNavigationWithParams } from '@/hooks/useNavigation'

/**
 * The holder rewards (denom reward) of any token, for any wallet: the panel with create, daily
 * prizes and airdrops. Holder rewards are permissionless, so unlike the token workspace this page
 * is not limited to the connected wallet's own tokens.
 */
function DenomRewardTokenContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const { asset, isLoading } = useAsset(denom)
    const toDirectory = () => navigate('/rewards')

    if (!denom) {
        return <Notice title="No token selected" onBack={toDirectory}>Pick a holder reward from the list.</Notice>
    }

    if (isLoading) {
        return (
            <VStack align="stretch" gap={4}>
                <Skeleton height="10" width="64" />
                <Skeleton height="48" />
            </VStack>
        )
    }

    if (!asset) {
        return (
            <Notice title="Token not found" onBack={toDirectory}>
                {`This token isn't in the asset list, so its holder rewards can't be shown here.`}
            </Notice>
        )
    }

    return (
        <VStack align="stretch" gap={6}>
            <Box>
                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={toDirectory}>
                    <LuArrowLeft /> Rewards
                </Button>
            </Box>

            <HStack gap="3">
                <TokenLogo src={asset.logo} symbol={asset.ticker} size="12" circular={true} />
                <VStack align="start" gap="0.5" minW={0}>
                    <HStack gap="2">
                        <Text fontSize="xl" fontWeight="bold">{asset.name}</Text>
                        <Text color="fg.muted">{asset.ticker}</Text>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted" fontFamily="mono" wordBreak="break-all">{asset.denom}</Text>
                </VStack>
            </HStack>

            <HolderRewardsPanel asset={asset} />
        </VStack>
    )
}

export default function DenomRewardTokenPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="4xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="64" />}>
                    <DenomRewardTokenContent />
                </Suspense>
            </Container>
        </Box>
    )
}
