"use client"

import React, { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Field,
    HStack,
    Input,
    Separator,
    Text,
    Textarea,
    VStack,
} from '@chakra-ui/react'
import { bze } from '@bze/bzejs'
import type { MetadataSDKType } from '@bze/bzejs/cosmos/bank/v1beta1/bank'
import { LuArrowRight, LuLock, LuWallet } from 'react-icons/lu'
import { Asset, HgCard, IconTile, Shimmer, getChainName, hgVariant } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { InfoBox } from '@/components/ui/info-box'
import { softButton } from '@/components/ui/soft-button'
import {
    MAX_DESCRIPTION_LENGTH,
    validateDescription,
    validateName,
} from '@/components/token-wizard/validation'
import { buildUpdatedMetadata, metadataChanges, type MetadataChange, type MetadataForm } from '@/lib/token-metadata'
import type { AdminState } from '@/lib/workspace'

const { setDenomMetadata } = bze.tokenfactory.MessageComposer.withTypeUrl

/** A quiet text button in the link colour (Cancel, Back). */
const linkButton = { variant: 'ghost' as const, size: 'lg' as const, color: 'hg.link', fontWeight: '600' }

function MetadataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <VStack align="stretch" gap="3px">
            <Text fontSize="12px" color="hg.text.faint">
                {label}
            </Text>
            <Text
                fontSize="14px"
                fontFamily={mono ? 'mono' : undefined}
                overflowWrap="anywhere"
                whiteSpace="pre-wrap"
                color={value ? undefined : 'fg.muted'}
            >
                {value || '—'}
            </Text>
        </VStack>
    )
}

function DiffRow({ label, oldValue, newValue }: MetadataChange) {
    return (
        <VStack align="stretch" gap="6px" data-testid={`metadata-diff-${label.toLowerCase()}`}>
            <Text fontSize="13px" color="fg.muted">
                {label}
            </Text>
            <HStack gap="8px" align="start" flexWrap="wrap">
                <Text fontSize="14px" color="hg.text.faint" textDecoration="line-through" overflowWrap="anywhere">
                    {oldValue || '—'}
                </Text>
                <Box color="hg.text.faint" mt="3px" aria-hidden>
                    <LuArrowRight size={14} />
                </Box>
                <Text fontSize="14px" fontWeight="600" overflowWrap="anywhere">
                    {newValue || '—'}
                </Text>
            </HStack>
        </VStack>
    )
}

/**
 * "What wallets show": the token's on-chain name and description next to the fixed ticker and
 * token ID. The admin edits the two mutable fields in place, reviews an old → new diff and signs
 * one MsgSetDenomMetadata; everyone else reads, and a renounced token says it's frozen.
 */
export function MetadataCard({
    asset,
    metadata,
    isLoading,
    access,
    onSaved,
}: {
    asset: Asset;
    metadata: MetadataSDKType | undefined;
    isLoading: boolean;
    access: AdminState;
    onSaved: () => void;
}) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()

    const [mode, setMode] = useState<'view' | 'edit' | 'review'>('view')
    const [form, setForm] = useState<MetadataForm>({ name: '', description: '' })
    const [touched, setTouched] = useState<{ [K in keyof MetadataForm]?: boolean }>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const isAdmin = access === 'admin'
    const current: MetadataForm = { name: metadata?.name ?? asset.name, description: metadata?.description ?? '' }

    const errors = useMemo(() => ({
        name: validateName(form.name),
        description: validateDescription(form.description),
    }), [form])
    const isValid = Object.values(errors).every(e => e === '')
    const changes = metadataChanges(current, form)

    const startEditing = () => {
        setForm(current)
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
        <HgCard as="section" aria-label="What wallets show" p="22px" minW={0} data-testid="metadata-card">
            <VStack align="stretch" gap="16px">
                <HStack justify="space-between" gap="10px" flexWrap="wrap">
                    <HStack gap="10px">
                        <IconTile icon={<LuWallet />} size={36} />
                        <Text as="h2" fontSize="17px" fontWeight="700">What wallets show</Text>
                    </HStack>
                    {isAdmin && mode === 'view' && (
                        <Button {...softButton} size="sm" h="34px" px="14px" onClick={startEditing} disabled={isLoading}>
                            Edit
                        </Button>
                    )}
                </HStack>

                {isLoading ? (
                    <VStack align="stretch" gap="8px">
                        <Shimmer h="16px" />
                        <Shimmer h="16px" />
                        <Shimmer h="16px" />
                    </VStack>
                ) : mode === 'review' ? (
                    <VStack align="stretch" gap={4}>
                        <VStack align="stretch" gap={3}>
                            {changes.map(change => (
                                <DiffRow key={change.label} {...change} />
                            ))}
                        </VStack>

                        <Separator borderColor="hg.divider" />

                        <InfoBox>
                            {`Signing replaces the token's on-chain metadata with the values above. Wallets and explorers pick the change up right away.`}
                        </InfoBox>

                        <HStack gap="10px">
                            <Button {...linkButton} onClick={() => setMode('edit')} flex="1">
                                Back
                            </Button>
                            <Button
                                variant={hgVariant('primary')}
                                size="lg"
                                onClick={submit}
                                loading={isSubmitting}
                                loadingText="Waiting for signature..."
                                flex="1"
                            >
                                Save on-chain
                            </Button>
                        </HStack>
                    </VStack>
                ) : (
                    <VStack align="stretch" gap={4}>
                        {mode === 'edit' ? (
                            <Field.Root invalid={Boolean(touched.name) && errors.name !== ''}>
                                <Field.Label fontSize="14px" fontWeight="600">Name</Field.Label>
                                <Input
                                    h="44px"
                                    borderRadius="12px"
                                    value={form.name}
                                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                                />
                                <Field.ErrorText>{errors.name}</Field.ErrorText>
                            </Field.Root>
                        ) : (
                            <MetadataRow label="Name" value={current.name} />
                        )}

                        <MetadataRow label="Ticker" value={asset.ticker} />

                        {mode === 'edit' ? (
                            <Field.Root invalid={Boolean(touched.description) && errors.description !== ''}>
                                <Field.Label fontSize="14px" fontWeight="600">Description</Field.Label>
                                <Textarea
                                    borderRadius="12px"
                                    placeholder="What is this token for?"
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    onBlur={() => setTouched(prev => ({ ...prev, description: true }))}
                                />
                                <Field.HelperText fontSize="12px" fontFamily="mono" color="hg.text.faint" data-testid="metadata-description-counter">
                                    {`${form.description.length} / ${MAX_DESCRIPTION_LENGTH}`}
                                </Field.HelperText>
                                <Field.ErrorText>{errors.description}</Field.ErrorText>
                            </Field.Root>
                        ) : (
                            <MetadataRow label="Description" value={current.description} />
                        )}

                        <MetadataRow label="Token ID" value={asset.denom} mono />

                        <Text fontSize="12px" color="hg.text.faint">
                            The ticker, token ID and decimals can never change.
                        </Text>

                        {access === 'renounced' && (
                            <HStack gap="8px" color="fg.muted" fontSize="14px" data-testid="metadata-frozen">
                                <LuLock />
                                <Text>Frozen forever: the supply was locked.</Text>
                            </HStack>
                        )}

                        {mode === 'edit' && (
                            <VStack align="stretch" gap="8px">
                                <HStack gap="10px">
                                    <Button {...linkButton} onClick={() => setMode('view')} flex="1">
                                        Cancel
                                    </Button>
                                    <Button
                                        variant={hgVariant('primary')}
                                        size="lg"
                                        onClick={() => setMode('review')}
                                        disabled={!isValid || changes.length === 0}
                                        flex="1"
                                    >
                                        Review changes
                                    </Button>
                                </HStack>
                                {isValid && changes.length === 0 && (
                                    <Text fontSize="14px" color="fg.muted" textAlign="center">
                                        Nothing changed yet.
                                    </Text>
                                )}
                            </VStack>
                        )}
                    </VStack>
                )}
            </VStack>
        </HgCard>
    )
}
