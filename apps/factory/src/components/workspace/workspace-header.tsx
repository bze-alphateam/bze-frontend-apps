"use client"

import React from 'react'
import { Badge, Box, Button, HStack, IconButton, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuCircleHelp, LuCopy, LuLock, LuTriangleAlert } from 'react-icons/lu'
import { AppLink, Asset, TokenLogo, getCommunitiesApp, getDexApp, truncateAddress, useToast } from '@bze/bze-ui-kit'
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

/** Shown above every tab: back link, identity, trust badge, plain admin status, denom, outside links. */
export function WorkspaceHeader({ asset, admin, adminState, onBack }: {
    asset: Asset;
    admin: string | undefined;
    adminState: AdminState;
    onBack: () => void;
}) {
    const { toast } = useToast()
    const encoded = encodeURIComponent(asset.denom)

    const copyDenom = async () => {
        await navigator.clipboard.writeText(asset.denom)
        toast.success('Copied', 'Denom copied to clipboard.')
    }

    return (
        <VStack align="stretch" gap={4}>
            <Box>
                <Button variant="ghost" colorPalette="yellow" size="sm" onClick={onBack}>
                    <LuArrowLeft />
                    My tokens
                </Button>
            </Box>

            <HStack gap="3" align="start">
                <TokenLogo src={asset.logo} symbol={asset.ticker} size="12" circular={true} />
                <VStack align="start" gap="1" minW={0} flex="1">
                    <HStack gap="2" flexWrap="wrap">
                        <Text fontSize="xl" fontWeight="bold">
                            {asset.name}
                        </Text>
                        <Text color="fg.muted">{asset.ticker}</Text>
                        {adminState === 'unknown' ? (
                            <Badge colorPalette="gray" variant="surface" size="sm">
                                <LuCircleHelp size={12} /> Control unknown
                            </Badge>
                        ) : adminState === 'renounced' ? (
                            <Badge colorPalette="green" variant="surface" size="sm">
                                <LuLock size={12} /> Fixed supply
                            </Badge>
                        ) : (
                            <Badge colorPalette="orange" variant="surface" size="sm">
                                <LuTriangleAlert size={12} /> Mintable
                            </Badge>
                        )}
                    </HStack>
                    <Text fontSize="sm" color="fg.muted" data-testid="workspace-status">
                        {statusLine(adminState, admin)}
                    </Text>
                    <HStack gap="1" minW={0} maxW="full">
                        <Text fontSize="xs" color="fg.muted" fontFamily="mono" wordBreak="break-all">
                            {asset.denom}
                        </Text>
                        <IconButton aria-label="Copy denom" size="2xs" variant="ghost" colorPalette="yellow" onClick={copyDenom}>
                            <LuCopy />
                        </IconButton>
                    </HStack>
                    <HStack gap={4} flexWrap="wrap" fontSize="sm">
                        <AppLink app="communities" href={`${getCommunitiesApp().href}/token?denom=${encoded}`}>Communities</AppLink>
                        <AppLink app="dex" href={`${getDexApp().href}/assets/details?denom=${encoded}`}>DEX</AppLink>
                    </HStack>
                </VStack>
            </HStack>
        </VStack>
    )
}
