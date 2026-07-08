// Chain rules verified against x/tokenfactory (2026-07-07): subdenom ≤ 44 chars,
// no `_` or `/`. Name/symbol limits are UX choices for sane wallet/explorer display.
export const MIN_NAME_LENGTH = 2
export const MAX_NAME_LENGTH = 64
export const MIN_SYMBOL_LENGTH = 2
export const MAX_SYMBOL_LENGTH = 12
export const MAX_SUBDENOM_LENGTH = 44
export const MAX_DECIMALS = 18

/**
 * Suggest a subdenom from the symbol, following the ecosystem's micro-unit
 * convention (ubze, uvdl, ...): "u" + lowercased symbol, invalid chars stripped.
 */
export function suggestSubdenom(symbol: string): string {
    const sanitized = symbol.toLowerCase().replace(/[^a-z0-9.-]/g, '')
    return sanitized ? `u${sanitized}` : ''
}

// All validators return an error message, or '' when the value is valid.

export function validateName(name: string): string {
    const trimmed = name.trim()
    if (!trimmed) return 'Name is required.'
    if (trimmed.length < MIN_NAME_LENGTH) return `Name must be at least ${MIN_NAME_LENGTH} characters.`
    if (trimmed.length > MAX_NAME_LENGTH) return `Name must be at most ${MAX_NAME_LENGTH} characters.`
    return ''
}

export function validateSymbol(symbol: string): string {
    if (!symbol) return 'Symbol is required.'
    if (symbol.length < MIN_SYMBOL_LENGTH) return `Symbol must be at least ${MIN_SYMBOL_LENGTH} characters.`
    if (symbol.length > MAX_SYMBOL_LENGTH) return `Symbol must be at most ${MAX_SYMBOL_LENGTH} characters.`
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(symbol)) {
        return 'Symbol must start with a letter and contain only letters and digits.'
    }
    return ''
}

export function validateSubdenom(subdenom: string): string {
    if (!subdenom) return 'Subdenom is required.'
    if (subdenom.length > MAX_SUBDENOM_LENGTH) {
        return `Subdenom must be at most ${MAX_SUBDENOM_LENGTH} characters.`
    }
    if (subdenom.includes('_') || subdenom.includes('/')) {
        return 'Subdenom cannot contain "_" or "/".'
    }
    if (!/^[A-Za-z0-9.-]+$/.test(subdenom)) {
        return 'Subdenom can only contain letters, digits, dots, and dashes.'
    }
    return ''
}

export function validateDecimals(decimals: number): string {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
        return `Decimals must be a whole number between 0 and ${MAX_DECIMALS}.`
    }
    return ''
}

export const MAX_DESCRIPTION_LENGTH = 512

export function validateDescription(description: string): string {
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`
    }
    return ''
}

export function validateUri(uri: string): string {
    const trimmed = uri.trim()
    if (!trimmed) return ''
    try {
        const parsed = new URL(trimmed)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return 'The URI must start with https:// (or http://).'
        }
    } catch {
        return 'Enter a valid URL, e.g. https://mytoken.com/info.json.'
    }
    return ''
}

/**
 * Validate one extra denom unit against the reserved units (base at exponent 0,
 * display at `decimals`) and its sibling rows. Returns '' when valid.
 */
export function validateExtraDenomUnit(
    unit: { denom: string; exponent: number },
    index: number,
    units: { denom: string; exponent: number }[],
    decimals: number,
    reservedDenoms: string[],
): string {
    const denomError = validateSubdenom(unit.denom)
    if (denomError) return denomError.replace('Subdenom', 'Unit name')
    if (!Number.isInteger(unit.exponent) || unit.exponent < 1 || unit.exponent > MAX_DECIMALS) {
        return `Exponent must be a whole number between 1 and ${MAX_DECIMALS}.`
    }
    if (unit.exponent === decimals) {
        return `Exponent ${decimals} is taken by the display unit (your symbol).`
    }
    if (reservedDenoms.includes(unit.denom)) {
        return 'This unit name is already used by the base or display unit.'
    }
    const clash = units.findIndex((other, otherIndex) =>
        otherIndex !== index && (other.denom === unit.denom || other.exponent === unit.exponent)
    )
    if (clash !== -1) {
        return 'Each unit needs a unique name and a unique exponent.'
    }
    return ''
}

export function validateInitialSupply(supply: string, decimals: number): string {
    const trimmed = supply.trim()
    if (!trimmed) return 'Initial supply is required.'
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'Enter a valid positive number.'
    if (!/[1-9]/.test(trimmed)) return 'Initial supply must be greater than zero.'
    const fraction = trimmed.split('.')[1]
    if (fraction && fraction.length > decimals) {
        return decimals === 0
            ? 'This token has 0 decimals — the supply must be a whole number.'
            : `At most ${decimals} decimal places (your token's decimals).`
    }
    return ''
}
