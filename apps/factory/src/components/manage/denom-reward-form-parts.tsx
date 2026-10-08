"use client"

import React, { useState } from 'react'
import { Box, Button, Card, Field, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuSearchX } from 'react-icons/lu'
import { prettyAmount, uAmountToBigNumberAmount, useAsset } from '@bze/bze-ui-kit'

/** Shared building blocks of the denom reward forms (schedule, airdrop). */

export function TextField({
    label,
    helper,
    error,
    value,
    onChange,
    placeholder,
    inputMode = 'decimal',
}: {
    label: string;
    helper?: string;
    error: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    inputMode?: 'decimal' | 'numeric';
}) {
    const [touched, setTouched] = useState(false)

    return (
        <Field.Root invalid={touched && error !== ''}>
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

export function Notice({ title, children, onBack }: { title: string; children: React.ReactNode; onBack: () => void }) {
    return (
        <Card.Root variant="outline" p="10">
            <VStack gap={4}>
                <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                    <LuSearchX size={28} />
                </Box>
                <VStack gap={1}>
                    <Text fontWeight="semibold">{title}</Text>
                    <Text fontSize="sm" color="fg.muted" textAlign="center">{children}</Text>
                </VStack>
                <Button colorPalette="yellow" variant="outline" onClick={onBack}>
                    <LuArrowLeft /> Back to the token
                </Button>
            </VStack>
        </Card.Root>
    )
}

export function FeeLine({ label, denom, amount }: { label: string; denom: string; amount: string }) {
    const { asset } = useAsset(denom)
    return (
        <HStack justify="space-between">
            <Text fontSize="sm" color="fg.muted">{label}</Text>
            <Text fontSize="sm" fontWeight="medium">
                {prettyAmount(uAmountToBigNumberAmount(amount, asset?.decimals ?? 0))} {asset?.ticker ?? denom}
            </Text>
        </HStack>
    )
}
