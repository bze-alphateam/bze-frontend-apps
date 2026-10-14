'use client'

import { useMemo } from 'react'
import { getChainName, useAssets } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import type { TokenForm } from '@/lib/token-draft'
import {
    TOKEN_DECIMALS,
    suggestSubdenom,
    validateDescription,
    validateInitialSupply,
    validateName,
    validateSubdenom,
    validateSymbol,
} from '@/components/token-wizard/validation'

export interface TokenFormErrors {
    name: string;
    symbol: string;
    description: string;
    initialSupply: string;
}

/**
 * Single source of truth for the token form's validation: the questions show the field
 * errors, the page gates each question and the Create button on the validity flags.
 */
export function useTokenWizardValidation(form: TokenForm) {
    const { assets } = useAssets()
    const { address } = useChain(getChainName())
    const subdenom = suggestSubdenom(form.symbol)

    // The denom the form will create. Without a connected wallet we can only show a
    // generic preview, and the duplicate check needs the real address.
    const resultingDenom = address && subdenom ? `factory/${address}/${subdenom}` : undefined

    const isDuplicateDenom = useMemo(
        () => Boolean(resultingDenom && (assets ?? []).some(a => a.denom === resultingDenom)),
        [assets, resultingDenom]
    )

    // The subdenom is derived from the symbol, so its problems (invalid chars,
    // duplicates) surface on the symbol field, the only thing the user can change.
    const errors: TokenFormErrors = {
        name: validateName(form.name),
        symbol:
            validateSymbol(form.symbol) ||
            validateSubdenom(subdenom) ||
            (isDuplicateDenom ? 'A token with this symbol already exists in your account — pick another one.' : ''),
        description: validateDescription(form.description),
        initialSupply: validateInitialSupply(form.initialSupply, TOKEN_DECIMALS),
    }

    const isIdentityValid = errors.name === '' && errors.symbol === ''
    const isDescriptionValid = errors.description === ''
    const isSupplyValid = errors.initialSupply === ''

    return {
        errors,
        subdenom,
        resultingDenom,
        isIdentityValid,
        isDescriptionValid,
        isSupplyValid,
        isValid: isIdentityValid && isDescriptionValid && isSupplyValid,
    }
}
