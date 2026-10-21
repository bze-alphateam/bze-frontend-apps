import BigNumber from 'bignumber.js'
import { DenomReward, uAmountToBigNumberAmount } from '@bze/bze-ui-kit'
import { filterHolderRows, sortHolderRows } from '@/lib/rewards-directory'

export const REACH_PATH = '/reach'

/** A token whose stakers "Reach another community" can gift to. */
export interface CommunityOption {
    denom: string;
    ticker: string;
    name?: string;
    logo?: string;
    /** `staked_amount` in display units. */
    stakedDisplay: BigNumber;
    /** One of the connected wallet's own factory tokens. */
    isMine: boolean;
}

interface AssetInfo {
    ticker: string;
    name?: string;
    logo?: string;
    decimals?: number;
}

/**
 * The communities to offer: compounded reward with stakers only (an airdrop without stakers fails
 * with 5018 and a daily prize pays nobody), most staked first by USD value when both prices are
 * known, else by display amount. The wallet's own tokens stay in, marked.
 */
export function communityOptions(
    list: ReadonlyArray<DenomReward>,
    info: (denom: string) => AssetInfo | undefined,
    usdPrices: ReadonlyMap<string, BigNumber>,
    address?: string,
): CommunityOption[] {
    const own = address ? `factory/${address}/` : undefined
    const rows = list.map(dr => {
        const asset = info(dr.staking_denom)
        return {
            dr,
            ticker: asset?.ticker ?? dr.staking_denom,
            name: asset?.name,
            logo: asset?.logo,
            stakedDisplay: uAmountToBigNumberAmount(dr.staked_amount, asset?.decimals ?? 0),
            usdPrice: usdPrices.get(dr.staking_denom),
            counts: undefined,
        }
    })
    return sortHolderRows(filterHolderRows(rows, 'stakers'), 'staked').map(row => {
        const r = row as typeof rows[number]
        return {
            denom: r.dr.staking_denom,
            ticker: r.ticker,
            name: r.name,
            logo: r.logo,
            stakedDisplay: r.stakedDisplay,
            isMine: Boolean(own && r.dr.staking_denom.startsWith(own)),
        }
    })
}

/** The options matching a search on ticker, name or denom (case-insensitive). */
export function searchCommunities(options: ReadonlyArray<CommunityOption>, term: string): CommunityOption[] {
    const t = term.trim().toLowerCase()
    if (!t) return [...options]
    return options.filter(o =>
        o.ticker.toLowerCase().includes(t) ||
        (o.name ?? '').toLowerCase().includes(t) ||
        o.denom.toLowerCase().includes(t),
    )
}

/** `/reach`, optionally with the community and the gift preselected. */
export function reachHref(params: { community?: string; gift?: string } = {}): string {
    const q = new URLSearchParams()
    if (params.community) q.set('community', params.community)
    if (params.gift) q.set('gift', params.gift)
    const s = q.toString()
    return s ? `${REACH_PATH}?${s}` : REACH_PATH
}
