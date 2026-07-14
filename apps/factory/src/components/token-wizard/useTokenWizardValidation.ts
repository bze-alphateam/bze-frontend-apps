'use client'

import { useMemo } from 'react'
import { getChainName, useAssets } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import {
    TOKEN_DECIMALS,
    validateDescription,
    validateInitialSupply,
    validateName,
    validateSubdenom,
    validateSymbol,
} from '@/components/token-wizard/validation'

export interface IdentityErrors {
    name: string;
    symbol: string;
}

export interface SupplyErrors {
    initialSupply: string;
}

export interface MetadataErrors {
    description: string;
}

/**
 * Single source of truth for wizard validation: step components use the field
 * errors for inline display, the wizard page uses isStepValid to gate Next.
 */
export function useTokenWizardValidation() {
    const { form } = useTokenWizard()
    const { assets } = useAssets()
    const { address } = useChain(getChainName())

    // The denom this wizard will create. Without a connected wallet we can only
    // show a generic preview — the duplicate check needs the real address.
    const resultingDenom = useMemo(
        () => (address && form.subdenom ? `factory/${address}/${form.subdenom}` : undefined),
        [address, form.subdenom]
    )

    const isDuplicateDenom = useMemo(
        () => Boolean(resultingDenom && (assets ?? []).some(a => a.denom === resultingDenom)),
        [assets, resultingDenom]
    )

    // The subdenom is derived from the symbol, so its problems (invalid chars,
    // duplicates) surface on the symbol field — the only thing the user can change.
    const identityErrors: IdentityErrors = useMemo(() => ({
        name: validateName(form.name),
        symbol:
            validateSymbol(form.symbol) ||
            validateSubdenom(form.subdenom) ||
            (isDuplicateDenom ? 'A token with this symbol already exists in your account — pick another one.' : ''),
    }), [form.name, form.symbol, form.subdenom, isDuplicateDenom])

    const supplyErrors: SupplyErrors = useMemo(() => ({
        initialSupply: validateInitialSupply(form.initialSupply, TOKEN_DECIMALS),
    }), [form.initialSupply])

    const metadataErrors: MetadataErrors = useMemo(() => ({
        description: validateDescription(form.description),
    }), [form.description])

    const isIdentityValid = Object.values(identityErrors).every(e => e === '')
    const isSupplyValid = Object.values(supplyErrors).every(e => e === '')
    const isMetadataValid = Object.values(metadataErrors).every(e => e === '')

    const isStepValid = (stepKey: string): boolean => {
        switch (stepKey) {
            case 'identity':
                return isIdentityValid
            case 'metadata':
                return isMetadataValid
            case 'supply':
                return isSupplyValid
            case 'review':
                return isIdentityValid && isMetadataValid && isSupplyValid
            default:
                return true
        }
    }

    return {
        identityErrors,
        supplyErrors,
        metadataErrors,
        isIdentityValid,
        isSupplyValid,
        isMetadataValid,
        isStepValid,
        resultingDenom,
    }
}
