"use client"

import React, { useState } from 'react'
import { HStack, Text } from '@chakra-ui/react'
import { LuCircleCheck } from 'react-icons/lu'
import { withReturn } from '@/components/guided/return-to'
import { BrandKitCard, type BrandKitAccess } from '@/components/manage/brand-kit-card'
import { MetadataCard } from '@/components/manage/metadata-card'
import { useRegistryListing } from '@/hooks/useRegistryListing'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { officialHref } from '@/lib/registry-entry'
import type { AdminState } from '@/lib/workspace'
import { ActionGroup, ActionItem, ItemButton, ItemLink, type GroupProps } from './action-group'

/** Name and description in wallets: today's MetadataCard, editable by the admin, read-only for others. */
function MetadataItem({ asset, access }: Pick<GroupProps, 'asset' | 'access'>) {
    const [isOpen, setIsOpen] = useState(false)
    const { metadata, isLoading, refresh } = useTokenMetadata(asset.denom)
    // While the admin query runs or failed, the card stays read-only.
    const cardAccess: AdminState = access === 'checking' ? 'unknown' : access
    const isAdmin = access === 'admin'

    return (
        <ActionItem
            testId="metadata-item"
            title="Name, logo, description"
            line={access === 'renounced'
                ? 'Frozen: the admin was given up, so nobody can change it.'
                : isAdmin ? 'Edit what wallets and the DEX show.' : 'What wallets and the DEX show.'}
            action={
                <ItemButton onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
                    {isOpen ? 'Close' : isAdmin ? 'Edit details' : 'View details'}
                </ItemButton>
            }
        >
            {isOpen && <MetadataCard asset={asset} metadata={metadata} isLoading={isLoading} access={cardAccess} onSaved={refresh} />}
        </ActionItem>
    )
}

/** The registry guide's way in (primary while not listed), or the proof the token is listed. */
function RegistryItem({ asset, back }: Pick<GroupProps, 'asset' | 'back'>) {
    const { status } = useRegistryListing(asset.denom)

    if (status === 'listed') {
        return (
            <ActionItem
                testId="registry-item"
                title="Logo in every wallet"
                line={(
                    <HStack gap="6px" color="hg.success.text" data-testid="registry-listed">
                        <LuCircleCheck size={14} />
                        <Text as="span" fontWeight="600">Listed in the registry ✓</Text>
                    </HStack>
                )}
            />
        )
    }
    return (
        <ActionItem
            testId="registry-item"
            title="Get your logo in every wallet"
            line="Submit it to the Cosmos Chain Registry. We prepare the files."
            action={<ItemLink href={withReturn(officialHref(asset.denom), back)} primary>Submit to registry</ItemLink>}
        />
    )
}

/** Colours and a font for the Communities page: today's BrandKitCard, editable by the admin only. */
function BrandKitItem({ asset, access }: Pick<GroupProps, 'asset' | 'access'>) {
    const [isOpen, setIsOpen] = useState(false)
    const cardAccess: BrandKitAccess = access === 'admin' || access === 'renounced' ? access : 'not-admin'

    return (
        <ActionItem
            testId="brand-kit-item"
            title="Brand kit"
            line={`Colours and font for ${asset.ticker}'s Communities page.`}
            action={
                <ItemButton onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
                    {isOpen ? 'Close' : 'Open'}
                </ItemButton>
            }
        >
            {isOpen && <BrandKitCard asset={asset} access={cardAccess} />}
        </ActionItem>
    )
}

/** Details and look: what wallets show, the registry logo, the brand kit. */
export function DetailsGroup({ asset, access, back }: GroupProps) {
    return (
        <ActionGroup id="details" title="Details and look" description={`How ${asset.ticker} appears everywhere.`}>
            <MetadataItem asset={asset} access={access} />
            <RegistryItem asset={asset} back={back} />
            <BrandKitItem asset={asset} access={access} />
        </ActionGroup>
    )
}
