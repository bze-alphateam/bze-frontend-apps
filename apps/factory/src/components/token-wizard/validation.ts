import { validateBZEBech32Address } from '@bze/bze-ui-kit'

// Chain rules verified against x/tokenfactory (2026-07-07): subdenom ≤ 44 chars,
// no `_` or `/`. Name/symbol limits are UX choices for sane wallet/explorer display,
// except the symbol minimum: the lowercased symbol becomes the bank metadata's
// display denom, which must pass sdk.ValidateDenom (3–128 chars) — verified
// 2026-09-09, a 2-char symbol makes the whole creation tx fail. From bze v8.3.0
// (BZE-215) the subdenom itself must also pass sdk.ValidateDenom: a letter first
// and at least 3 characters.
export const MIN_NAME_LENGTH = 2
export const MAX_NAME_LENGTH = 64
export const MIN_SYMBOL_LENGTH = 3
export const MAX_SYMBOL_LENGTH = 12
export const MIN_SUBDENOM_LENGTH = 3
export const MAX_SUBDENOM_LENGTH = 44

/**
 * Every factory token uses 6 decimals — the ecosystem standard. The wizard
 * states this instead of offering a field; no other value is ever used.
 */
export const TOKEN_DECIMALS = 6

/**
 * The subdenom is always derived from the symbol, following the ecosystem's
 * micro-unit convention (ubze, uvdl, ...): "u" + lowercased symbol. The "u"
 * prefix makes it start with a letter, and any symbol validateSymbol accepts
 * yields at least MIN_SUBDENOM_LENGTH characters, so validateSubdenom accepts it.
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
    if (!symbol) return 'Ticker is required.'
    if (symbol.length < MIN_SYMBOL_LENGTH) return `Ticker must be at least ${MIN_SYMBOL_LENGTH} characters.`
    if (symbol.length > MAX_SYMBOL_LENGTH) return `Ticker must be at most ${MAX_SYMBOL_LENGTH} characters.`
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(symbol)) {
        return 'Ticker must start with a letter and contain only letters and digits.'
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
    if (subdenom.length < MIN_SUBDENOM_LENGTH) {
        return `Subdenom must be at least ${MIN_SUBDENOM_LENGTH} characters.`
    }
    if (!/^[A-Za-z]/.test(subdenom)) return 'Subdenom must start with a letter.'
    return ''
}

export const MAX_DESCRIPTION_LENGTH = 512

export function validateDescription(description: string): string {
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        return `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`
    }
    return ''
}

/** Generic token amount check — also used by the manage flows (mint/burn). */
export function validateAmount(amount: string, decimals: number): string {
    const trimmed = amount.trim()
    if (!trimmed) return 'Amount is required.'
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'Enter a valid positive number.'
    if (!/[1-9]/.test(trimmed)) return 'Amount must be greater than zero.'
    const fraction = trimmed.split('.')[1]
    if (fraction && fraction.length > decimals) {
        return `At most ${decimals} decimal places (the token's decimals).`
    }
    return ''
}

/**
 * The admin picked in the Permissions step when it isn't the creator. `own` is the connected
 * address: choosing it here would only repeat the "My wallet" choice.
 */
export function validateAdminAddress(address: string, own: string | undefined): string {
    const trimmed = address.trim()
    if (!trimmed) return 'Enter the address that becomes the admin.'
    const result = validateBZEBech32Address(trimmed)
    if (!result.isValid) return result.message
    if (own && trimmed === own) return "That's your own wallet. Pick My wallet instead."
    return ''
}

export function validateInitialSupply(supply: string, decimals: number): string {
    const error = validateAmount(supply, decimals)
    return error ? error.replace('Amount', 'Initial supply') : ''
}
