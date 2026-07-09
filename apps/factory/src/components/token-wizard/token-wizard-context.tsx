"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export interface WizardStep {
    key: string;
    title: string;
}

// One wizard for everyone (user decision 2026-07-09: the Fast/Pro lane split
// added no real difference once decimals/subdenom/denom-units were fixed).
export const TOKEN_WIZARD_STEPS: WizardStep[] = [
    { key: 'identity', title: 'Identity' },
    { key: 'metadata', title: 'Metadata' },
    { key: 'supply', title: 'Supply & Admin' },
    { key: 'review', title: 'Review & Create' },
]

/** Everything the wizard collects. */
export interface TokenWizardForm {
    // Identity
    name: string;
    symbol: string;
    /** Always derived from the symbol ("u" + lowercase) — never edited directly. */
    subdenom: string;
    // Supply
    initialSupply: string;
    /** Renounce admin right after mint → guaranteed fixed supply from block one. */
    fixedSupply: boolean;
    // Pro metadata
    description: string;
    /** Bank metadata `uri` — link to the token's info page / logo document. */
    logoUri: string;
}

const EMPTY_FORM: TokenWizardForm = {
    name: '',
    symbol: '',
    subdenom: '',
    initialSupply: '',
    fixedSupply: false,
    description: '',
    logoUri: '',
}

export interface CreatedToken {
    denom: string;
    txHash: string;
}

interface TokenWizardContextType {
    steps: WizardStep[];
    stepIndex: number;
    form: TokenWizardForm;
    /** Set once the creation tx lands on-chain — switches the wizard to the success screen. */
    created?: CreatedToken;
    updateForm: (patch: Partial<TokenWizardForm>) => void;
    goNext: () => void;
    /** No-op on the first step — the wizard page handles leaving to the hub. */
    goBack: () => void;
    markCreated: (denom: string, txHash: string) => void;
    reset: () => void;
}

const TokenWizardContext = createContext<TokenWizardContextType | undefined>(undefined)

/**
 * Holds the wizard state at the page level so it survives step navigation and
 * overlays (e.g. opening the Settings drawer from a FeeDisclosure box).
 */
export function TokenWizardProvider({ children }: { children: React.ReactNode }) {
    const [stepIndex, setStepIndex] = useState(0)
    const [form, setForm] = useState<TokenWizardForm>(EMPTY_FORM)
    const [created, setCreated] = useState<CreatedToken | undefined>(undefined)

    const steps = TOKEN_WIZARD_STEPS

    const updateForm = useCallback((patch: Partial<TokenWizardForm>) => {
        setForm(prev => ({ ...prev, ...patch }))
    }, [])

    const goNext = useCallback(() => {
        setStepIndex(prev => Math.min(prev + 1, steps.length - 1))
    }, [steps.length])

    const goBack = useCallback(() => {
        setStepIndex(prev => Math.max(prev - 1, 0))
    }, [])

    const markCreated = useCallback((denom: string, txHash: string) => {
        setCreated({ denom, txHash })
    }, [])

    const reset = useCallback(() => {
        setStepIndex(0)
        setForm(EMPTY_FORM)
        setCreated(undefined)
    }, [])

    const value = useMemo(
        () => ({ steps, stepIndex, form, created, updateForm, goNext, goBack, markCreated, reset }),
        [steps, stepIndex, form, created, updateForm, goNext, goBack, markCreated, reset]
    )

    return <TokenWizardContext.Provider value={value}>{children}</TokenWizardContext.Provider>
}

export function useTokenWizard(): TokenWizardContextType {
    const ctx = useContext(TokenWizardContext)
    if (!ctx) {
        throw new Error('useTokenWizard must be used within a TokenWizardProvider')
    }
    return ctx
}
