"use client"

import React from 'react'
import { Box, Button, Container, HStack, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuArrowRight, LuCheck } from 'react-icons/lu'
import type { WizardStep } from '@/components/token-wizard/token-wizard-context'

interface WizardShellProps {
    title: string;
    subtitle?: string;
    steps: WizardStep[];
    activeStep: number;
    onBack: () => void;
    onNext: () => void;
    /** Gate the Next button on step validation. Default true. */
    canGoNext?: boolean;
    nextLabel?: string;
    /** Hide the Next button when the step provides its own primary action (e.g. review's confirm). */
    hideNext?: boolean;
    children: React.ReactNode;
}

// Shared wizard chrome for all creation flows: step indicator + content card +
// back/next navigation. State lives with the caller, so it survives navigation.
export function WizardShell({
    title,
    subtitle,
    steps,
    activeStep,
    onBack,
    onNext,
    canGoNext = true,
    nextLabel = 'Next',
    hideNext = false,
    children,
}: WizardShellProps) {
    return (
        <Container maxW="3xl" py={{ base: 6, md: 10 }}>
            <VStack align="stretch" gap={6}>
                <VStack gap={1} align="center">
                    <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                        {title}
                    </Text>
                    {subtitle && (
                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                            {subtitle}
                        </Text>
                    )}
                </VStack>

                {/* Step indicator */}
                <HStack gap={0} justify="center" w="full">
                    {steps.map((step, index) => {
                        const isDone = index < activeStep
                        const isActive = index === activeStep
                        return (
                            <React.Fragment key={step.key}>
                                {index > 0 && (
                                    <Box
                                        flex="1"
                                        maxW="16"
                                        h="2px"
                                        mx={1}
                                        bg={index <= activeStep ? 'yellow.500' : 'border'}
                                        transition="background 0.2s"
                                    />
                                )}
                                <VStack gap={1} flexShrink={0}>
                                    <Box
                                        w="8"
                                        h="8"
                                        borderRadius="full"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        fontSize="sm"
                                        fontWeight="semibold"
                                        bg={isDone || isActive ? 'yellow.500' : 'bg.muted'}
                                        color={isDone || isActive ? 'black' : 'fg.muted'}
                                        borderWidth="1px"
                                        borderColor={isDone || isActive ? 'yellow.500' : 'border'}
                                        transition="all 0.2s"
                                    >
                                        {isDone ? <LuCheck size={16} /> : index + 1}
                                    </Box>
                                    <Text
                                        fontSize="xs"
                                        color={isActive ? 'fg' : 'fg.muted'}
                                        fontWeight={isActive ? 'semibold' : 'normal'}
                                        hideBelow="sm"
                                        whiteSpace="nowrap"
                                    >
                                        {step.title}
                                    </Text>
                                </VStack>
                            </React.Fragment>
                        )
                    })}
                </HStack>
                {/* Mobile: step titles are hidden, show the active one here */}
                <Text fontSize="sm" color="fg.muted" textAlign="center" hideFrom="sm" mt={-4}>
                    Step {activeStep + 1} of {steps.length} — {steps[activeStep]?.title}
                </Text>

                {/* Step content */}
                <Box
                    p={{ base: 4, md: 6 }}
                    bgGradient="to-br"
                    gradientFrom="yellow.500/8"
                    gradientTo="yellow.600/8"
                    borderWidth="1px"
                    borderColor="yellow.500/20"
                    borderRadius="xl"
                    shadow="sm"
                >
                    {children}
                </Box>

                {/* Navigation */}
                <HStack justify="space-between">
                    <Button variant="ghost" colorPalette="yellow" onClick={onBack}>
                        <LuArrowLeft />
                        Back
                    </Button>
                    {!hideNext && (
                        <Button colorPalette="yellow" onClick={onNext} disabled={!canGoNext}>
                            {nextLabel}
                            <LuArrowRight />
                        </Button>
                    )}
                </HStack>
            </VStack>
        </Container>
    )
}
