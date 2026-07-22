"use client"

import React from 'react'
import { Box, Button, Code, Container, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import {
    LuArrowUpRight,
    LuChartCandlestick,
    LuCircleCheck,
    LuCopy,
    LuDroplets,
    LuPlus,
} from 'react-icons/lu'
import { getChainExplorerURL, getChainName, getDexApp, useToast } from '@bze/bze-ui-kit'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useNavigation } from '@/hooks/useNavigation'

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

export function SuccessScreen() {
    const { created, form, reset } = useTokenWizard()
    const { navigate } = useNavigation()
    const { toast } = useToast()

    if (!created) return null

    const dexUrl = getDexApp().href
    const tokenUrl = `${dexUrl}/assets/details?denom=${encodeURIComponent(created.denom)}`
    const txUrl = `${getChainExplorerURL(getChainName())}/tx/${created.txHash}`

    const copyDenom = async () => {
        await navigator.clipboard.writeText(created.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <Container maxW="2xl" py={{ base: 8, md: 14 }}>
            <VStack align="stretch" gap={6}>
                <VStack gap={3} align="center">
                    <Box color="green.500">
                        <LuCircleCheck size={56} />
                    </Box>
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        {form.name.trim()} ({form.symbol}) is live!
                    </Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                        Your token was created, {form.fixedSupply
                            ? 'the supply was minted, and the admin was renounced — the supply is fixed forever.'
                            : 'and the initial supply was minted to your address.'}
                    </Text>
                </VStack>

                <Box
                    p={4}
                    bgGradient="to-br"
                    gradientFrom="yellow.500/8"
                    gradientTo="yellow.600/8"
                    borderWidth="1px"
                    borderColor="yellow.500/20"
                    borderRadius="xl"
                >
                    <VStack align="stretch" gap={2}>
                        <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                            Your denom
                        </Text>
                        <HStack gap={2}>
                            <Code fontSize="xs" p={2} borderRadius="md" wordBreak="break-all" flex="1">
                                {created.denom}
                            </Code>
                            <IconButton aria-label="Copy denom" size="sm" variant="ghost" colorPalette="yellow" onClick={copyDenom}>
                                <LuCopy />
                            </IconButton>
                        </HStack>
                    </VStack>
                </Box>

                <HStack gap={3} justify="center" wrap="wrap">
                    <Button colorPalette="yellow" onClick={() => openExternal(tokenUrl)}>
                        View token on DEX <LuArrowUpRight />
                    </Button>
                    <Button variant="outline" colorPalette="yellow" onClick={() => openExternal(txUrl)}>
                        View transaction <LuArrowUpRight />
                    </Button>
                </HStack>

                <VStack align="stretch" gap={3}>
                    <Text fontSize="sm" color="fg.muted" fontWeight="medium" textAlign="center">
                        What&apos;s next?
                    </Text>
                    <HStack gap={3} justify="center" wrap="wrap">
                        <Button
                            variant="outline"
                            colorPalette="yellow"
                            size="sm"
                            onClick={() => navigate(`/market/new?base=${encodeURIComponent(created.denom)}`)}
                        >
                            <LuChartCandlestick />
                            Create a market
                        </Button>
                        <Button
                            variant="outline"
                            colorPalette="yellow"
                            size="sm"
                            onClick={() => navigate(`/pool/new?base=${encodeURIComponent(created.denom)}`)}
                        >
                            <LuDroplets />
                            Create a liquidity pool
                        </Button>
                        <Button variant="outline" colorPalette="yellow" size="sm" onClick={reset}>
                            <LuPlus />
                            Create another token
                        </Button>
                    </HStack>
                </VStack>

                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => { reset(); navigate('/') }}>
                    Back to hub
                </Button>
            </VStack>
        </Container>
    )
}
