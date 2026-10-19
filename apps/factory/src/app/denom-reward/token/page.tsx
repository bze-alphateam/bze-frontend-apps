"use client"

import React from 'react'
import { Box, chakra, Flex, HStack, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft } from 'react-icons/lu'
import { HeroGlow, PageContainer, Shimmer, TokenLogo, useAsset } from '@bze/bze-ui-kit'
import { HolderRewardsPanel } from '@/components/rewards/holder-rewards-panel'
import { Notice } from '@/components/manage/denom-reward-form-parts'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { FormFrame, FormPage } from '@/components/guided'

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
            <FormFrame>
                <VStack align="stretch" gap="16px">
                    <Shimmer h="40px" w="256px" />
                    <Shimmer h="192px" borderRadius="hg.lg" />
                </VStack>
            </FormFrame>
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
        <>
            <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
                <HeroGlow strength="inner" />
                <PageContainer position="relative" pt={{ base: '12px', md: '24px' }} pb={{ base: '22px', md: '32px' }}>
                    <Flex direction="column" gap="12px">
                        <chakra.button
                            type="button"
                            alignSelf="flex-start"
                            display="inline-flex"
                            alignItems="center"
                            gap="6px"
                            h={{ base: '44px', md: '36px' }}
                            fontSize="14px"
                            fontWeight="600"
                            color="hg.link"
                            bg="transparent"
                            border="0"
                            p="0"
                            cursor="pointer"
                            _hover={{ color: 'hg.link.hover' }}
                            focusVisibleRing="outside"
                            onClick={toDirectory}
                        >
                            <LuArrowLeft size={14} aria-hidden /> Rewards
                        </chakra.button>
                        <HStack gap="14px" minW={0}>
                            <TokenLogo src={asset.logo} symbol={asset.ticker} size="9" circular={true} />
                            <VStack align="start" gap="2px" minW={0}>
                                <HStack gap="8px" align="baseline" wrap="wrap">
                                    <Text as="h1" fontSize="22px" fontWeight="700">{asset.name}</Text>
                                    <Text color="fg.muted">{asset.ticker}</Text>
                                </HStack>
                                <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" wordBreak="break-all">{asset.denom}</Text>
                            </VStack>
                        </HStack>
                    </Flex>
                </PageContainer>
            </Box>

            <FormFrame>
                <HolderRewardsPanel asset={asset} />
            </FormFrame>
        </>
    )
}

export default function DenomRewardTokenPage() {
    return (
        <FormPage>
            <DenomRewardTokenContent />
        </FormPage>
    )
}
