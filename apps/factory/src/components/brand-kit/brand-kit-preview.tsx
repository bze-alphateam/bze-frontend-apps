"use client"

import React from 'react'
import { preinit } from 'react-dom'
import { Box, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import {
    Asset,
    BRANDING_PALETTES,
    BrandingPalette,
    DenomBranding,
    TokenLogo,
    brandingFont,
    brandingFontsStylesheetUrl,
    contrastText,
} from '@bze/bze-ui-kit'

export const PALETTE_LABELS: Record<BrandingPalette, string> = { light: 'Light', dark: 'Dark' }

/** Loads the curated fonts so previews and template tiles render the real font. */
export function useBrandingFonts() {
    // preinit dedupes and, unlike a `<link precedence>`, never suspends the page (inside a
    // Suspense boundary) while the stylesheet downloads.
    preinit(brandingFontsStylesheetUrl(), { as: 'style', precedence: 'default' })
}

/**
 * A sample token card painted with one palette of the kit, in the kit's font. The button label is
 * black or white like on Communities; `compact` is the token page's small version.
 */
function PalettePreview({ asset, branding, palette, compact }: { asset: Asset; branding: DenomBranding; palette: BrandingPalette; compact: boolean }) {
    const colors = branding[palette]
    const family = brandingFont(branding.font)?.family

    return (
        <VStack align="stretch" gap="6px" minW={0} data-testid={`brand-kit-preview-${palette}`}>
            <Text fontSize="12px" color="hg.text.faint">
                {PALETTE_LABELS[palette]}
            </Text>
            <Box
                bg={colors.background}
                color={colors.text}
                fontFamily={family}
                borderRadius={compact ? '12px' : '14px'}
                borderWidth="1px"
                borderColor="hg.lineStrong"
                p={compact ? '12px' : '16px'}
            >
                <VStack align="stretch" gap={compact ? 2 : 3}>
                    <HStack gap={2} minW={0}>
                        <TokenLogo src={asset.logo} symbol={asset.ticker} size={compact ? '6' : '8'} circular={true} />
                        <VStack align="start" gap={0} minW={0}>
                            <Text fontWeight="bold" lineHeight="short" truncate maxW="full">
                                {asset.name}
                            </Text>
                            <Text fontSize="xs" color={colors.secondary}>
                                {asset.ticker}
                            </Text>
                        </VStack>
                    </HStack>
                    {!compact && <Text fontSize="sm">The community token, in its own colours.</Text>}
                    <HStack gap={2} flexWrap="wrap">
                        <Box as="span" bg={colors.primary} color={contrastText(colors.primary)} px={3} py={1} borderRadius="md" fontSize={compact ? 'xs' : 'sm'} fontWeight="semibold">
                            Buy {asset.ticker}
                        </Box>
                        {!compact && (
                            <Box as="span" borderWidth="1px" borderColor={colors.secondary} color={colors.secondary} px={3} py={1} borderRadius="md" fontSize="sm">
                                Learn more
                            </Box>
                        )}
                    </HStack>
                </VStack>
            </Box>
        </VStack>
    )
}

/**
 * The Light and Dark sample cards. `stacked` keeps them in one column (the editor's live
 * preview); `compact` draws them small and always side by side (the token page).
 */
export function BrandKitPreview({ asset, branding, stacked = false, compact = false }: { asset: Asset; branding: DenomBranding; stacked?: boolean; compact?: boolean }) {
    useBrandingFonts()

    const columns = stacked
        ? 'minmax(0, 1fr)'
        : compact ? 'repeat(2, minmax(0, 1fr))' : { base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }

    return (
        <VStack align="stretch" gap={2}>
            <Text fontSize={compact ? '13px' : '14px'} color="fg.muted">
                Font: <Text as="span" fontWeight="700" color="fg">{brandingFont(branding.font)?.label ?? `${branding.font} (not supported — shown in the default font)`}</Text>
            </Text>
            <Grid templateColumns={columns} gap={compact ? '10px' : '16px'}>
                {BRANDING_PALETTES.map(palette => (
                    <PalettePreview key={palette} asset={asset} branding={branding} palette={palette} compact={compact} />
                ))}
            </Grid>
        </VStack>
    )
}
