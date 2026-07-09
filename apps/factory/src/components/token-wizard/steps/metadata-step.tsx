"use client"

import React, { useState } from 'react'
import { Field, Input, Textarea, VStack } from '@chakra-ui/react'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { MAX_DESCRIPTION_LENGTH } from '@/components/token-wizard/validation'

export function MetadataStep() {
    const { form, updateForm } = useTokenWizard()
    const { metadataErrors } = useTokenWizardValidation()

    const [touched, setTouched] = useState<{ description?: boolean; uri?: boolean }>({})

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
        </VStack>
    )
}
