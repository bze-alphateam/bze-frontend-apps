'use client'

import { useMemo } from 'react'
import { getChainName, useAssets } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useTokenWizard } from '@/components/token-wizard/token-wizard-context'
import {
    validateDecimals,
    validateDescription,
    validateExtraDenomUnit,
    validateInitialSupply,
    validateName,
    validateSubdenom,
    validateSymbol,
    validateUri,
} from '@/components/token-wizard/validation'

export interface IdentityErrors {
    name: string;
    symbol: string;
    subdenom: string;
    decimals: string;
}

export interface SupplyErrors {
    initialSupply: string;
}

export interface MetadataErrors {
    description: string;
    uri: string;
    /** One entry per extra denom unit row, '' when the row is valid. */
    unitErrors: string[];
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

    const identityErrors: IdentityErrors = useMemo(() => ({
        name: validateName(form.name),
        symbol: validateSymbol(form.symbol),
        subdenom:
            validateSubdenom(form.subdenom) ||
            (isDuplicateDenom ? 'You already created a token with this subdenom — pick another one.' : ''),
        decimals: validateDecimals(form.decimals),
    }), [form.name, form.symbol, form.subdenom, form.decimals, isDuplicateDenom])

    const supplyErrors: SupplyErrors = useMemo(() => ({
        initialSupply: validateInitialSupply(form.initialSupply, form.decimals),
    }), [form.initialSupply, form.decimals])

    const metadataErrors: MetadataErrors = useMemo(() => {
        // Unit names reserved by buildMetadata: the base denom's alias and the display denom.
        const reservedDenoms = [form.subdenom, form.symbol.toLowerCase()]
        return {
            description: validateDescription(form.description),
            uri: validateUri(form.logoUri),
            unitErrors: form.extraDenomUnits.map((unit, index) =>
                validateExtraDenomUnit(unit, index, form.extraDenomUnits, form.decimals, reservedDenoms)
            ),
        }
    }, [form.description, form.logoUri, form.extraDenomUnits, form.decimals, form.subdenom, form.symbol])

    const isIdentityValid = Object.values(identityErrors).every(e => e === '')
    const isSupplyValid = Object.values(supplyErrors).every(e => e === '')
    const isMetadataValid =
        metadataErrors.description === '' &&
        metadataErrors.uri === '' &&
        metadataErrors.unitErrors.every(e => e === '')

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
