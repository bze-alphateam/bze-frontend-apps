"use client"

import React from 'react'
import { Box } from '@chakra-ui/react'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { IdentityStep } from '@/components/token-wizard/steps/identity-step'
import { MetadataStep } from '@/components/token-wizard/steps/metadata-step'
import { SupplyStep } from '@/components/token-wizard/steps/supply-step'
import { ReviewStep } from '@/components/token-wizard/steps/review-step'
import { SuccessScreen } from '@/components/token-wizard/success-screen'
import {
    TokenWizardProvider,
    useTokenWizard,
} from '@/components/token-wizard/token-wizard-context'
import { useTokenWizardValidation } from '@/components/token-wizard/useTokenWizardValidation'
import { useNavigation } from '@/hooks/useNavigation'

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
    identity: IdentityStep,
    metadata: MetadataStep,
    supply: SupplyStep,
    review: ReviewStep,
}

function TokenWizard() {
    const { steps, stepIndex, goNext, goBack, created } = useTokenWizard()
    const { isStepValid } = useTokenWizardValidation()
    const { navigate } = useNavigation()

    if (created) {
        return <SuccessScreen />
    }

    const step = steps[stepIndex]
    const StepComponent = STEP_COMPONENTS[step.key]

    return (
        <WizardShell
            title="Create Token"
            subtitle="Launch your own token on BeeZee — review everything before anything is signed."
            steps={steps}
            activeStep={stepIndex}
            onBack={stepIndex === 0 ? () => navigate('/') : goBack}
            onNext={goNext}
            canGoNext={isStepValid(step.key)}
            nextLabel={stepIndex === steps.length - 2 ? 'Review' : 'Next'}
            hideNext={step.key === 'review'}
        >
            <StepComponent />
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
