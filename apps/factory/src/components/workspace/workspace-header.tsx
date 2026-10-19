"use client"

import React from 'react'
import { Box, Button, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuCopy } from 'react-icons/lu'
import { AppLink, Asset, HeroGlow, PageContainer, TokenLogo, getCommunitiesApp, getDexApp, truncateAddress, useToast } from '@bze/bze-ui-kit'
import { TrustBadge } from '@/components/ui/trust-badge'
import type { AdminState } from '@/lib/workspace'

function statusLine(state: AdminState, admin?: string): string {
    switch (state) {
        case 'admin':
            return 'You control this token'
        case 'renounced':
            return 'Locked forever'
        case 'unknown':
            return "Couldn't check who controls it"
        default:
            return `Control was handed to ${truncateAddress(admin ?? '')}`
    }
}

/** Shown above every tab: back link, identity, trust badge, plain admin status, denom, outside links, then the tab row. */
export function WorkspaceHeader({ asset, admin, adminState, onBack, tabs }: {
    asset: Asset;
    admin: string | undefined;
    adminState: AdminState;
    onBack: () => void;
    /** The workspace's tab row, drawn along the bottom edge of the band. */
    tabs?: React.ReactNode;
}) {
    const { toast } = useToast()
    const encoded = encodeURIComponent(asset.denom)

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
            <HeroGlow strength="inner" />
            <PageContainer position="relative" pt="24px">
                <VStack align="stretch" gap="18px">
                    <Box>
                        <Button variant="ghost" size="sm" h="32px" ps="6px" pe="10px" color="hg.link" fontWeight="600" fontSize="14px" onClick={onBack}>
                            <LuArrowLeft />
                            My tokens
                        </Button>
                    </Box>

                    <HStack gap="16px" align="start">
                        <Box flexShrink={0} borderRadius="full" boxShadow="0 0 0 2px {colors.app.border}">
                            <TokenLogo src={asset.logo} symbol={asset.ticker} size="14" circular={true} />
                        </Box>
                        <VStack align="start" gap="6px" minW={0} flex="1">
                            <HStack gap="10px" flexWrap="wrap">
                                <Text as="h1" fontSize={{ base: '24px', md: '30px' }} fontWeight="800" letterSpacing="-0.02em" lineHeight="1.15">
                                    {asset.name}
                                </Text>
                                <Text fontSize="16px" color="fg.muted">{asset.ticker}</Text>
                                <TrustBadge admin={admin} />
                            </HStack>
                            <Text fontSize="14px" color="fg.muted" data-testid="workspace-status">
                                {statusLine(adminState, admin)}
                            </Text>
                            <HStack gap="6px" minW={0} maxW="full">
                                <Text fontSize="12px" color="hg.text.faint" fontFamily="mono" wordBreak="break-all">
                                    {asset.denom}
                                </Text>
                                <IconButton aria-label="Copy denom" size="2xs" variant="ghost" color="hg.link" onClick={copyDenom}>
                                    <LuCopy />
                                </IconButton>
                            </HStack>
                            <HStack gap="8px" flexWrap="wrap" mt="4px">
                                <AppLink app="communities" href={`${getCommunitiesApp().href}/token?denom=${encoded}`}>Communities</AppLink>
                                <AppLink app="dex" href={`${getDexApp().href}/assets/details?denom=${encoded}`}>DEX</AppLink>
                            </HStack>
                        </VStack>
                    </HStack>

                    {tabs}
                </VStack>
            </PageContainer>
        </Box>
    )
}
