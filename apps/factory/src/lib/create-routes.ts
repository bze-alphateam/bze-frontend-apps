import { airdropFormHref, denomRewardHref, scheduleFormHref } from '@/lib/denom-reward'
import { rewardsHref } from '@/lib/rewards-directory'

// The Create side of the Factory (BFE-260): the home's starting points, the three Choose
// screens between a starting point and its wizard, and the query each Choose screen hands on.

export const CHOOSE_MARKET_PATH = '/create/market'
export const CHOOSE_REWARDS_PATH = '/create/rewards'
export const CHOOSE_GROW_PATH = '/create/grow'

/** Reads one query value; `URLSearchParams` and Next's `ReadonlyURLSearchParams` both fit. */
export interface QueryReader {
    get(name: string): string | null;
}

/** `path` with the non-empty values of `query`, in the order given. */
function withQuery(path: string, query: Record<string, string | undefined>): string {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value) q.set(key, value)
    }
    const s = q.toString()
    return s ? `${path}?${s}` : path
}

/** /create/rewards, optionally for one staked token. */
export const chooseRewardsHref = ({ denom }: { denom?: string } = {}) => withQuery(CHOOSE_REWARDS_PATH, { denom })

/** Where the two DEX market options go; a pair already picked (`?base=&quote=`) is handed on. */
export function marketTargets(query: QueryReader) {
    const pair = { base: query.get('base') ?? undefined, quote: query.get('quote') ?? undefined }
    return {
        pool: withQuery('/pool/new', pair),
        market: withQuery('/market/new', pair),
    }
}

/**
 * Where the reward options go. The staked token arrives as `?denom=` or `?staking=` (the simple
 * reward form's name for it) and reaches every form in the name that form reads.
 */
export function rewardTargets(query: QueryReader) {
    const staked = query.get('staking') || query.get('denom') || ''
    return {
        simple: withQuery('/reward/new', { staking: staked }),
        // BFE-265 moves creating a compounded reward to /denom-reward/new; until then the token's
        // compounded reward page creates it.
        compounded: staked ? denomRewardHref(staked) : '/denom-reward/token',
        extendSimple: rewardsHref({ tab: 'programs' }),
        dailyPrize: staked ? scheduleFormHref(staked) : '/denom-reward/schedule',
        airdrop: staked ? airdropFormHref(staked) : '/denom-reward/airdrop',
    }
}

export const GROW_TARGETS = {
    airdrop: '/denom-reward/airdrop',
    multisend: '/multisend',
    raffle: '/raffle/new',
    reach: '/reach',
} as const

/** The DEX's pools page: adding and removing liquidity live there (BFE-257 decision 9). */
export const dexPoolsHref = (dexHref: string) => `${dexHref.replace(/\/$/, '')}/pools`

export const DOCS_HREF = 'https://docs.getbze.com'

export interface StartingPoint {
    id: 'token' | 'market' | 'rewards' | 'grow' | 'dao' | 'contest';
    title: string;
    line: string;
    chips: string[];
    /** Without it the tile is "Coming soon" and not a link. */
    href?: string;
    featured?: boolean;
}

/** The six tiles of the home page, in grid order. */
export const STARTING_POINTS: StartingPoint[] = [
    { id: 'token', title: 'Create a token', line: 'Name, ticker, logo and supply. Minted to your wallet.', chips: ['Token'], href: '/token/new', featured: true },
    { id: 'market', title: 'Create a DEX market', line: 'Let people swap a pair instantly, or trade it with limit orders.', chips: ['Liquidity pool', 'Order book'], href: CHOOSE_MARKET_PATH },
    { id: 'rewards', title: 'Create staking rewards', line: 'Pay people for staking a token, any token, not only yours.', chips: ['Simple reward', 'Compounded reward'], href: CHOOSE_REWARDS_PATH },
    { id: 'grow', title: 'Grow a community', line: 'Airdrops, a list of wallets, raffles, or reaching another community.', chips: ['Airdrop', 'Multi-send', 'Raffle', '+1'], href: CHOOSE_GROW_PATH },
    { id: 'dao', title: 'Create a DAO', line: 'Let holders decide together: proposals, votes and a shared treasury.', chips: [] },
    { id: 'contest', title: 'Create a trading contest', line: 'Prizes for the top traders of a market over a set period.', chips: [] },
]
