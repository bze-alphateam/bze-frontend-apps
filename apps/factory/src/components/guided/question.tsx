"use client"

import React, { useId } from 'react'
import { Box, Button, Circle, HStack, Text, VStack } from '@chakra-ui/react'
import { LuCheck } from 'react-icons/lu'
import type { StepState } from './use-guided-steps'

interface QuestionProps {
    number: number;
    title: string;
    state: StepState;
    /** The answer as a sentence, shown once the question is done. */
    summary?: React.ReactNode;
    /** Reopens a done question. */
    onChange?: () => void;
    /** The inputs, rendered only while the question is active. */
    children?: React.ReactNode;
}

/** One numbered question of a guided form: active (inputs), done (a sentence + Change) or todo. */
export function Question({ number, title, state, summary, onChange, children }: QuestionProps) {
    const titleId = useId()

    if (state === 'done') {
        return (
            <Box
                as="section"
                aria-labelledby={titleId}
                data-state="done"
                px={4}
                py={3}
                borderRadius="xl"
                borderWidth="1px"
                borderColor="border"
                bg="bg.panel"
            >
                <HStack gap={3} justify="space-between" align="center">
                    <HStack gap={3} minW={0} align="center">
                        <Circle size="6" bg="green.500" color="white" flexShrink={0}>
                            <LuCheck size={14} />
                        </Circle>
                        <Text fontSize="sm" minW={0}>
                            <Text as="span" id={titleId} color="fg.muted">{title}</Text>{' '}
                            <Text as="span" fontWeight="semibold">{summary}</Text>
                        </Text>
                    </HStack>
                    {onChange && (
                        <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="yellow"
                            flexShrink={0}
                            aria-label={`Change ${title}`}
                            onClick={onChange}
                        >
                            Change
                        </Button>
                    )}
                </HStack>
            </Box>
        )
    }

    const isActive = state === 'active'

    return (
        <Box
            as="section"
            aria-labelledby={titleId}
            data-state={state}
            p={{ base: 4, md: 5 }}
            borderRadius="xl"
            borderWidth={isActive ? '2px' : '1px'}
            borderStyle={isActive ? 'solid' : 'dashed'}
            borderColor={isActive ? 'yellow.500' : 'border'}
            bg={isActive ? 'bg.panel' : 'transparent'}
            opacity={isActive ? 1 : 0.6}
        >
            <VStack align="stretch" gap={isActive ? 4 : 0}>
                <HStack gap={3}>
                    <Circle
                        size="6"
                        flexShrink={0}
                        fontSize="xs"
                        fontWeight="bold"
                        bg={isActive ? 'yellow.500' : 'transparent'}
                        color={isActive ? 'black' : 'fg.muted'}
                        borderWidth={isActive ? 0 : '1px'}
                        borderColor="border"
                    >
                        {number}
                    </Circle>
                    <Text id={titleId} fontWeight="semibold" fontSize={isActive ? 'md' : 'sm'}>
                        {title}
                    </Text>
                </HStack>
                {isActive && children}
            </VStack>
        </Box>
    )
}
