import BigNumber from 'bignumber.js'
import { prettyAmount, truncateAddress, uAmountToBigNumberAmount, type Asset, type DenomReward } from '@bze/bze-ui-kit'

// The Tokens directory (`/tokens?filter=…&q=…&page=…`, BFE-267): every token made with Factory, its URL
// state, search, sort and paging, and the admin badge of the tokens you created. Pure, so the page stays
// a thin view over it.

export const TOKENS_PATH = '/tokens'

export const TOKEN_FILTERS = ['all', 'mine', 'stakable'] as const
export type TokenFilter = typeof TOKEN_FILTERS[number]

/** Rows per page of "All tokens". */
export const TOKENS_PAGE_SIZE = 20

export interface TokensView {
    filter: TokenFilter;
    /** Search text, as typed. */
    q: string;
    /** 1-based page of "All tokens". */
    page: number;
}

export const DEFAULT_TOKENS_VIEW: TokensView = { filter: 'all', q: '', page: 1 }

/** URL query → view; missing or unknown values fall back to the defaults. */
export function parseTokensView(get: (key: string) => string | null | undefined): TokensView {
    const page = Number.parseInt(get('page') ?? '', 10)
    return {
        filter: TOKEN_FILTERS.find(f => f === get('filter')) ?? DEFAULT_TOKENS_VIEW.filter,
        q: get('q') ?? '',
        page: Number.isFinite(page) && page > 1 ? page : 1,
    }
}

/** View → link. The filter is always written; the search and the page only when set. */
export function tokensHref(view: Partial<TokensView> = {}): string {
    const { filter, q, page } = { ...DEFAULT_TOKENS_VIEW, ...view }
    const params = new URLSearchParams({ filter })
    if (q.trim() !== '') params.set('q', q)
    if (page > 1) params.set('page', String(page))
    return `${TOKENS_PATH}?${params.toString()}`
}

/** A token made with Factory: a `factory/…` denom. LP shares (`ulp…`), IBC and native denoms are not. */
export const isFactoryToken = (asset: Pick<Asset, 'denom'>) => asset.denom.startsWith('factory/')

/** Search by name, ticker or denom, ignoring case. An empty search matches everything. */
export function matchesSearch(asset: Pick<Asset, 'name' | 'ticker' | 'denom'>, q: string): boolean {
    const needle = q.trim().toLowerCase()
    if (needle === '') return true
    return [asset.name, asset.ticker, asset.denom].some(v => v.toLowerCase().includes(needle))
}

/** `factory/bze1z3…qwg3l/uhoney`: the creator address shortened, the subdenom kept. */
export function shortFactoryDenom(denom: string): string {
    const [prefix, creator, ...rest] = denom.split('/')
    if (prefix !== 'factory' || !creator || rest.length === 0) return denom
    return `factory/${truncateAddress(creator)}/${rest.join('/')}`
}

/** One directory row: the asset and its compounded reward (denom reward), when it has one. */
export interface TokenRow {
    asset: Asset;
    dr?: DenomReward;
    /** `staked_amount` in display units; 0 without a denom reward. */
    stakedDisplay: BigNumber;
    /** USD price of one display unit; 0 or undefined when unknown. */
    usdPrice?: BigNumber;
}

export function toTokenRow(asset: Asset, dr: DenomReward | undefined, usdPrice: BigNumber | undefined): TokenRow {
    return {
        asset,
        dr,
        stakedDisplay: uAmountToBigNumberAmount(dr?.staked_amount ?? '0', asset.decimals),
        usdPrice,
    }
}

/** What a row says about staking: the denom reward's staked amount, or that there is none yet. No staker counts. */
export function stakeText(row: Pick<TokenRow, 'dr' | 'stakedDisplay'>): string {
    return row.dr ? `Stakable · ${prettyAmount(row.stakedDisplay)} staked` : 'Not stakable yet'
}

const knownPrice = (p?: BigNumber) => p !== undefined && p.gt(0)

/**
 * Most staked first. Display amounts of different tokens aren't comparable (1 BZE ≠ 1 TOK), so two rows
 * whose USD prices are both known compare by staked USD value; otherwise they fall back to the display
 * amount, as on the Rewards directory.
 */
function compareStaked(a: TokenRow, b: TokenRow): number {
    if (knownPrice(a.usdPrice) && knownPrice(b.usdPrice)) {
        return b.stakedDisplay.multipliedBy(b.usdPrice!).comparedTo(a.stakedDisplay.multipliedBy(a.usdPrice!)) ?? 0
    }
    return b.stakedDisplay.comparedTo(a.stakedDisplay) ?? 0
}

const compareName = (a: TokenRow, b: TokenRow) =>
    a.asset.ticker.localeCompare(b.asset.ticker, 'en', { sensitivity: 'base' })
    || a.asset.name.localeCompare(b.asset.name, 'en', { sensitivity: 'base' })
    || a.asset.denom.localeCompare(b.asset.denom)

/** Staked value, then A–Z by ticker. The chain has no creation time, so there is no "newest first". */
export function sortTokenRows<T extends TokenRow>(rows: ReadonlyArray<T>): T[] {
    return [...rows].sort((a, b) => compareStaked(a, b) || compareName(a, b))
}

/** Rows the filter keeps. "Created by you" is its own group, so here it keeps everything. */
export function filterTokenRows<T extends TokenRow>(rows: ReadonlyArray<T>, filter: TokenFilter): T[] {
    return filter === 'stakable' ? rows.filter(r => r.dr !== undefined) : [...rows]
}

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / TOKENS_PAGE_SIZE))

/** The page clamped to the pages that exist, so a stale `?page=` link still shows the last page. */
export const clampPage = (page: number, total: number) => Math.min(Math.max(1, page), pageCount(total))

/**
 * Numbered page links: the first, the last, and the current one with its neighbours; `'…'` marks a gap.
 * 1 2 3 … 8 on page 1, 1 … 4 5 6 … 8 on page 5.
 */
export function pageLinks(current: number, count: number): (number | '…')[] {
    const wanted = new Set([1, count, current - 1, current, current + 1, ...(current <= 3 ? [2, 3] : []), ...(current >= count - 2 ? [count - 1, count - 2] : [])])
    const pages = Array.from(wanted).filter(p => p >= 1 && p <= count).sort((a, b) => a - b)
    const out: (number | '…')[] = []
    pages.forEach((p, i) => {
        if (i > 0 && p - pages[i - 1] > 1) out.push('…')
        out.push(p)
    })
    return out
}

/**
 * The admin badge of a token you created, from useMyTokens: an address, '' when renounced, undefined while
 * loading or when the lookup failed. A failed lookup is never shown as "no admin".
 */
export type AdminBadge =
    | { kind: 'you'; label: string }
    | { kind: 'renounced'; label: string }
    | { kind: 'transferred'; label: string }
    | { kind: 'checking'; label: string }
    | { kind: 'error'; label: string }

export function adminBadge(admin: string | undefined, address: string | undefined, isLoading: boolean): AdminBadge {
    if (admin === undefined) {
        return isLoading ? { kind: 'checking', label: 'Checking admin…' } : { kind: 'error', label: "Couldn't check admin" }
    }
    if (admin === '') return { kind: 'renounced', label: 'Admin given up' }
    if (address && admin === address) return { kind: 'you', label: 'You are admin' }
    return { kind: 'transferred', label: `Admin is ${truncateAddress(admin)}` }
}
