import type { Metadata, MetadataSDKType } from '@bze/bzejs/cosmos/bank/v1beta1/bank'
import type { Asset } from '@bze/bze-ui-kit'

/** The two metadata fields the admin can change. */
export interface MetadataForm {
    name: string
    description: string
}

export interface MetadataChange {
    label: string
    oldValue: string
    newValue: string
}

/**
 * MsgSetDenomMetadata replaces the whole metadata object, so we rebuild it
 * from what's on-chain and swap only the editable fields. Symbol, base,
 * display, the denom units, and the URI are carried over untouched — they're
 * not editable here. Tokens that somehow have no metadata yet get the wizard's
 * canonical layout: base denom at exponent 0 + display unit at the asset's
 * decimals.
 */
export function buildUpdatedMetadata(current: MetadataSDKType | undefined, asset: Asset, form: MetadataForm): Metadata {
    const shared = {
        name: form.name.trim(),
        description: form.description.trim(),
    }

    if (current && current.base) {
        return {
            ...shared,
            denomUnits: current.denom_units.map(u => ({
                denom: u.denom,
                exponent: u.exponent,
                aliases: u.aliases,
            })),
            base: current.base,
            display: current.display,
            symbol: current.symbol,
            uri: current.uri,
            uriHash: current.uri_hash,
        }
    }

    const subdenom = asset.denom.split('/')[2] ?? asset.denom
    const displayDenom = asset.ticker.toLowerCase()
    return {
        ...shared,
        denomUnits: [
            { denom: asset.denom, exponent: 0, aliases: [subdenom] },
            { denom: displayDenom, exponent: asset.decimals, aliases: [] },
        ],
        base: asset.denom,
        display: displayDenom,
        symbol: asset.ticker,
        uri: '',
        uriHash: '',
    }
}

/** The changed fields, old → new, in form order (trimmed like the message). */
export function metadataChanges(current: MetadataForm, form: MetadataForm): MetadataChange[] {
    const diff: MetadataChange[] = []
    if (form.name.trim() !== current.name) diff.push({ label: 'Name', oldValue: current.name, newValue: form.name.trim() })
    if (form.description.trim() !== current.description) {
        diff.push({ label: 'Description', oldValue: current.description, newValue: form.description.trim() })
    }
    return diff
}
