"use client"

import React from 'react'
import { Box, HStack, Link, Text, chakra } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { Shimmer } from '@bze/bze-ui-kit'
import type { SetupChip } from '@/lib/token-setup'

const MARKS: Record<SetupChip['state'], string> = { done: '✓', todo: '○', unknown: '?', impossible: '–' }

// Done reads green, to do gold, the rest quiet (canvas D2).
const TONES: Record<SetupChip['state'], Record<string, string>> = {
    done: { color: 'hg.success.text', bg: 'hg.success/10', borderColor: 'hg.success/30' },
    todo: { color: 'hg.link', bg: 'transparent', borderColor: 'app.border' },
    unknown: { color: 'fg.muted', bg: 'transparent', borderColor: 'hg.lineStrong' },
    impossible: { color: 'hg.text.faint', bg: 'hg.inset', borderColor: 'hg.divider' },
}

/**
 * "Getting there · 3 of 5": one chip per setup item, each a link to the section with its action.
 * The row scrolls sideways on its own on phones; the page never does.
 */
export function SetupChips({ chips, doneCount, totalCount, isLoading, hasError, onRetry }: {
    chips: SetupChip[];
    doneCount: number;
    totalCount: number;
    isLoading: boolean;
    hasError: boolean;
    onRetry: () => void;
}) {
    const allDone = totalCount > 0 && doneCount === totalCount

    return (
        <Box as="section" aria-label="Setup" data-testid="setup-chips">
            <HStack gap="10px" mb="10px" flexWrap="wrap">
                <Text fontSize="14px" fontWeight="700" data-testid="setup-progress">
                    {isLoading ? 'Checking the setup…' : `${allDone ? 'All set' : 'Getting there'} · ${doneCount} of ${totalCount}`}
                </Text>
                {!isLoading && hasError && (
                    <chakra.button
                        type="button"
                        fontSize="13px"
                        fontWeight="600"
                        color="hg.link"
                        display="inline-flex"
                        alignItems="center"
                        gap="4px"
                        onClick={onRetry}
                    >
                        <LuRefreshCw size={12} /> Retry
                    </chakra.button>
                )}
            </HStack>
            {isLoading ? (
                <HStack gap="8px" aria-busy="true">
                    {[0, 1, 2, 3, 4].map(i => <Shimmer key={i} h="32px" w="96px" borderRadius="hg.pill" />)}
                </HStack>
            ) : (
                <HStack as="ul" listStyleType="none" gap="8px" overflowX="auto" pb="4px" css={{ scrollbarWidth: 'thin' }}>
                    {chips.map(chip => (
                        <Box as="li" key={chip.key} flexShrink={0}>
                            <Link
                                href={`#${chip.section}`}
                                display="inline-flex"
                                alignItems="center"
                                gap="6px"
                                h="32px"
                                px="12px"
                                borderRadius="hg.pill"
                                borderWidth="1px"
                                fontSize="13px"
                                fontWeight="600"
                                whiteSpace="nowrap"
                                textDecoration="none"
                                _hover={{ textDecoration: 'none', bg: 'app.subtle' }}
                                data-testid={`setup-chip-${chip.key}`}
                                data-state={chip.state}
                                {...TONES[chip.state]}
                            >
                                <span aria-hidden>{MARKS[chip.state]}</span>
                                {chip.label}
                                {chip.note && <Text as="span" fontWeight="500" color="fg.muted">{`· ${chip.note}`}</Text>}
                            </Link>
                        </Box>
                    ))}
                </HStack>
            )}
        </Box>
    )
}
