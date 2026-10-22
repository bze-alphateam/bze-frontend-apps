"use client"

import React, { useState } from 'react'
import { Button, Field, Input, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuSearchX } from 'react-icons/lu'
import { IconTile } from '@bze/bze-ui-kit'
import { FormFrame } from '@/components/guided/guided-form'
import { softButton } from '@/components/ui/soft-button'

/** Shared building blocks of the denom reward forms (schedule, airdrop). */

export function TextField({
    label,
    helper,
    error,
    value,
    onChange,
    placeholder,
    inputMode = 'decimal',
    disabled,
}: {
    label: string;
    helper?: string;
    error: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    inputMode?: 'decimal' | 'numeric';
    disabled?: boolean;
}) {
    const [touched, setTouched] = useState(false)

    return (
        <Field.Root invalid={touched && error !== ''} disabled={disabled}>
            <Field.Label>{label}</Field.Label>
            <Input
                placeholder={placeholder}
                inputMode={inputMode}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setTouched(true)}
            />
            {helper && <Field.HelperText>{helper}</Field.HelperText>}
            <Field.ErrorText>{error}</Field.ErrorText>
        </Field.Root>
    )
}

/** A dead end of a denom reward page (no token, not found, query failed), in the form's content band. */
export function Notice({ title, children, onBack }: { title: string; children: React.ReactNode; onBack: () => void }) {
    return (
        <FormFrame narrow>
            <VStack as="section" align="start" gap="10px" p="24px" borderRadius="hg.lg" borderWidth="1px" borderColor="hg.hairline" bg="hg.card">
                <IconTile icon={<LuSearchX />} />
                <Text as="h1" fontSize="17px" fontWeight="700">{title}</Text>
                <Text fontSize="14px" lineHeight="1.55" color="fg.muted">{children}</Text>
                <Button {...softButton} size="sm" onClick={onBack}>
                    <LuArrowLeft /> Back to the token
                </Button>
            </VStack>
        </FormFrame>
    )
}
