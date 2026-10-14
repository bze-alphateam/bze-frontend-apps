"use client"

import React from 'react'
import { VStack } from '@chakra-ui/react'
import { MetadataCard } from '@/components/manage/metadata-card'
import { BrandKitCard } from '@/components/manage/brand-kit-card'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { AdminUnknownNotice } from './admin-notices'
import type { WorkspaceTabProps } from './types'

/** Today's metadata and brand kit cards, per admin state. */
export function ProfileTab({ asset, adminState, refreshAdmins }: WorkspaceTabProps) {
    const { metadata, isLoading, refresh } = useTokenMetadata(asset.denom)

    if (adminState === 'unknown') {
        return <AdminUnknownNotice onRetry={() => void refreshAdmins()} />
    }

    return (
        <VStack align="stretch" gap={6}>
            {adminState === 'admin' && (
                <MetadataCard asset={asset} metadata={metadata} isLoading={isLoading} onSaved={refresh} />
            )}
            <BrandKitCard asset={asset} access={adminState} />
        </VStack>
    )
}
