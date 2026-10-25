"use client"

import React, { useState } from 'react'
import { Box, Field, HStack, Input, Slider, Text, VStack } from '@chakra-ui/react'
import { HIVE_GLOW_APPS } from '@bze/bze-ui-kit'

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

/**
 * The split after one share is typed in (clamped to 0–100). The other two make room in a fixed
 * order: providers and the burner take from the treasury first, the treasury from the
 * burner first; the result always sums to 100.
 */
export function setFeeShare(split: FeeSplit, key: keyof FeeSplit, pct: number): FeeSplit {
    const v = Math.min(100, Math.max(0, Math.round(pct)))
    if (key === 'providers') {
        const burner = Math.min(split.burner, 100 - v)
        return { providers: v, burner, treasury: 100 - v - burner }
    }
    if (key === 'burner') {
        const providers = Math.min(split.providers, 100 - v)
        return { providers, burner: v, treasury: 100 - providers - v }
    }
    const providers = Math.min(split.providers, 100 - v)
    return { providers, burner: 100 - providers - v, treasury: v }
}

/** Providers in the Factory gold, the burner in the Burner app's orange, the treasury in the neutral blue. */
const SEGMENTS = [
    {
        key: 'providers' as const,
        label: 'Providers',
        cssVar: 'var(--chakra-colors-app-solid)',
    },
    {
        key: 'burner' as const,
        label: 'Burner',
        cssVar: 'var(--fee-split-burner)',
    },
    {
        key: 'treasury' as const,
        label: 'Treasury',
        cssVar: 'var(--chakra-colors-hg-info)',
    },
]

/** A share's number box: typing updates the split (and so the slider) on every valid number. */
function ShareInput({ label, value, onChange }: { label: string; value: number; onChange: (pct: number) => void }) {
    // What the user typed, kept while it still matches the split (an emptied box reads as 0);
    // the slider or another box moving the share replaces it with the number.
    const [draft, setDraft] = useState<string | null>(null)
    const shown = draft !== null && Number(draft || '0') === value ? draft : String(value)
    return (
        <Field.Root w="72px">
            <Input
                size="xs"
                h="30px"
                borderRadius="hg.pill"
                inputMode="numeric"
                aria-label={`${label} (%)`}
                value={shown}
                onChange={(e) => {
                    const text = e.target.value.replace(/[^0-9]/g, '')
                    setDraft(text)
                    onChange(text === '' ? 0 : Number(text))
                }}
                onBlur={() => setDraft(null)}
            />
        </Field.Root>
    )
}

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
        <VStack
            align="stretch"
            gap="12px"
            css={{
                '--fee-split-burner': HIVE_GLOW_APPS.burner.ink,
                _dark: { '--fee-split-burner': HIVE_GLOW_APPS.burner.onDark },
            }}
        >
            <Slider.Root
                value={handles}
                onValueChange={(details) => setHandles(details.value)}
                min={0}
                max={100}
                step={1}
            >
                <Slider.Control>
                    <Slider.Track style={{ background: trackGradient }} height="8px" borderRadius="hg.pill" />
                    <Slider.Thumb index={0} bg="fg" borderColor="hg.ground" borderWidth="2px">
                        <Slider.HiddenInput />
                    </Slider.Thumb>
                    <Slider.Thumb index={1} bg="fg" borderColor="hg.ground" borderWidth="2px">
                        <Slider.HiddenInput />
                    </Slider.Thumb>
                </Slider.Control>
            </Slider.Root>

            <HStack gap="12px 20px" flexWrap="wrap">
                {SEGMENTS.map(segment => (
                    <HStack key={segment.key} gap="8px" align="center">
                        <Box boxSize="10px" borderRadius="full" flexShrink={0} style={{ background: segment.cssVar }} />
                        <Text fontSize="13px" fontWeight="600">{segment.label}</Text>
                        <ShareInput
                            label={segment.label}
                            value={value[segment.key]}
                            onChange={(pct) => onChange(setFeeShare(value, segment.key, pct))}
                        />
                        <Text fontSize="13px" color="fg.muted">%</Text>
                    </HStack>
                ))}
            </HStack>
        </VStack>
    )
}
