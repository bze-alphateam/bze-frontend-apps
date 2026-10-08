"use client"

import React, { Suspense } from 'react'
import { Box, Button, Container, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft } from 'react-icons/lu'
import { TokenLogo, useAsset } from '@bze/bze-ui-kit'
import { DenomRewardCard } from '@/components/manage/denom-reward-card'
import { Notice } from '@/components/manage/denom-reward-form-parts'
import { useNavigationWithParams } from '@/hooks/useNavigation'

/**
 * The denom reward of any token, for any wallet: the overview plus create / add schedule /
 * airdrop. Denom rewards are permissionless, so unlike the manage token page this one is not
 * limited to the connected wallet's own tokens.
 */
function DenomRewardTokenContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const denom = denomParam ?? ''
    const { asset, isLoading } = useAsset(denom)
    const toDirectory = () => navigate('/denom-reward')

    if (!denom) {
        return <Notice title="No token selected" onBack={toDirectory}>Pick a denom reward from the list.</Notice>
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
                This token isn&apos;t in the asset list, so its denom reward can&apos;t be shown here.
            </Notice>
        )
    }

    return (
        <VStack align="stretch" gap={6}>
            <Box>
                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={toDirectory}>
                    <LuArrowLeft /> Denom rewards
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

            <DenomRewardCard asset={asset} />
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
