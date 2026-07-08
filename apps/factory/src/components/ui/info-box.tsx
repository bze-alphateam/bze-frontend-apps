"use client"

import React from 'react'
import { Box, HStack, VStack } from '@chakra-ui/react'
import { LuInfo } from 'react-icons/lu'

interface InfoBoxProps {
    title?: string;
    children: React.ReactNode;
}

// Info-box pattern from the spec's Fee UX principles: short inline explanations for
// non-obvious concepts (escrow, admin renounce, canonical pair ordering, LP tokens).
export function InfoBox({ title, children }: InfoBoxProps) {
    return (
        <Box
            p={3}
            borderRadius="lg"
            bg="blue.500/10"
            borderWidth="1px"
            borderColor="blue.500/25"
        >
            <HStack align="start" gap={2.5}>
                <Box color="blue.500" mt={0.5} flexShrink={0}>
                    <LuInfo size={16} />
                </Box>
                <VStack align="start" gap={0.5}>
                    {title && (
                        <Box fontSize="sm" fontWeight="semibold">
                            {title}
                        </Box>
                    )}
                    <Box fontSize="sm" color="fg.muted">
                        {children}
                    </Box>
                </VStack>
            </HStack>
        </Box>
    )
}
