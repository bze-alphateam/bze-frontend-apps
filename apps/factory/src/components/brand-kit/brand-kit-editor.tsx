"use client"

import React, { useMemo, useState } from 'react'
import { Button, Field, Grid, HStack, Input, NativeSelect, Text, VStack } from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import {
    Asset,
    BRANDING_COLOR_KEYS,
    BRANDING_FONTS,
    BRANDING_PALETTES,
    BRANDING_TEMPLATES,
    BrandingColorKey,
    BrandingField,
    BrandingTemplate,
    DenomBranding,
    HgCard,
    brandingFont,
    brandingFromTemplate,
    getChainName,
    hgVariant,
    validateDenomBranding,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { SubmitNote } from '@/components/guided'
import { InfoBox } from '@/components/ui/info-box'
import { changedFromTemplate, colorPickerValue, sameBranding, templateOfKit, undoText, withBrandingColor } from '@/lib/brand-kit'
import { BrandKitPreview, PALETTE_LABELS } from './brand-kit-preview'
import { TemplatePicker } from './template-picker'

const { setDenomBranding } = bze.tokenfactory.MessageComposer.withTypeUrl

const COLOR_LABELS: Record<BrandingColorKey, string> = {
    background: 'Background',
    text: 'Text',
    primary: 'Primary',
    secondary: 'Secondary',
}

/** Where a token without a kit starts: Honey, which passes AA in both modes. */
const STARTING_TEMPLATE = BRANDING_TEMPLATES.find(t => t.id === 'honey') ?? BRANDING_TEMPLATES[0]

function ChangedNote() {
    return <Field.HelperText fontSize="12px" color="hg.warning.text">changed from the template</Field.HelperText>
}

function ColorInput({
    label,
    value,
    error,
    changed,
    onChange,
}: {
    label: string;
    value: string;
    error: string | undefined;
    changed: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <Field.Root invalid={Boolean(error)}>
            <Field.Label fontSize="13px" fontWeight="600">{label}</Field.Label>
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
                    borderRadius="10px"
                    fontFamily="mono"
                    maxLength={7}
                    placeholder="#000000"
                    value={value}
                    onChange={(e) => onChange(e.target.value.trim())}
                />
            </HStack>
            <Field.ErrorText>{error}</Field.ErrorText>
            {changed && !error && <ChangedNote />}
        </Field.Root>
    )
}

/** What the kit was before the first template click of this visit, for Undo. */
interface UndoPoint {
    kit: DenomBranding;
    applied: BrandingTemplate | undefined;
}

/**
 * The brand kit editor (BFE-293): templates on top, then the font and the eight colours beside a
 * live preview. A template sets the font and both palettes; Undo goes back to the kit from before
 * the first template click. Save sends the whole kit (the chain has no partial updates); the
 * template is not stored. `saveBlocker` replaces Save with a reason when this wallet can't save.
 */
export function BrandKitEditor({
    asset,
    initial,
    saveBlocker,
    onCancel,
    onSaved,
}: {
    asset: Asset;
    /** The stored kit, or null when the token has none yet. */
    initial: DenomBranding | null;
    saveBlocker?: string;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    const [kit, setKit] = useState<DenomBranding>(() => initial ?? brandingFromTemplate(STARTING_TEMPLATE))
    const [applied, setApplied] = useState<BrandingTemplate | undefined>(() => (initial ? templateOfKit(initial) : STARTING_TEMPLATE))
    const [undo, setUndo] = useState<UndoPoint | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const errors = useMemo(() => validateDenomBranding(kit), [kit])
    const isValid = Object.keys(errors).length === 0
    const isUnchanged = sameBranding(kit, initial)
    const changed = useMemo(() => new Set<BrandingField>(applied ? changedFromTemplate(kit, applied) : []), [kit, applied])

    const apply = (template: BrandingTemplate) => {
        if (!undo) setUndo({ kit, applied })
        setKit(brandingFromTemplate(template))
        setApplied(template)
    }

    const undoTemplates = () => {
        if (!undo) return
        setKit(undo.kit)
        setApplied(undo.applied)
        setUndo(null)
    }

    const submit = async () => {
        if (!address || saveBlocker || !isValid || isUnchanged) return

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
        <VStack align="stretch" gap="16px">
            <TemplatePicker defaultOpen={initial === null} applied={applied} changedCount={changed.size} onApply={apply} />

            {undo && applied && (
                <HStack
                    role="status"
                    justify="space-between"
                    gap="12px"
                    flexWrap="wrap"
                    px="16px"
                    py="10px"
                    borderRadius="12px"
                    bg="hg.inset"
                    fontSize="14px"
                    data-testid="brand-kit-undo"
                >
                    <Text>{undoText(applied, brandingFont(applied.branding.font)?.label ?? applied.branding.font, changed.size)}</Text>
                    <Button size="sm" variant="ghost" color="hg.link" fontWeight="600" onClick={undoTemplates}>Undo</Button>
                </HStack>
            )}

            <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 3fr) minmax(0, 2fr)' }} gap="16px" alignItems="start">
                <HgCard as="section" aria-label="Font and colours" p={{ base: '16px', md: '20px' }} minW={0}>
                    <VStack align="stretch" gap={4}>
                        <Field.Root invalid={Boolean(errors.font)}>
                            <Field.Label fontSize="14px" fontWeight="600">Font</Field.Label>
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
                            {changed.has('font') && !errors.font && <ChangedNote />}
                        </Field.Root>

                        <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap={4}>
                            {BRANDING_PALETTES.map(palette => (
                                <VStack key={palette} align="stretch" gap={3}>
                                    <Text fontSize="14px" fontWeight="700">
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
                                                changed={changed.has(field)}
                                                onChange={(value) => setKit(prev => withBrandingColor(prev, palette, key, value))}
                                            />
                                        )
                                    })}
                                </VStack>
                            ))}
                        </Grid>
                    </VStack>
                </HgCard>

                <HgCard as="section" aria-label="Live preview" p={{ base: '16px', md: '20px' }} minW={0} position={{ lg: 'sticky' }} top={{ lg: '96px' }}>
                    <VStack align="stretch" gap={3} data-testid="brand-kit-live-preview">
                        <Text as="h2" fontSize="16px" fontWeight="700">Live preview</Text>
                        {isValid
                            ? <BrandKitPreview asset={asset} branding={kit} stacked />
                            : <Text fontSize="14px" color="fg.muted">Fix the fields marked in red to see the preview.</Text>}
                    </VStack>
                </HgCard>
            </Grid>

            <InfoBox>
                Saving always stores the whole kit: the font and all eight colours. It is public, and apps that
                support brand kits pick it up right away. The template you started from is not stored.
            </InfoBox>

            <VStack align="stretch" gap="8px">
                <HStack gap="10px">
                    <Button variant="ghost" size="lg" color="hg.link" fontWeight="600" onClick={onCancel} flex="1">
                        Cancel
                    </Button>
                    <Button
                        variant={hgVariant('primary')}
                        size="lg"
                        onClick={submit}
                        disabled={Boolean(saveBlocker) || !isValid || isUnchanged}
                        loading={isSubmitting}
                        loadingText="Confirm in your wallet"
                        flex="1"
                    >
                        Save brand kit
                    </Button>
                </HStack>
                {saveBlocker ? (
                    <SubmitNote>{saveBlocker}</SubmitNote>
                ) : isValid && isUnchanged && (
                    <SubmitNote>Nothing changed yet.</SubmitNote>
                )}
            </VStack>
        </VStack>
    )
}
