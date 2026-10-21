// The token workspace (`/tokens/token?denom=…&tab=…`, BFE-146; moved from /tokens/token in BFE-260): its tabs, links into them,
// and the admin state every tab branches on.

export const WORKSPACE_TABS = ['overview', 'supply', 'profile', 'trading', 'rewards', 'control'] as const

export type WorkspaceTab = typeof WORKSPACE_TABS[number]

export const WORKSPACE_PATH = '/tokens/token'

/** `?tab=` value → tab; missing or unknown values open the Overview. */
export function parseWorkspaceTab(value: string | null | undefined): WorkspaceTab {
    return WORKSPACE_TABS.find(tab => tab === value) ?? 'overview'
}

/** Link to one tab of a token's workspace. */
export function workspaceHref(denom: string, tab: WorkspaceTab = 'overview'): string {
    return `${WORKSPACE_PATH}?denom=${encodeURIComponent(denom)}&tab=${tab}`
}

/** True when `href` points into the workspace, so following it only switches the tab. */
export function isWorkspaceHref(href: string): boolean {
    return href.startsWith(`${WORKSPACE_PATH}?`)
}

/**
 * Who controls the token, from the admin lookup of useMyTokens: an address, '' when renounced,
 * undefined when the lookup failed (never shown as renounced).
 */
export type AdminState = 'admin' | 'not-admin' | 'renounced' | 'unknown'

export function adminState(admin: string | undefined, address: string | undefined): AdminState {
    if (admin === undefined) return 'unknown'
    if (admin === '') return 'renounced'
    return address && admin === address ? 'admin' : 'not-admin'
}
