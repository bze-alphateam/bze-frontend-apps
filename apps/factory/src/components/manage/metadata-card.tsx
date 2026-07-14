"use client"

import React, { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Field,
    HStack,
    Input,
    Separator,
    Skeleton,
    Text,
    Textarea,
    VStack,
} from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import type { Metadata, MetadataSDKType } from '@bze/bzejs/cosmos/bank/v1beta1/bank'
import { LuArrowRight, LuPencil } from 'react-icons/lu'
import { Asset, getChainName } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { InfoBox } from '@/components/ui/info-box'
import {
    MAX_DESCRIPTION_LENGTH,
    validateDescription,
    validateName,
} from '@/components/token-wizard/validation'

const { setDenomMetadata } = bze.tokenfactory.MessageComposer.withTypeUrl

interface MetadataForm {
    name: string
    description: string
}

/**
 * MsgSetDenomMetadata replaces the whole metadata object, so we rebuild it
 * from what's on-chain and swap only the editable fields. Symbol, base,
 * display, the denom units, and the URI are carried over untouched — they're
 * not editable here. Tokens that somehow have no metadata yet get the wizard's
 * canonical layout: base denom at exponent 0 + display unit at the asset's
 * decimals.
 */
function buildUpdatedMetadata(current: MetadataSDKType | undefined, asset: Asset, form: MetadataForm): Metadata {
    const shared = {
        name: form.name.trim(),
        description: form.description.trim(),
    }

    if (current && current.base) {
        return {
            ...shared,
            denomUnits: current.denom_units.map(u => ({
                denom: u.denom,
                exponent: u.exponent,
                aliases: u.aliases,
            })),
            base: current.base,
            display: current.display,
            symbol: current.symbol,
            uri: current.uri,
            uriHash: current.uri_hash,
        }
    }

    const subdenom = asset.denom.split('/')[2] ?? asset.denom
    const displayDenom = asset.ticker.toLowerCase()
    return {
        ...shared,
        denomUnits: [
            { denom: asset.denom, exponent: 0, aliases: [subdenom] },
            { denom: displayDenom, exponent: asset.decimals, aliases: [] },
        ],
        base: asset.denom,
        display: displayDenom,
        symbol: asset.ticker,
        uri: '',
        uriHash: '',
    }
}

function MetadataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <HStack justify="space-between" align="start" gap={4}>
            <Text fontSize="sm" color="fg.muted" flexShrink={0}>
                {label}
            </Text>
            <Text
                fontSize="sm"
                fontWeight="medium"
                textAlign="right"
                fontFamily={mono ? 'mono' : undefined}
                wordBreak="break-all"
                color={value ? undefined : 'fg.muted'}
            >
                {value || '—'}
            </Text>
        </HStack>
    )
}

function DiffRow({ label, oldValue, newValue }: { label: string; oldValue: string; newValue: string }) {
    return (
        <VStack align="stretch" gap={1}>
            <Text fontSize="sm" color="fg.muted">
                {label}
            </Text>
            <HStack gap={2} align="start" flexWrap="wrap">
                <Text fontSize="sm" color="fg.muted" textDecoration="line-through" wordBreak="break-all">
                    {oldValue || '—'}
                </Text>
                <Box color="fg.muted" mt="0.5">
                    <LuArrowRight size={14} />
                </Box>
                <Text fontSize="sm" fontWeight="medium" wordBreak="break-all">
                    {newValue || '—'}
                </Text>
            </HStack>
        </VStack>
    )
}

/**
 * Admin-only card on the token manage panel: view the on-chain metadata,
 * edit the mutable fields (name, description), review an old → new diff,
 * and sign one MsgSetDenomMetadata.
 */
export function MetadataCard({
    asset,
    metadata,
    isLoading,
    onSaved,
}: {
    asset: Asset;
    metadata: MetadataSDKType | undefined;
    isLoading: boolean;
    onSaved: () => void;
}) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    const [mode, setMode] = useState<'view' | 'edit' | 'review'>('view')
    const [form, setForm] = useState<MetadataForm>({ name: '', description: '' })
    const [touched, setTouched] = useState<{ [K in keyof MetadataForm]?: boolean }>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const currentName = metadata?.name ?? asset.name
    const currentDescription = metadata?.description ?? ''

    const errors = useMemo(() => ({
        name: validateName(form.name),
        description: validateDescription(form.description),
    }), [form])
    const isValid = Object.values(errors).every(e => e === '')

    const changes = useMemo(() => {
        const diff: Array<{ label: string; oldValue: string; newValue: string }> = []
        if (form.name.trim() !== currentName) diff.push({ label: 'Name', oldValue: currentName, newValue: form.name.trim() })
        if (form.description.trim() !== currentDescription) {
            diff.push({ label: 'Description', oldValue: currentDescription, newValue: form.description.trim() })
        }
        return diff
    }, [form, currentName, currentDescription])

    const startEditing = () => {
        setForm({ name: currentName, description: currentDescription })
        setTouched({})
        setMode('edit')
    }

    const submit = async () => {
        if (!address || !isValid || changes.length === 0) return

        const msg = setDenomMetadata({
            creator: address,
            metadata: buildUpdatedMetadata(metadata, asset, form),
        })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: () => {
                    setMode('view')
                    onSaved()
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Card.Root
            variant="outline"
            p="5"
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderColor="yellow.500/20"
        >
            <VStack align="stretch" gap={4}>
                <HStack justify="space-between" gap={2}>
                    <HStack gap={2}>
                        <Box p={2} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                            <LuPencil size={18} />
                        </Box>
                        <Text fontWeight="semibold">Metadata</Text>
                    </HStack>
                    {mode === 'view' && (
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={startEditing} disabled={isLoading}>
                            Edit
                        </Button>
                    )}
                </HStack>

                {mode === 'view' && (
                    isLoading ? (
                        <VStack align="stretch" gap={2}>
                            <Skeleton height="4" />
                            <Skeleton height="4" />
                            <Skeleton height="4" />
                        </VStack>
                    ) : (
                        <VStack align="stretch" gap={3}>
                            <MetadataRow label="Name" value={currentName} />
                            <MetadataRow label="Description" value={currentDescription} />
                        </VStack>
                    )
                )}

                {mode === 'edit' && (
                    <VStack align="stretch" gap={4}>
                        <Field.Root invalid={Boolean(touched.name) && errors.name !== ''}>
                            <Field.Label>Name</Field.Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                            />
                            <Field.ErrorText>{errors.name}</Field.ErrorText>
                        </Field.Root>

                        <Field.Root invalid={Boolean(touched.description) && errors.description !== ''}>
                            <Field.Label>Description</Field.Label>
                            <Textarea
                                placeholder="What is this token for?"
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                onBlur={() => setTouched(prev => ({ ...prev, description: true }))}
                            />
                            <Field.HelperText>
                                Optional — {MAX_DESCRIPTION_LENGTH} characters max.
                            </Field.HelperText>
                            <Field.ErrorText>{errors.description}</Field.ErrorText>
                        </Field.Root>

                        <InfoBox>
                            The symbol ({asset.ticker}), denom, and decimals are immutable — only the
                            fields above can change. Updates are public and take effect immediately.
                        </InfoBox>

                        <HStack gap={2}>
                            <Button variant="ghost" colorPalette="yellow" onClick={() => setMode('view')} flex="1">
                                Cancel
                            </Button>
                            <Button
                                colorPalette="yellow"
                                onClick={() => setMode('review')}
                                disabled={!isValid || changes.length === 0}
                                flex="1"
                            >
                                Review changes
                            </Button>
                        </HStack>
                        {isValid && changes.length === 0 && (
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Nothing changed yet.
                            </Text>
                        )}
                    </VStack>
                )}

                {mode === 'review' && (
                    <VStack align="stretch" gap={4}>
                        <VStack align="stretch" gap={3}>
                            {changes.map(change => (
                                <DiffRow key={change.label} {...change} />
                            ))}
                        </VStack>

                        <Separator />

                        <InfoBox>
                            Signing replaces the token&apos;s on-chain metadata with the values above.
                            Wallets and explorers pick the change up right away.
                        </InfoBox>

                        <HStack gap={2}>
                            <Button variant="ghost" colorPalette="yellow" onClick={() => setMode('edit')} flex="1">
                                Back
                            </Button>
                            <Button
                                colorPalette="yellow"
                                onClick={submit}
                                loading={isSubmitting}
                                loadingText="Waiting for signature..."
                                flex="1"
                            >
                                Save on-chain
                            </Button>
                        </HStack>
                    </VStack>
                )}
            </VStack>
        </Card.Root>
    )
}
