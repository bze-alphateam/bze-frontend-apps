'use client'

import { useCallback, useState } from 'react'
import { bze } from '@bze/bzejs'
import type { Metadata } from '@bze/bzejs/cosmos/bank/v1beta1/bank'
import { amountToUAmount, getChainName, useBZETx } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { type TokenWizardForm, useTokenWizard } from '@/components/token-wizard/token-wizard-context'

const { createDenom, mint, setDenomMetadata, changeAdmin } = bze.tokenfactory.MessageComposer.withTypeUrl

/**
 * Default denom-units layout (settles the spec's open question): the base unit
 * is the full factory denom at exponent 0 (aliased by the subdenom), and the
 * display unit is the lowercased symbol at the token's decimals. With 0
 * decimals the base IS the display, so a single unit suffices. Pro-lane extra
 * units slot in between — the chain requires ascending exponent order.
 */
function buildMetadata(form: TokenWizardForm, denom: string): Metadata {
    const displayDenom = form.symbol.toLowerCase()
    const singleUnit = form.decimals === 0
    const extraUnits = form.extraDenomUnits.map(unit => ({
        denom: unit.denom,
        exponent: unit.exponent,
        aliases: [],
    }))
    const denomUnits = (singleUnit
        ? [{ denom, exponent: 0, aliases: [form.subdenom] }, ...extraUnits]
        : [
            { denom, exponent: 0, aliases: form.subdenom === displayDenom ? [] : [form.subdenom] },
            ...extraUnits,
            { denom: displayDenom, exponent: form.decimals, aliases: [] },
        ]
    ).sort((a, b) => a.exponent - b.exponent)

    return {
        description: form.description.trim(),
        denomUnits,
        base: denom,
        display: singleUnit ? denom : displayDenom,
        name: form.name.trim(),
        symbol: form.symbol,
        uri: form.logoUri.trim(),
        uriHash: '',
    }
}

/**
 * The tx layer both lanes hand off to: ONE multi-message transaction, one
 * signature — create denom + mint the initial supply + set bank metadata,
 * plus an atomic admin renounce when the user asked for a fixed supply.
 * On failure useBZETx already toasts the chain error and the wizard state is
 * untouched, so the user can retry without retyping anything.
 */
export function useCreateTokenTx() {
    const { form, markCreated } = useTokenWizard()
    const { address } = useChain(getChainName())
    const { tx } = useBZETx()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const submit = useCallback(async () => {
        if (!address) return

        const denom = `factory/${address}/${form.subdenom}`
        const msgs = [
            createDenom({ creator: address, subdenom: form.subdenom }),
            mint({
                creator: address,
                coins: `${amountToUAmount(form.initialSupply, form.decimals)}${denom}`,
            }),
            setDenomMetadata({ creator: address, metadata: buildMetadata(form, denom) }),
            ...(form.fixedSupply ? [changeAdmin({ creator: address, denom, newAdmin: '' })] : []),
        ]

        setIsSubmitting(true)
        try {
            await tx(msgs, {
                onSuccess: (res) => markCreated(denom, res.txhash),
            })
        } finally {
            setIsSubmitting(false)
        }
    }, [address, form, tx, markCreated])

    return { submit, isSubmitting }
}
