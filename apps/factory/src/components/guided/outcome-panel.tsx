"use client"

import React from 'react'
import { Box, Text, VStack } from '@chakra-ui/react'
import { TechTag } from './tech-tag'

interface OutcomePanelProps {
    /** The outcome in plain words, updated live as questions are answered. */
    children: React.ReactNode;
    techTag?: React.ReactNode;
}

/** "What will happen": the result of the form in plain words. */
export function OutcomePanel({ children, techTag }: OutcomePanelProps) {
    return (
        <Box
            as="section"
            aria-label="What will happen"
            p={4}
            borderRadius="xl"
            borderWidth="1px"
            borderColor="yellow.500/30"
            bg="yellow.500/8"
        >
            <VStack align="stretch" gap={2}>
                <Text fontSize="sm" fontWeight="semibold" color="yellow.fg">What will happen</Text>
                <Box fontSize="sm">{children}</Box>
                {techTag && <TechTag>{techTag}</TechTag>}
            </VStack>
        </Box>
    )
}
