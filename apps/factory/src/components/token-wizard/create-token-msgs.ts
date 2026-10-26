import { bze } from '@bze/bzejs'
import type { Metadata } from '@bze/bzejs/cosmos/bank/v1beta1/bank'
import { amountToUAmount } from '@bze/bze-ui-kit'
import type { TokenForm } from '@/lib/token-draft'
import { TOKEN_DECIMALS, suggestSubdenom } from '@/components/token-wizard/validation'

const { changeAdmin, createDenom, mint, setDenomMetadata } = bze.tokenfactory.MessageComposer.withTypeUrl

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

/** The new token's denom: `factory/<creator>/u<symbol>`. */
export function createdDenom(creator: string, symbol: string): string {
    return `factory/${creator}/${suggestSubdenom(symbol)}`
}

/**
 * The creation tx: ONE multi-message transaction, one signature: create denom + mint the
 * initial supply to the creator + set bank metadata. With another admin picked, a 4th message
 * hands the admin over in the same tx (the keeper reads the authority at execution time, so it
 * is valid right after MsgCreateDenom). Renouncing admin is never part of creation.
 */
export function createTokenMsgs(form: TokenForm, creator: string) {
    const subdenom = suggestSubdenom(form.symbol)
    const denom = createdDenom(creator, form.symbol)
    const msgs = [
        createDenom({ creator, subdenom }),
        mint({
            creator,
            coins: `${amountToUAmount(form.initialSupply, TOKEN_DECIMALS)}${denom}`,
        }),
        setDenomMetadata({ creator, metadata: buildMetadata(form, subdenom, denom) }),
    ]
    if (form.adminChoice === 'other') {
        return [...msgs, changeAdmin({ creator, denom, newAdmin: form.adminAddress.trim() })]
    }
    return msgs
}
