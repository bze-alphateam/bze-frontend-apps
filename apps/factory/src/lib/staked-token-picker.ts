import BigNumber from 'bignumber.js'
import { isLpDenom, uAmountToBigNumberAmount, type Asset, type DenomReward } from '@bze/bze-ui-kit'
import { isFactoryToken, matchesSearch } from '@/lib/tokens-directory'

// The staked-token picker (canvas D4, BFE-265): which token's stakers a wizard is about. Pure, so the
// component stays a thin view: the groups, the chips, the order, the paging and the admin lines.

/**
 * `makeStakable`: every token; `hasCompounded`: tokens with a compounded reward; `hasRewards`:
 * tokens with a compounded reward or one of the `stakable` simple-reward tokens.
 */
export type StakedTokenPickerMode = 'makeStakable' | 'hasCompounded' | 'hasRewards'

/** Pool shares only, or everything but them. */
export type PickerOnly = 'lp' | 'tokens'

export const PICKER_CHIPS = ['all', 'mine', 'lp'] as const
export type PickerChip = typeof PICKER_CHIPS[number]

/** Rows of "All tokens" shown per "Show 20 more". */
export const PICKER_PAGE_SIZE = 20

/** The line under a token's name. */
export function tokenKind(asset: Pick<Asset, 'denom' | 'type'>, nativeDenom?: string): string {
    if (isLpDenom(asset.denom)) return 'LP shares'
    if (asset.denom === nativeDenom || asset.type === 'Native') return 'Native token'
    if (isFactoryToken(asset)) return 'Community token'
    return 'IBC token'
}

/**
 * The admin line of a token you created: an address, '' when renounced, undefined while loading or
 * when the lookup failed. Only "you are admin" and "admin given up" are said; anything else says nothing.
 */
export function pickerAdminLine(admin: string | undefined, address: string | undefined, mode: StakedTokenPickerMode): string {
    if (admin === '') return mode === 'makeStakable' ? 'Admin given up · anyone can still make it stakable' : 'Admin given up'
    if (admin !== undefined && address && admin === address) return 'You are admin'
    return ''
}

export interface PickerRow {
    asset: Asset;
    /** The token's compounded reward, when it has one. */
    dr?: DenomReward;
    /** Staked USD value; undefined without a compounded reward or a price. */
    stakedUsd?: BigNumber;
}

export function toPickerRow(asset: Asset, dr: DenomReward | undefined, usdPrice: BigNumber | undefined): PickerRow {
    const priced = dr !== undefined && usdPrice !== undefined && usdPrice.gt(0)
    return {
        asset,
        dr,
        stakedUsd: priced ? uAmountToBigNumberAmount(dr.staked_amount, asset.decimals).multipliedBy(usdPrice) : undefined,
    }
}

const rank = (row: PickerRow) => (row.stakedUsd !== undefined ? 0 : row.dr ? 1 : 2)

const compareName = (a: PickerRow, b: PickerRow) =>
    a.asset.ticker.localeCompare(b.asset.ticker, 'en', { sensitivity: 'base' })
    || a.asset.name.localeCompare(b.asset.name, 'en', { sensitivity: 'base' })
    || a.asset.denom.localeCompare(b.asset.denom)

/**
 * Compounded rewards with a price first, by staked USD value; then those without a price; then the
 * tokens with none. A–Z inside the last two.
 */
export function sortPickerRows<T extends PickerRow>(rows: ReadonlyArray<T>): T[] {
    return [...rows].sort((a, b) =>
        rank(a) - rank(b)
        || (rank(a) === 0 ? (b.stakedUsd!.comparedTo(a.stakedUsd!) ?? 0) : 0)
        || compareName(a, b))
}

export interface PickerFilter {
    mode: StakedTokenPickerMode;
    q: string;
    includeLP: boolean;
    excludeHalted: boolean;
    /** hasRewards: the staked tokens of the simple rewards. */
    stakable?: ReadonlySet<string>;
    only?: PickerOnly;
}

/** Whether a row belongs in the picker at all, before the chips. */
export function keepPickerRow(row: PickerRow, { mode, q, includeLP, excludeHalted, stakable, only }: PickerFilter): boolean {
    const lp = isLpDenom(row.asset.denom)
    if ((!includeLP || only === 'tokens') && lp) return false
    if (only === 'lp' && !lp) return false
    if (excludeHalted && row.asset.halted) return false
    if (mode === 'hasCompounded' && !row.dr) return false
    if (mode === 'hasRewards' && !row.dr && !stakable?.has(row.asset.denom)) return false
    return matchesSearch(row.asset, q)
}

export interface PickerGroups<T extends PickerRow> {
    /** Your factory tokens; empty without a wallet, or when a chip hides them. */
    mine: T[];
    /** Every other token, sorted; the chip may narrow it to pool shares. */
    all: T[];
}

/**
 * The two groups for a chip. "Created by you" leaves "All tokens" to your group; "Pool shares" shows
 * only LP shares, which are never anyone's factory token.
 */
export function pickerGroups<T extends PickerRow>(mine: ReadonlyArray<T>, others: ReadonlyArray<T>, chip: PickerChip, filter: PickerFilter): PickerGroups<T> {
    const myDenoms = new Set(mine.map(r => r.asset.denom))
    const keptMine = sortPickerRows(mine.filter(r => keepPickerRow(r, filter)))
    const keptAll = sortPickerRows(others.filter(r => !myDenoms.has(r.asset.denom) && keepPickerRow(r, filter)))
    if (chip === 'mine') return { mine: keptMine, all: [] }
    if (chip === 'lp') return { mine: [], all: keptAll.filter(r => isLpDenom(r.asset.denom)) }
    return { mine: keptMine, all: keptAll }
}

/** "Show 20 more · 148 tokens". */
export const showMoreLabel = (total: number) => `Show ${PICKER_PAGE_SIZE} more · ${total.toLocaleString('en-US')} tokens`
