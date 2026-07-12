"use client"

import React from 'react'
import { Box, HStack, Slider, Text, VStack } from '@chakra-ui/react'

/** Where swap fees go, as integer percentages that always sum to 100. */
export interface FeeSplit {
    providers: number;
    burner: number;
    treasury: number;
}

export const DEFAULT_FEE_SPLIT: FeeSplit = { providers: 100, burner: 0, treasury: 0 }

/**
 * The keeper parses fee_dest as JSON with decimal strings that must sum to
 * exactly 1 — integer percents over 100 guarantee that by construction.
 */
export function feeSplitToFeeDest(split: FeeSplit): string {
    const toDecimal = (pct: number) => (pct / 100).toFixed(2)
    return JSON.stringify({
        providers: toDecimal(split.providers),
        burner: toDecimal(split.burner),
        treasury: toDecimal(split.treasury),
    })
}

const SEGMENTS = [
    {
        key: 'providers' as const,
        label: 'Providers',
        cssVar: 'var(--chakra-colors-yellow-500)',
        hint: 'compounds into the pool for LPs',
    },
    {
        key: 'burner' as const,
        label: 'Burner',
        cssVar: 'var(--chakra-colors-orange-600)',
        hint: 'burned forever',
    },
    {
        key: 'treasury' as const,
        label: 'Treasury',
        cssVar: 'var(--chakra-colors-blue-500)',
        hint: 'community treasury',
    },
]

/**
 * One track, two handles → three segments (providers | burner | treasury).
 * The handles ARE the boundaries, so the split can't help but sum to 100%.
 */
export function FeeSplitSlider({ value, onChange }: { value: FeeSplit; onChange: (split: FeeSplit) => void }) {
    // Handle positions: end of providers, end of providers+burner.
    const handles = [value.providers, value.providers + value.burner]

    const setHandles = ([h1, h2]: number[]) => {
        onChange({ providers: h1, burner: h2 - h1, treasury: 100 - h2 })
    }

    const trackGradient = `linear-gradient(to right, ` +
        `${SEGMENTS[0].cssVar} 0% ${handles[0]}%, ` +
        `${SEGMENTS[1].cssVar} ${handles[0]}% ${handles[1]}%, ` +
        `${SEGMENTS[2].cssVar} ${handles[1]}% 100%)`

    return (
        <VStack align="stretch" gap={3}>
            <Slider.Root
                value={handles}
                onValueChange={(details) => setHandles(details.value)}
                min={0}
                max={100}
                step={1}
                colorPalette="yellow"
            >
                <Slider.Control>
                    <Slider.Track style={{ background: trackGradient }} height="3" />
                    <Slider.Thumb index={0}>
                        <Slider.HiddenInput />
                    </Slider.Thumb>
                    <Slider.Thumb index={1}>
                        <Slider.HiddenInput />
                    </Slider.Thumb>
                </Slider.Control>
            </Slider.Root>

            <HStack gap={4} flexWrap="wrap">
                {SEGMENTS.map(segment => (
                    <HStack key={segment.key} gap={2} align="center">
                        <Box boxSize="2.5" borderRadius="full" style={{ background: segment.cssVar }} />
                        <Text fontSize="sm">
                            <Text as="span" fontWeight="semibold">{segment.label} {value[segment.key]}%</Text>
                            <Text as="span" color="fg.muted"> — {segment.hint}</Text>
                        </Text>
                    </HStack>
                ))}
            </HStack>
        </VStack>
    )
}
