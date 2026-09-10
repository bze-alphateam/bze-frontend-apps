"use client"

import React, { useState } from 'react'
import { Field, Textarea, VStack } from '@chakra-ui/react'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { MAX_DESCRIPTION_LENGTH } from '@/components/token-wizard/validation'

export function MetadataStep() {
    const { form, updateForm } = useTokenWizard()
    const { metadataErrors } = useTokenWizardValidation()

    const [touched, setTouched] = useState(false)

    return (
        <VStack align="stretch" gap={5}>
            <Field.Root invalid={touched && metadataErrors.description !== ''}>
                <Field.Label>Description</Field.Label>
                <Textarea
                    placeholder="What is this token for?"
                    rows={3}
                    value={form.description}
                    onChange={(e) => updateForm({ description: e.target.value })}
                    onBlur={() => setTouched(true)}
                />
                <Field.HelperText>
                    Optional — stored on-chain in the token&apos;s metadata ({MAX_DESCRIPTION_LENGTH} characters max).
                </Field.HelperText>
                <Field.ErrorText>{metadataErrors.description}</Field.ErrorText>
            </Field.Root>
        </VStack>
    )
}
