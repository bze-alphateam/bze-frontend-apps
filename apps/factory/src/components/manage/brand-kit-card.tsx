"use client"

import React, { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Field,
    Grid,
    HStack,
    Input,
    NativeSelect,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import { LuLock, LuPalette, LuRefreshCw } from 'react-icons/lu'
import {
    Asset,
    BRANDING_COLOR_KEYS,
    BRANDING_FONTS,
    BRANDING_PALETTES,
    BrandingColorKey,
    BrandingField,
    BrandingPalette,
    DEFAULT_DENOM_BRANDING,
    DenomBranding,
    TokenLogo,
    brandingFont,
    brandingFontsStylesheetUrl,
    getChainName,
    validateDenomBranding,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useDenomBranding } from '@/hooks/useDenomBranding'
import { InfoBox } from '@/components/ui/info-box'
import { colorPickerValue, sameBranding, withBrandingColor } from '@/lib/brand-kit'

const { setDenomBranding } = bze.tokenfactory.MessageComposer.withTypeUrl

/** Who is looking at the card: the admin edits, everyone else only sees the kit. */
export type BrandKitAccess = 'admin' | 'not-admin' | 'renounced'

const PALETTE_LABELS: Record<BrandingPalette, string> = { light: 'Light', dark: 'Dark' }
const COLOR_LABELS: Record<BrandingColorKey, string> = {
    background: 'Background',
    text: 'Text',
    primary: 'Primary',
    secondary: 'Secondary',
}

/** A sample token card painted with one palette of the kit, in the kit's font. */
function PalettePreview({ asset, branding, palette }: { asset: Asset; branding: DenomBranding; palette: BrandingPalette }) {
    const colors = branding[palette]
    const family = brandingFont(branding.font)?.family

    return (
        <VStack align="stretch" gap={1.5} data-testid={`brand-kit-preview-${palette}`}>
            <Text fontSize="xs" color="fg.muted">
                {PALETTE_LABELS[palette]}
            </Text>
            <Box
                bg={colors.background}
                color={colors.text}
                fontFamily={family}
                borderRadius="lg"
                borderWidth="1px"
                borderColor="border.muted"
                p={4}
            >
                <VStack align="stretch" gap={3}>
                    <HStack gap={2}>
                        <TokenLogo src={asset.logo} symbol={asset.ticker} size="8" circular={true} />
                        <VStack align="start" gap={0}>
                            <Text fontWeight="bold" lineHeight="short">
                                {asset.name}
                            </Text>
                            <Text fontSize="xs" color={colors.secondary}>
                                {asset.ticker}
                            </Text>
                        </VStack>
                    </HStack>
                    <Text fontSize="sm">The community token, in its own colours.</Text>
                    <HStack gap={2}>
                        <Box as="span" bg={colors.primary} color={colors.background} px={3} py={1} borderRadius="md" fontSize="sm" fontWeight="semibold">
                            Buy {asset.ticker}
                        </Box>
                        <Box as="span" borderWidth="1px" borderColor={colors.secondary} color={colors.secondary} px={3} py={1} borderRadius="md" fontSize="sm">
                            Learn more
                        </Box>
                    </HStack>
                </VStack>
            </Box>
        </VStack>
    )
}

function BrandKitPreview({ asset, branding }: { asset: Asset; branding: DenomBranding }) {
    return (
        <VStack align="stretch" gap={2}>
            {/* React hoists and dedupes the stylesheet, so the preview renders the real font. */}
            <link rel="stylesheet" href={brandingFontsStylesheetUrl()} precedence="default" />
            <Text fontSize="sm" color="fg.muted">
                Font: <Text as="span" fontWeight="medium" color="fg">{brandingFont(branding.font)?.label ?? `${branding.font} (not supported — shown in the default font)`}</Text>
            </Text>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
                {BRANDING_PALETTES.map(palette => (
                    <PalettePreview key={palette} asset={asset} branding={branding} palette={palette} />
                ))}
            </Grid>
        </VStack>
    )
}

function ColorInput({
    label,
    value,
    error,
    onChange,
}: {
    label: string;
    value: string;
    error: string | undefined;
    onChange: (value: string) => void;
}) {
    return (
        <Field.Root invalid={Boolean(error)}>
            <Field.Label fontSize="sm">{label}</Field.Label>
            <HStack gap={2} w="full">
                <input
                    type="color"
                    aria-label={`${label} picker`}
                    value={colorPickerValue(value)}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ width: '2.5rem', height: '2.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                />
                <Input
                    aria-label={label}
                    size="sm"
                    fontFamily="mono"
                    maxLength={7}
                    placeholder="#000000"
                    value={value}
                    onChange={(e) => onChange(e.target.value.trim())}
                />
            </HStack>
            <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
    )
}

function BrandKitForm({
    asset,
    initial,
    onCancel,
    onSaved,
}: {
    asset: Asset;
    initial: DenomBranding | null;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    const [kit, setKit] = useState<DenomBranding>(initial ?? DEFAULT_DENOM_BRANDING)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const errors = useMemo(() => validateDenomBranding(kit), [kit])
    const isValid = Object.keys(errors).length === 0
    const isUnchanged = sameBranding(kit, initial)

    const submit = async () => {
        if (!address || !isValid || isUnchanged) return

        // Always the full kit: the chain has no partial updates.
        const msg = setDenomBranding({ creator: address, denom: asset.denom, branding: kit })

        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: onSaved })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <VStack align="stretch" gap={4}>
            <Field.Root invalid={Boolean(errors.font)}>
                <Field.Label>Font</Field.Label>
                <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                        aria-label="Font"
                        value={kit.font}
                        onChange={(e) => setKit(prev => ({ ...prev, font: e.target.value }))}
                    >
                        {!brandingFont(kit.font) && <option value={kit.font}>{kit.font || 'Pick a font'}</option>}
                        {BRANDING_FONTS.map(font => (
                            <option key={font.slug} value={font.slug}>{font.label}</option>
                        ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.ErrorText>{errors.font}</Field.ErrorText>
            </Field.Root>

            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                {BRANDING_PALETTES.map(palette => (
                    <VStack key={palette} align="stretch" gap={3}>
                        <Text fontSize="sm" fontWeight="semibold">
                            {PALETTE_LABELS[palette]} palette
                        </Text>
                        {BRANDING_COLOR_KEYS.map(key => {
                            const field: BrandingField = `${palette}.${key}`
                            return (
                                <ColorInput
                                    key={field}
                                    label={`${PALETTE_LABELS[palette]} ${COLOR_LABELS[key].toLowerCase()}`}
                                    value={kit[palette][key]}
                                    error={errors[field]}
                                    onChange={(value) => setKit(prev => withBrandingColor(prev, palette, key, value))}
                                />
                            )
                        })}
                    </VStack>
                ))}
            </Grid>

            {isValid && <BrandKitPreview asset={asset} branding={kit} />}

            <InfoBox>
                Saving always stores the whole kit — the font and all eight colours. It is public
                and apps that support brand kits pick it up right away.
            </InfoBox>

            <HStack gap={2}>
                <Button variant="ghost" colorPalette="purple" onClick={onCancel} flex="1">
                    Cancel
                </Button>
                <Button
                    colorPalette="purple"
                    onClick={submit}
                    disabled={!isValid || isUnchanged}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                    flex="1"
                >
                    Save brand kit
                </Button>
            </HStack>
            {isValid && isUnchanged && (
                <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Nothing changed yet.
                </Text>
            )}
        </VStack>
    )
}

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
                Apps that support brand kits go back to their default look for {asset.ticker}. You
                can set a new kit at any time while you are the admin.
            </InfoBox>
            <HStack gap={2}>
                <Button variant="ghost" colorPalette="purple" onClick={onCancel} flex="1">
                    Keep it
                </Button>
                <Button
                    colorPalette="red"
                    onClick={submit}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                    flex="1"
                >
                    Remove brand kit
                </Button>
            </HStack>
        </VStack>
    )
}

/**
 * The token's on-chain brand kit (chain v8.2.0): one font and a light and a dark palette that
 * apps supporting it use for the token's pages. The admin sets or removes it with
 * MsgSetDenomBranding; everyone else sees a read-only preview, frozen for good once the admin
 * was renounced.
 */
export function BrandKitCard({ asset, access }: { asset: Asset; access: BrandKitAccess }) {
    const { branding, isLoading, hasError, refresh } = useDenomBranding(asset.denom)
    const [mode, setMode] = useState<'view' | 'edit' | 'remove'>('view')

    const isAdmin = access === 'admin'
    const backToView = () => {
        setMode('view')
        void refresh()
    }

    return (
        <Card.Root
            variant="outline"
            p="5"
            bgGradient="to-br"
            gradientFrom="purple.500/8"
            gradientTo="purple.600/8"
            borderColor="purple.500/20"
            data-testid="brand-kit-card"
        >
            <VStack align="stretch" gap={4}>
                <HStack justify="space-between" gap={2} flexWrap="wrap">
                    <HStack gap={2}>
                        <Box p={2} borderRadius="lg" bg="purple.500/15" color="purple.600">
                            <LuPalette size={18} />
                        </Box>
                        <Text fontWeight="semibold">Brand kit</Text>
                    </HStack>
                    {isAdmin && mode === 'view' && !isLoading && !hasError && (
                        <HStack gap={2}>
                            {branding && (
                                <Button size="sm" variant="ghost" colorPalette="red" onClick={() => setMode('remove')}>
                                    Remove brand kit
                                </Button>
                            )}
                            <Button size="sm" variant="outline" colorPalette="purple" onClick={() => setMode('edit')}>
                                {branding ? 'Edit' : 'Set brand kit'}
                            </Button>
                        </HStack>
                    )}
                </HStack>

                {isLoading ? (
                    <VStack align="stretch" gap={2}>
                        <Skeleton height="4" />
                        <Skeleton height="24" />
                    </VStack>
                ) : hasError ? (
                    <VStack align="stretch" gap={3}>
                        <InfoBox title="Couldn't load the brand kit">
                            The chain query failed — the node may be down or not on v8.2.0 yet, so
                            whether this token has a brand kit is unknown.
                        </InfoBox>
                        <Box>
                            <Button size="sm" variant="outline" colorPalette="purple" onClick={() => void refresh()}>
                                <LuRefreshCw />
                                Retry
                            </Button>
                        </Box>
                    </VStack>
                ) : isAdmin && mode === 'edit' ? (
                    <BrandKitForm asset={asset} initial={branding} onCancel={() => setMode('view')} onSaved={backToView} />
                ) : (
                    <VStack align="stretch" gap={3}>
                        {branding ? (
                            <BrandKitPreview asset={asset} branding={branding} />
                        ) : (
                            <Text fontSize="sm" color="fg.muted">
                                {isAdmin
                                    ? 'No brand kit yet. Give apps a font and light/dark colours to show this token in.'
                                    : 'This token has no brand kit.'}
                            </Text>
                        )}
                        {access === 'renounced' && (
                            <HStack gap={2} color="fg.muted" fontSize="sm" data-testid="brand-kit-frozen">
                                <LuLock />
                                <Text>
                                    {branding
                                        ? 'Frozen — the admin was renounced, so this kit can never change.'
                                        : 'Frozen — the admin was renounced, so this token will never have a brand kit.'}
                                </Text>
                            </HStack>
                        )}
                        {isAdmin && mode === 'remove' && (
                            <RemovePanel asset={asset} onCancel={() => setMode('view')} onRemoved={backToView} />
                        )}
                    </VStack>
                )}
            </VStack>
        </Card.Root>
    )
}
