"use client"

import React from 'react'
import { Box, Button, Card, HStack, Text, VStack } from '@chakra-ui/react'
import { LuCircleCheck, LuImage } from 'react-icons/lu'
import { MetadataCard } from '@/components/manage/metadata-card'
import { BrandKitCard } from '@/components/manage/brand-kit-card'
import { useRegistryListing } from '@/hooks/useRegistryListing'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { officialHref } from '@/lib/registry-entry'
import { AdminUnknownNotice } from './admin-notices'
import type { WorkspaceTabProps } from './types'

/** The registry guide's way in, or the proof the token is listed (BFE-164). */
function RegistryLogoAction({ denom, ticker, goTo }: { denom: string; ticker: string; goTo: (href: string) => void }) {
    const { status } = useRegistryListing(denom)

    if (status === 'listed') {
        return (
            <HStack gap={2} color="green.600" data-testid="registry-listed">
                <LuCircleCheck size={16} />
                <Text fontSize="sm" fontWeight="semibold">Listed in the registry ✓</Text>
            </HStack>
        )
    }
    return (
        <Button alignSelf="start" size="sm" colorPalette="yellow" variant="outline" onClick={() => goTo(officialHref(denom))}>
            {`Get ${ticker}'s logo into every wallet`}
        </Button>
    )
}

/** Where the logo comes from, and the way to the registry guide. */
function LogoSection({ logoAction }: { logoAction: React.ReactNode }) {
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
    goTo,
}: WorkspaceTabProps) {
    const { metadata, isLoading, refresh } = useTokenMetadata(asset.denom)

    return (
        <VStack align="stretch" gap={6}>
            {adminState === 'unknown' && <AdminUnknownNotice onRetry={() => void refreshAdmins()} />}
            <MetadataCard asset={asset} metadata={metadata} isLoading={isLoading} access={adminState} onSaved={refresh} />
            <BrandKitCard asset={asset} access={adminState === 'unknown' ? 'not-admin' : adminState} />
            <LogoSection logoAction={<RegistryLogoAction denom={asset.denom} ticker={asset.ticker} goTo={goTo} />} />
        </VStack>
    )
}
