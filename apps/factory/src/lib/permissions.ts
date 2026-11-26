import { truncateAddress, validateBZEBech32Address } from '@bze/bze-ui-kit'
import type { AdminState } from '@/lib/workspace'
import { workspaceHref } from '@/lib/workspace'

// The token page's Permissions section (BFE-273): who the admin is, Transfer admin and Renounce admin.
// Both are MsgChangeAdmin: to an address, or to '' (renounced for good). Pure, so the dialogs stay views.

/** The section's one status line, from the live `DenomAuthority` answer. '' while unknown (the section says so itself). */
export function permissionsStatus(state: AdminState, admin: string | undefined, ticker: string): string {
    switch (state) {
        case 'admin':
            return 'Admin: your wallet'
        case 'not-admin':
            return `Admin: ${truncateAddress(admin ?? '')}`
        case 'renounced':
            return 'Admin renounced'
        default:
            return ''
    }
}

/** Why the new admin address can't be used ('' when it can): bech32, and never your own address. */
export function transferAdminError(input: string, address: string | undefined): string {
    const trimmed = input.trim()
    if (!trimmed) return 'Enter the new admin address.'
    const result = validateBZEBech32Address(trimmed)
    if (!result.isValid) return result.message
    if (trimmed === address) return "That's already you."
    return ''
}

/** The Renounce button arms only on the exact ticker, case included. */
export const renounceArmed = (typed: string, ticker: string) => ticker !== '' && typed === ticker

/** What the admin can do: the token form's Admin row and the token page. */
export const ADMIN_POWERS = 'Mint, edit details and change fee settings'

/** What renouncing ends for good. Branding is admin-gated too (`MsgSetDenomBranding`). */
export const goneForever = (ticker: string) => [
    `Minting more ${ticker}: renouncing turns minting off for good`,
    'Editing name, logo and description',
    'Editing the brand kit',
    'Transferring admin',
    'Changing the fee settings',
]

/** What renouncing leaves as it is. */
export const staysTheSame = (ticker: string) => [
    `Everyone keeps their ${ticker}`,
    'Pools, markets and rewards keep running',
    `Anyone can still burn ${ticker} they hold on Burner`,
    'Fee settings stay as they are',
]

/** A setup fact worth a last look before renouncing. `ok` false = it can't be changed afterwards (or, unaffected, is still open). */
export interface RenounceHint {
    key: string;
    text: string;
    ok: boolean;
}

/**
 * The pre-renounce facts, from the token's setup items: the description and the brand kit freeze
 * with the admin; the registry listing is not affected.
 */
export function renounceHints(items: ReadonlyArray<{ key: string; title: string; state: string }>): RenounceHint[] {
    const byKey = new Map(items.map(item => [item.key, item]))
    const hints: RenounceHint[] = []

    const description = byKey.get('description')
    if (description) {
        hints.push(description.state === 'done'
            ? { key: 'description', text: 'Name and description are final.', ok: true }
            : { key: 'description', text: 'Your description is empty. Once you renounce it stays empty.', ok: false })
    }
    const brandKit = byKey.get('brandKit')
    if (brandKit) {
        hints.push(brandKit.state === 'done'
            ? { key: 'brandKit', text: 'Brand kit is set.', ok: true }
            : { key: 'brandKit', text: 'No brand kit yet. Once you renounce nobody can add one.', ok: false })
    }
    const registry = byKey.get('registry')
    if (registry) {
        hints.push({ key: 'registry', text: `${registry.title} (not affected).`, ok: registry.state === 'done' })
    }
    return hints
}

/**
 * Where the pending-tx store files each admin change: the token page, one key per action, so the
 * header's "in progress" pill leads back to the page and the two dialogs never share an entry.
 */
export const adminTxHref = (denom: string, action: 'transfer' | 'renounce' | 'disable-minting') => `${workspaceHref(denom)}&admin=${action}`

/** What turning minting off ends for good (BFE-384): governance cannot undo it either. */
export const mintingGoneForever = (ticker: string) => [
    `Minting more ${ticker}, by anyone, ever`,
    'No vote, not even governance, can turn minting back on',
]

/** What stays when minting is turned off: the admin keeps every other right. */
export const mintingStaysTheSame = (ticker: string) => [
    'You stay the admin',
    'Name, logo and description',
    'Brand kit',
    'Fee settings',
    'Transferring admin',
    `Everyone keeps their ${ticker}`,
    'Pools, markets and rewards keep running',
]

/** The Turn off minting button arms only on the exact ticker, case included. */
export const disableMintingArmed = renounceArmed
