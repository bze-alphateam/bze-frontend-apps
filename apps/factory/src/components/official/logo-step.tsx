"use client"

import React, { useState } from 'react'
import { Box, Button, Field, HStack, Input, List, Text, VStack } from '@chakra-ui/react'
import { type LogoFormat, isValidLogoFileName, suggestLogoFileName } from '@/lib/registry-entry'

export interface LogoReady {
    format: LogoFormat;
    fileName: string;
}

interface LogoStepProps {
    /** The token's display unit, for the suggested file name. */
    display: string;
    /** The saved answer, when the step is reopened. */
    initial?: Partial<LogoReady>;
    onReady: (ready: LogoReady) => void;
}

const FORMATS: { value: LogoFormat; label: string; hint: string }[] = [
    { value: 'svg', label: 'SVG', hint: 'Preferred: sharp at every size' },
    { value: 'png', label: 'PNG', hint: 'Fine too' },
]

/**
 * Step 1 of the registry guide: the logo rules, the format and the file name. Kept behind
 * `onReady` so the in-browser logo checker (BFE-166) can replace it.
 */
export function LogoStep({ display, initial, onReady }: LogoStepProps) {
    const [format, setFormat] = useState<LogoFormat>(initial?.format ?? 'svg')
    const [fileName, setFileName] = useState(initial?.fileName ?? suggestLogoFileName(display, initial?.format ?? 'svg'))
    const [edited, setEdited] = useState(Boolean(initial?.fileName))
    const valid = isValidLogoFileName(fileName, format)

    const pick = (next: LogoFormat) => {
        setFormat(next)
        // Follow the format until the user typed their own name.
        if (!edited) setFileName(suggestLogoFileName(display, next))
    }

    return (
        <VStack align="stretch" gap={4}>
            <List.Root fontSize="sm" color="fg.muted" ps={5} gap={1}>
                <List.Item>Square, under 250 KB.</List.Item>
                <List.Item>PNG or SVG only. No JPG, not even renamed.</List.Item>
                <List.Item>An SVG must be real vector art with under 1,000 shapes, not a picture wrapped in SVG.</List.Item>
                <List.Item>A lower-case file name.</List.Item>
            </List.Root>

            <VStack align="stretch" gap={2}>
                <Text fontSize="sm" fontWeight="medium">Format</Text>
                <HStack role="radiogroup" aria-label="Logo format" gap={2} flexWrap="wrap">
                    {FORMATS.map(f => {
                        const selected = f.value === format
                        return (
                            <Box
                                key={f.value}
                                as="button"
                                role="radio"
                                aria-checked={selected}
                                aria-label={f.label}
                                onClick={() => pick(f.value)}
                                textAlign="start"
                                px={3}
                                py={2}
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor={selected ? 'yellow.500' : 'border.muted'}
                                bg={selected ? 'yellow.500/10' : 'bg.panel'}
                                cursor="pointer"
                            >
                                <Text fontSize="sm" fontWeight="semibold">{f.label}</Text>
                                <Text fontSize="xs" color="fg.muted">{f.hint}</Text>
                            </Box>
                        )
                    })}
                </HStack>
            </VStack>

            <Field.Root invalid={!valid}>
                <Field.Label>File name</Field.Label>
                <Input
                    value={fileName}
                    onChange={(e) => {
                        setEdited(true)
                        setFileName(e.target.value)
                    }}
                />
                <Field.ErrorText>{`Lower case letters, digits, dots, dashes or underscores, ending in .${format}`}</Field.ErrorText>
            </Field.Root>

            <Button alignSelf="start" colorPalette="yellow" size="sm" disabled={!valid} onClick={() => onReady({ format, fileName })}>
                Mark as done
            </Button>
        </VStack>
    )
}
