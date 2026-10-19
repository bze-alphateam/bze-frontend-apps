"use client"

import React from 'react'
import { Box, chakra, VStack } from '@chakra-ui/react'
import { TechTag } from './tech-tag'

interface OutcomePanelProps {
    /** The outcome in plain words, updated live as questions are answered. */
    children: React.ReactNode;
    techTag?: React.ReactNode;
}

/** "What will happen": the result of the form in plain words, on the app tint. */
export function OutcomePanel({ children, techTag }: OutcomePanelProps) {
    return (
        <VStack
            as="section"
            aria-label="What will happen"
            align="stretch"
            gap="10px"
            p="18px"
            borderRadius="hg.lg"
            borderWidth="1px"
            borderColor="app.muted"
            bg="app.subtle"
        >
            <chakra.h3 m="0" fontSize="14px" fontWeight="700" color="hg.link">What will happen</chakra.h3>
            <Box fontSize="14px" lineHeight="1.55">{children}</Box>
            {techTag && <TechTag>{techTag}</TechTag>}
        </VStack>
    )
}
