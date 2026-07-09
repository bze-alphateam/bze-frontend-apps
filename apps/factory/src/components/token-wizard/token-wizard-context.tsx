"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type TokenWizardLane = 'fast' | 'pro'

export interface WizardStep {
    key: string;
    title: string;
}

// Step lists per lane (spec: M1 — Create Token, both lanes). Content for each
// step ships in BZE-14 (Fast Track), BZE-15 (review/submit), BZE-16 (Pro).
export const FAST_TRACK_STEPS: WizardStep[] = [
    { key: 'identity', title: 'Identity' },
    { key: 'supply', title: 'Supply' },
    { key: 'review', title: 'Review & Create' },
]

export const PRO_STEPS: WizardStep[] = [
    { key: 'identity', title: 'Identity' },
    { key: 'metadata', title: 'Metadata' },
    { key: 'supply', title: 'Supply & Admin' },
    { key: 'review', title: 'Review & Create' },
]

/** An additional denom unit between the base (exponent 0) and display (exponent = decimals). */
export interface ExtraDenomUnit {
    denom: string;
    exponent: number;
}

/**
 * Everything the wizard collects across both lanes. Fast Track uses a subset;
 * Pro fills in the extra metadata/admin fields.
 */
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
    extraDenomUnits: ExtraDenomUnit[];
}

const EMPTY_FORM: TokenWizardForm = {
    name: '',
    symbol: '',
    subdenom: '',
    initialSupply: '',
    fixedSupply: false,
    description: '',
    logoUri: '',
    extraDenomUnits: [],
}

export interface CreatedToken {
    denom: string;
    txHash: string;
}

interface TokenWizardContextType {
    /** Undefined until the user picks a lane — the lane chooser is showing. */
    lane?: TokenWizardLane;
    /** Steps for the current lane (Fast Track steps while no lane is picked). */
    steps: WizardStep[];
    stepIndex: number;
    form: TokenWizardForm;
    /** Set once the creation tx lands on-chain — switches the wizard to the success screen. */
    created?: CreatedToken;
    setLane: (lane: TokenWizardLane) => void;
    updateForm: (patch: Partial<TokenWizardForm>) => void;
    goNext: () => void;
    /** From the first step, back returns to the lane chooser. */
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
    const [lane, setLaneState] = useState<TokenWizardLane | undefined>(undefined)
    const [stepIndex, setStepIndex] = useState(0)
    const [form, setForm] = useState<TokenWizardForm>(EMPTY_FORM)
    const [created, setCreated] = useState<CreatedToken | undefined>(undefined)

    const steps = lane === 'pro' ? PRO_STEPS : FAST_TRACK_STEPS

    const setLane = useCallback((next: TokenWizardLane) => {
        setLaneState(next)
        setStepIndex(0)
    }, [])

    const updateForm = useCallback((patch: Partial<TokenWizardForm>) => {
        setForm(prev => ({ ...prev, ...patch }))
    }, [])

    const goNext = useCallback(() => {
        setStepIndex(prev => Math.min(prev + 1, steps.length - 1))
    }, [steps.length])

    const goBack = useCallback(() => {
        setStepIndex(prev => {
            if (prev === 0) {
                setLaneState(undefined)
                return 0
            }
            return prev - 1
        })
    }, [])

    const markCreated = useCallback((denom: string, txHash: string) => {
        setCreated({ denom, txHash })
    }, [])

    const reset = useCallback(() => {
        setLaneState(undefined)
        setStepIndex(0)
        setForm(EMPTY_FORM)
        setCreated(undefined)
    }, [])

    const value = useMemo(
        () => ({ lane, steps, stepIndex, form, created, setLane, updateForm, goNext, goBack, markCreated, reset }),
        [lane, steps, stepIndex, form, created, setLane, updateForm, goNext, goBack, markCreated, reset]
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
