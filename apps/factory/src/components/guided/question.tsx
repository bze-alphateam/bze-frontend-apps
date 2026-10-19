"use client"

import React, { useId } from 'react'
import { Box, chakra, Flex, VStack } from '@chakra-ui/react'
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

const DISC = { flex: 'none', boxSize: '28px', borderRadius: 'full', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const

/**
 * One numbered question of a guided form: active (the featured card with the gradient edge and
 * number disc, inputs inside), done (the answer as a sentence + Change) or todo (a quiet row).
 */
export function Question({ number, title, state, summary, onChange, children }: QuestionProps) {
    const titleId = useId()

    if (state === 'done') {
        return (
            <Flex
                as="section"
                aria-labelledby={titleId}
                data-state="done"
                align="center"
                justify="space-between"
                gap="12px"
                px={{ base: '14px', md: '18px' }}
                py="12px"
                borderRadius="hg.lg"
                bg="hg.inset"
                borderWidth="1px"
                borderColor="hg.divider"
            >
                <Flex align="center" gap="12px" minW={0}>
                    <chakra.span
                        {...DISC}
                        aria-hidden
                        bg="hg.success/16"
                        borderWidth="1px"
                        borderColor="hg.success/45"
                        color="hg.success.text"
                    >
                        <LuCheck size={13} strokeWidth={3} />
                    </chakra.span>
                    <chakra.span fontSize="14px" color="fg.muted" minW={0}>
                        <chakra.span id={titleId}>{title}</chakra.span>{' '}
                        <chakra.strong color="fg" fontWeight="600">{summary}</chakra.strong>
                    </chakra.span>
                </Flex>
                {onChange && (
                    <chakra.button
                        type="button"
                        flex="none"
                        h="28px"
                        px="8px"
                        borderRadius="hg.sm"
                        fontSize="12px"
                        fontWeight="600"
                        color="hg.link"
                        bg="transparent"
                        cursor="pointer"
                        _hover={{ bg: 'app.subtle' }}
                        focusVisibleRing="outside"
                        aria-label={`Change ${title}`}
                        onClick={onChange}
                    >
                        Change
                    </chakra.button>
                )}
            </Flex>
        )
    }

    if (state === 'todo') {
        return (
            <Flex
                as="section"
                aria-labelledby={titleId}
                data-state="todo"
                align="center"
                gap="12px"
                px={{ base: '14px', md: '18px' }}
                py="14px"
                borderRadius="hg.lg"
                bg="hg.card"
                borderWidth="1px"
                borderColor="hg.hairline"
            >
                <chakra.span {...DISC} aria-hidden bg="hg.raised" color="fg.muted" fontSize="13px" fontWeight="700">
                    {number}
                </chakra.span>
                <chakra.span id={titleId} fontSize="15px" fontWeight="600" color="fg.muted">{title}</chakra.span>
            </Flex>
        )
    }

    return (
        <Box
            as="section"
            aria-labelledby={titleId}
            data-state="active"
            p="1px"
            borderRadius="17px"
            bgImage="featuredEdge"
            boxShadow="hg.featured"
        >
            <VStack align="stretch" gap="16px" bg="hg.card" borderRadius="hg.lg" p={{ base: '16px', md: '22px' }}>
                <Flex align="center" gap="12px">
                    <chakra.span {...DISC} aria-hidden bgImage="app" color="hg.buttonText" fontSize="13px" fontWeight="800">
                        {number}
                    </chakra.span>
                    <chakra.h2 id={titleId} m="0" fontSize="17px" fontWeight="700">
                        {title}
                    </chakra.h2>
                </Flex>
                {children}
            </VStack>
        </Box>
    )
}
