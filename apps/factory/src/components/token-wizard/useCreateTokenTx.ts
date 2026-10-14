'use client'

import { useCallback, useState } from 'react'
import { bze } from '@bze/bzejs'
import type { Metadata } from '@bze/bzejs/cosmos/bank/v1beta1/bank'
import { amountToUAmount, getChainName } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import type { TokenForm } from '@/lib/token-draft'
import { TOKEN_DECIMALS, suggestSubdenom } from '@/components/token-wizard/validation'

const { createDenom, mint, setDenomMetadata } = bze.tokenfactory.MessageComposer.withTypeUrl

/**
 * Denom-units layout: the base unit is the full factory denom at exponent 0
 * (aliased by the subdenom), the display unit is the lowercased symbol at the
 * fixed TOKEN_DECIMALS. The subdenom ("u" + lowercased symbol) can never
 * collide with the display denom.
 */
function buildMetadata(form: TokenForm, subdenom: string, denom: string): Metadata {
    const displayDenom = form.symbol.toLowerCase()
    const denomUnits = [
        { denom, exponent: 0, aliases: [subdenom] },
        { denom: displayDenom, exponent: TOKEN_DECIMALS, aliases: [] },
    ]

    return {
        description: form.description.trim(),
        denomUnits,
        base: denom,
        display: displayDenom,
        name: form.name.trim(),
        symbol: form.symbol,
        uri: '',
        uriHash: '',
    }
}

/**
 * The creation tx: ONE multi-message transaction, one signature: create denom + mint
 * the initial supply + set bank metadata. The creator stays admin; locking the supply is
 * the last step of a launch, done from the token's Control tab.
 * On failure the tx hook already toasts the chain error and the form is untouched, so
 * the user can retry without retyping anything.
 */
export function useCreateTokenTx(form: TokenForm, onCreated: (denom: string, txHash: string) => void) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const submit = useCallback(async () => {
        if (!address) return

        const subdenom = suggestSubdenom(form.symbol)
        const denom = `factory/${address}/${subdenom}`
        const msgs = [
            createDenom({ creator: address, subdenom }),
            mint({
                creator: address,
                coins: `${amountToUAmount(form.initialSupply, TOKEN_DECIMALS)}${denom}`,
            }),
            setDenomMetadata({ creator: address, metadata: buildMetadata(form, subdenom, denom) }),
        ]

        setIsSubmitting(true)
        try {
            await tx(msgs, {
                onSuccess: (res) => onCreated(denom, res.txhash),
            })
        } finally {
            setIsSubmitting(false)
        }
    }, [address, form, tx, onCreated])

    return { submit, isSubmitting }
}
