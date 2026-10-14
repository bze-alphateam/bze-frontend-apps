"use client"

import React from 'react'
import { Box, Card, HStack, Text, VStack } from '@chakra-ui/react'
import { LuImage } from 'react-icons/lu'
import { MetadataCard } from '@/components/manage/metadata-card'
import { BrandKitCard } from '@/components/manage/brand-kit-card'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { AdminUnknownNotice } from './admin-notices'
import type { WorkspaceTabProps } from './types'

/** Where the logo comes from; `logoAction` is the slot for the registry ticket's button. */
function LogoSection({ logoAction }: { logoAction?: React.ReactNode }) {
    return (
        <Card.Root as="section" aria-label="Logo" variant="outline" p="5">
            <VStack align="stretch" gap={3}>
                <HStack gap={2}>
                    <Box p={2} borderRadius="lg" bg="blue.500/15" color="blue.500">
                        <LuImage size={18} />
                    </Box>
                    <Text fontWeight="semibold">Logo</Text>
                </HStack>
                <Text fontSize="sm" color="fg.muted">
                    Logos come from the Cosmos Chain Registry, not from the Factory. Wallets and explorers read them from there.
                </Text>
                {logoAction}
            </VStack>
        </Card.Root>
    )
}

/**
 * What wallets show (name and description), how the token looks on Communities (brand kit) and
 * where its logo comes from. Only the admin edits; an unknown admin keeps everything read-only.
 */
export function ProfileTab({
    asset,
    adminState,
    refreshAdmins,
    logoAction,
}: WorkspaceTabProps & { logoAction?: React.ReactNode }) {
    const { metadata, isLoading, refresh } = useTokenMetadata(asset.denom)

    return (
        <VStack align="stretch" gap={6}>
            {adminState === 'unknown' && <AdminUnknownNotice onRetry={() => void refreshAdmins()} />}
            <MetadataCard asset={asset} metadata={metadata} isLoading={isLoading} access={adminState} onSaved={refresh} />
            <BrandKitCard asset={asset} access={adminState === 'unknown' ? 'not-admin' : adminState} />
            <LogoSection logoAction={logoAction} />
        </VStack>
    )
}
