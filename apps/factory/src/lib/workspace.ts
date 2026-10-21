import { truncateAddress } from '@bze/bze-ui-kit'

// The token page (`/tokens/token?denom=…`, BFE-271; the tabbed workspace of BFE-146 before it):
// links to it and its sections, who may open it, and the admin state its actions branch on.

/** The page's action groups, in page order. Each is an anchor (`#supply`) on the page. */
export const TOKEN_SECTIONS = ['supply', 'details', 'trading', 'rewards', 'permissions'] as const

export type TokenSection = typeof TOKEN_SECTIONS[number]

export const WORKSPACE_PATH = '/tokens/token'

/** Link to a token's page, optionally scrolled to one of its sections. */
export function workspaceHref(denom: string, section?: TokenSection): string {
    return `${WORKSPACE_PATH}?denom=${encodeURIComponent(denom)}${section ? `#${section}` : ''}`
}

/** The way back to the token page that wizards opened from it get (`?return=&returnLabel=`). */
export function tokenPageReturn(asset: { denom: string; ticker: string }) {
    return { href: workspaceHref(asset.denom), label: asset.ticker }
}

/** What the page shows for a `?denom=`: the token, "not found", or "only Factory tokens". */
export type TokenPageAccess = 'token' | 'not-found' | 'not-factory'

export function tokenPageAccess(denom: string, asset: { denom: string } | undefined): TokenPageAccess {
    if (!asset) return 'not-found'
    return denom.startsWith('factory/') ? 'token' : 'not-factory'
}

/** The token's creator, from its denom (`factory/{creator}/{subdenom}`); the chain stores no other. */
export function factoryCreator(denom: string): string | undefined {
    const [prefix, creator] = denom.split('/')
    return prefix === 'factory' && creator ? creator : undefined
}

/**
 * Who controls the token, from the live `DenomAuthority` query: an address, '' when renounced,
 * undefined when the lookup failed (never shown as renounced, never as "not admin").
 */
export type AdminState = 'admin' | 'not-admin' | 'renounced' | 'unknown'

export function adminState(admin: string | undefined, address: string | undefined): AdminState {
    if (admin === undefined) return 'unknown'
    if (admin === '') return 'renounced'
    return address && admin === address ? 'admin' : 'not-admin'
}

/**
 * The header's one badge, the first that applies: your own token with its admin state, admin
 * handed to you, or nothing. Undefined while the admin query runs or failed, and for anyone else.
 */
export function ownerBadge(denom: string, admin: string | undefined, address: string | undefined): string | undefined {
    if (!address || admin === undefined) return undefined
    if (factoryCreator(denom) === address) {
        if (admin === address) return 'Created by you · you are admin'
        if (admin === '') return 'Created by you · admin given up'
        return `Created by you · admin is ${truncateAddress(admin)}`
    }
    return admin === address ? 'You are admin' : undefined
}
