"use client"

import React from 'react'
import { Box, Text } from '@chakra-ui/react'
import { HgCard } from '@bze/bze-ui-kit'

export function StatBox({ label, value, hint, minW = '40' }: {
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    minW?: string;
}) {
    return (
        <HgCard px="20px" py="18px" flex="1" minW={minW} display="flex" flexDirection="column" gap="6px">
            <Text fontSize="13px" color="fg.muted">
                {label}
            </Text>
            <Box fontSize="18px" fontWeight="700" color="fg" wordBreak="break-word">
                {value}
            </Box>
            {hint && (
                <Text fontSize="12px" color="hg.text.faint">
                    {hint}
                </Text>
            )}
        </HgCard>
    )
}
