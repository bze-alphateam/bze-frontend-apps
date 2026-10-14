"use client"

import React from 'react'
import { Box, Card, Text, VStack } from '@chakra-ui/react'

export function StatBox({ label, value, hint, minW = '40' }: {
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    minW?: string;
}) {
    return (
        <Card.Root variant="outline" p="4" flex="1" minW={minW}>
            <VStack align="start" gap="1">
                <Text fontSize="xs" color="fg.muted">
                    {label}
                </Text>
                <Box fontSize="sm" fontWeight="semibold" wordBreak="break-all">
                    {value}
                </Box>
                {hint && (
                    <Text fontSize="xs" color="fg.muted">
                        {hint}
                    </Text>
                )}
            </VStack>
        </Card.Root>
    )
}
