"use client"

import React, { useState } from 'react'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import { LuLock, LuRefreshCw } from 'react-icons/lu'
import { AppLink, Asset, Shimmer, getChainName, getCommunitiesApp, hgVariant } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useDenomBranding } from '@/hooks/useDenomBranding'
import { BrandKitPreview } from '@/components/brand-kit/brand-kit-preview'
import { InfoBox } from '@/components/ui/info-box'
import { softButton } from '@/components/ui/soft-button'

const { setDenomBranding } = bze.tokenfactory.MessageComposer.withTypeUrl

/** Who is looking at the card: the admin may remove the kit, everyone else only sees it. */
export type BrandKitAccess = 'admin' | 'not-admin' | 'renounced'

function RemovePanel({ asset, onCancel, onRemoved }: { asset: Asset; onCancel: () => void; onRemoved: () => void }) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const submit = async () => {
        if (!address) return

        // No branding clears the stored kit.
        const msg = setDenomBranding({ creator: address, denom: asset.denom, branding: undefined })

        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: onRemoved })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <VStack align="stretch" gap={3} data-testid="brand-kit-remove-panel">
            <InfoBox title="Remove the brand kit?">
                {`${asset.ticker} goes back to the default look.`}
            </InfoBox>
            <HStack gap="10px">
                <Button variant="ghost" size="lg" color="hg.link" fontWeight="600" onClick={onCancel} flex="1">
                    Keep it
                </Button>
                <Button
                    variant={hgVariant('danger')}
                    size="lg"
                    onClick={submit}
                    loading={isSubmitting}
                    loadingText="Confirm in your wallet"
                    flex="1"
                >
                    Remove brand kit
                </Button>
            </HStack>
        </VStack>
    )
}

/**
 * The token's on-chain brand kit (chain v8.2.0) on the token page, drawn small: the light and dark
 * sample cards and the font. Editing happens on its own page (/brand-kit, BFE-293); here the admin
 * can only remove the kit. Everyone else sees it read-only, frozen for good once the admin was
 * renounced.
 */
export function BrandKitCard({ asset, access }: { asset: Asset; access: BrandKitAccess }) {
    const communitiesHref = `${getCommunitiesApp().href}/token?denom=${encodeURIComponent(asset.denom)}`
    const { branding, isLoading, hasError, refresh } = useDenomBranding(asset.denom)
    const [isRemoving, setIsRemoving] = useState(false)

    const isAdmin = access === 'admin'

    if (isLoading) {
        return (
            <VStack align="stretch" gap="8px" aria-busy="true">
                <Shimmer h="14px" w="128px" />
                <Shimmer h="88px" borderRadius="12px" />
            </VStack>
        )
    }

    if (hasError) {
        return (
            <VStack align="stretch" gap={3}>
                <InfoBox title="Couldn't load the brand kit">
                    The chain query failed — the node may be down or not on v8.2.0 yet, so
                    whether this token has a brand kit is unknown.
                </InfoBox>
                <Box>
                    <Button {...softButton} size="sm" onClick={() => void refresh()}>
                        <LuRefreshCw />
                        Retry
                    </Button>
                </Box>
            </VStack>
        )
    }

    return (
        <VStack align="stretch" gap={3} data-testid="brand-kit-card">
            {branding ? (
                <BrandKitPreview asset={asset} branding={branding} compact />
            ) : (
                <Text fontSize="14px" color="fg.muted">
                    No brand kit yet.
                </Text>
            )}
            {access === 'renounced' && (
                <HStack gap="8px" color="fg.muted" fontSize="14px" data-testid="brand-kit-frozen">
                    <LuLock />
                    <Text>
                        Frozen
                    </Text>
                </HStack>
            )}
            {isRemoving ? (
                <RemovePanel
                    asset={asset}
                    onCancel={() => setIsRemoving(false)}
                    onRemoved={() => {
                        setIsRemoving(false)
                        void refresh()
                    }}
                />
            ) : (
                <HStack justify="space-between" gap="10px" flexWrap="wrap">
                    <AppLink app="communities" href={communitiesHref}>Communities</AppLink>
                    {isAdmin && branding && (
                        <Button size="sm" h="34px" variant="ghost" color="hg.danger.text" fontWeight="600" onClick={() => setIsRemoving(true)}>
                            Remove brand kit
                        </Button>
                    )}
                </HStack>
            )}
        </VStack>
    )
}
