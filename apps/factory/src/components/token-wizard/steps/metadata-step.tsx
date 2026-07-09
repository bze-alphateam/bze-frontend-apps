"use client"

import React, { useState } from 'react'
import {
    Badge,
    Box,
    Button,
    Field,
    HStack,
    IconButton,
    Input,
    Text,
    Textarea,
    VStack,
} from '@chakra-ui/react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { InfoBox } from '@/components/ui/info-box'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { MAX_DECIMALS, MAX_DESCRIPTION_LENGTH, TOKEN_DECIMALS } from '@/components/token-wizard/validation'

export function MetadataStep() {
    const { form, updateForm } = useTokenWizard()
    const { metadataErrors } = useTokenWizardValidation()

    const [touched, setTouched] = useState<{ description?: boolean; uri?: boolean }>({})

    const addUnit = () => {
        updateForm({ extraDenomUnits: [...form.extraDenomUnits, { denom: '', exponent: 3 }] })
    }

    const updateUnit = (index: number, patch: Partial<{ denom: string; exponent: number }>) => {
        updateForm({
            extraDenomUnits: form.extraDenomUnits.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)),
        })
    }

    const removeUnit = (index: number) => {
        updateForm({ extraDenomUnits: form.extraDenomUnits.filter((_, i) => i !== index) })
    }

    const displayDenom = form.symbol.toLowerCase() || '<symbol>'

    return (
        <VStack align="stretch" gap={5}>
            <Field.Root invalid={Boolean(touched.description) && metadataErrors.description !== ''}>
                <Field.Label>Description</Field.Label>
                <Textarea
                    placeholder="What is this token for?"
                    rows={3}
                    value={form.description}
                    onChange={(e) => updateForm({ description: e.target.value })}
                    onBlur={() => setTouched(prev => ({ ...prev, description: true }))}
                />
                <Field.HelperText>
                    Optional — stored on-chain in the token&apos;s metadata ({MAX_DESCRIPTION_LENGTH} characters max).
                </Field.HelperText>
                <Field.ErrorText>{metadataErrors.description}</Field.ErrorText>
            </Field.Root>

            <Field.Root invalid={Boolean(touched.uri) && metadataErrors.uri !== ''}>
                <Field.Label>Token info URI</Field.Label>
                <Input
                    placeholder="https://mytoken.com/info.json"
                    value={form.logoUri}
                    onChange={(e) => updateForm({ logoUri: e.target.value })}
                    onBlur={() => setTouched(prev => ({ ...prev, uri: true }))}
                />
                <Field.HelperText>
                    Optional — a link to a page or document with more about the token (logo, links, docs).
                    The chain stores one URI; wallets and explorers may display it.
                </Field.HelperText>
                <Field.ErrorText>{metadataErrors.uri}</Field.ErrorText>
            </Field.Root>

            <VStack align="stretch" gap={3}>
                <HStack justify="space-between">
                    <Text fontSize="sm" fontWeight="medium">
                        Denom units
                    </Text>
                    <Button size="xs" variant="outline" colorPalette="yellow" onClick={addUnit}>
                        <LuPlus />
                        Add unit
                    </Button>
                </HStack>

                <InfoBox>
                    Units are the names for different powers of ten of your token — like cents vs
                    dollars. Two exist already: the base unit (your full denom, exponent 0) and the
                    display unit (exponent {TOKEN_DECIMALS}). Most tokens don&apos;t need more.
                </InfoBox>

                {/* Reserved units, shown for context */}
                <HStack gap={2} wrap="wrap">
                    <Badge colorPalette="gray" variant="surface">
                        {form.subdenom || '<subdenom>'} · exponent 0 (base)
                    </Badge>
                    <Badge colorPalette="gray" variant="surface">
                        {displayDenom} · exponent {TOKEN_DECIMALS} (display)
                    </Badge>
                </HStack>

                {form.extraDenomUnits.map((unit, index) => (
                    <Box key={index}>
                        <HStack gap={2} align="start">
                            <Input
                                placeholder="e.g. mhoney"
                                size="sm"
                                value={unit.denom}
                                onChange={(e) => updateUnit(index, { denom: e.target.value })}
                            />
                            <Input
                                type="number"
                                size="sm"
                                maxW="24"
                                min={1}
                                max={MAX_DECIMALS}
                                step={1}
                                value={Number.isNaN(unit.exponent) ? '' : unit.exponent}
                                onChange={(e) =>
                                    updateUnit(index, { exponent: e.target.value === '' ? NaN : Number(e.target.value) })
                                }
                            />
                            <IconButton
                                aria-label="Remove unit"
                                size="sm"
                                variant="ghost"
                                colorPalette="red"
                                onClick={() => removeUnit(index)}
                            >
                                <LuTrash2 />
                            </IconButton>
                        </HStack>
                        {metadataErrors.unitErrors[index] && (
                            <Text fontSize="xs" color="red.500" mt={1}>
                                {metadataErrors.unitErrors[index]}
                            </Text>
                        )}
                    </Box>
                ))}
            </VStack>
        </VStack>
    )
}
