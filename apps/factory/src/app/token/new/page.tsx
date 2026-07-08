"use client"

import React from 'react'
import { Box, Button, Container, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft } from 'react-icons/lu'
import { InfoBox } from '@/components/ui/info-box'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { LaneChooser } from '@/components/token-wizard/lane-chooser'
import {
    TokenWizardProvider,
    useTokenWizard,
} from '@/components/token-wizard/token-wizard-context'
import { useNavigation } from '@/hooks/useNavigation'

// Step bodies land in the next stories: BZE-14 (Fast Track), BZE-15 (review &
// submit), BZE-16 (Pro). Until then each step shows this placeholder.
function StepPlaceholder({ title }: { title: string }) {
    return (
        <VStack align="stretch" gap={4} minH="32" justify="center">
            <InfoBox title={`${title} — coming soon`}>
                This step is under construction and ships in the next update. Navigation,
                lanes, and fees are already live — feel free to walk through the flow.
            </InfoBox>
        </VStack>
    )
}

function TokenWizard() {
    const { lane, steps, stepIndex, goNext, goBack } = useTokenWizard()
    const { navigate } = useNavigation()

    if (!lane) {
        return (
            <Container maxW="3xl" py={{ base: 6, md: 10 }}>
                <VStack align="stretch" gap={6}>
                    <VStack gap={2} align="center">
                        <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">
                            Create Token
                        </Text>
                        <Text fontSize="sm" color="fg.muted" textAlign="center" maxW="xl">
                            Launch your own token on BeeZee. Pick how much control you want —
                            you can review everything before anything is signed.
                        </Text>
                    </VStack>
                    <LaneChooser />
                    <Box>
                        <Button variant="ghost" colorPalette="yellow" size="sm" onClick={() => navigate('/')}>
                            <LuArrowLeft />
                            Back to hub
                        </Button>
                    </Box>
                </VStack>
            </Container>
        )
    }

    const step = steps[stepIndex]

    return (
        <WizardShell
            title="Create Token"
            subtitle={lane === 'fast' ? 'Fast Track — 3 quick steps' : 'Pro — full control'}
            steps={steps}
            activeStep={stepIndex}
            onBack={goBack}
            onNext={goNext}
        >
            <StepPlaceholder title={step.title} />
        </WizardShell>
    )
}

export default function TokenNewPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <TokenWizardProvider>
                <TokenWizard />
            </TokenWizardProvider>
        </Box>
    )
}
