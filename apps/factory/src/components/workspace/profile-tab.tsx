"use client"

import React from 'react'
import { Button, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import { LuCircleCheck, LuImage } from 'react-icons/lu'
import { HgCard, IconTile } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
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
            <HStack gap="8px" color="hg.success.text" data-testid="registry-listed">
                <LuCircleCheck size={16} />
                <Text fontSize="14px" fontWeight="600">Listed in the registry ✓</Text>
            </HStack>
        )
    }
    return (
        <Button {...softButton} alignSelf="start" h="38px" px="14px" onClick={() => goTo(officialHref(denom))}>
            {`Get ${ticker}'s logo into every wallet`}
        </Button>
    )
}

/** Where the logo comes from, and the way to the registry guide. */
function LogoSection({ logoAction }: { logoAction: React.ReactNode }) {
    return (
        <HgCard as="section" aria-label="Logo" p="22px" minW={0}>
            <VStack align="stretch" gap="14px">
                <HStack gap="10px">
                    <IconTile icon={<LuImage />} size={36} />
                    <Text as="h2" fontSize="17px" fontWeight="700">Logo</Text>
                </HStack>
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted">
                    Logos come from the Cosmos Chain Registry, not from the Factory. Wallets and explorers read them from there.
                </Text>
                {logoAction}
            </VStack>
        </HgCard>
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
        <VStack align="stretch" gap="24px">
            {adminState === 'unknown' && <AdminUnknownNotice onRetry={() => void refreshAdmins()} />}
            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px" alignItems="start">
                <MetadataCard asset={asset} metadata={metadata} isLoading={isLoading} access={adminState} onSaved={refresh} />
                <LogoSection logoAction={<RegistryLogoAction denom={asset.denom} ticker={asset.ticker} goTo={goTo} />} />
            </Grid>
            <BrandKitCard asset={asset} access={adminState === 'unknown' ? 'not-admin' : adminState} />
        </VStack>
    )
}
