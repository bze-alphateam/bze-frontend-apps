import { createMarketId, getBurnerApp, getDexApp, type AppKey } from '@bze/bze-ui-kit'
import { airdropHref } from '@/lib/airdrop'
import { chooseRewardsHref } from '@/lib/create-routes'
import { scheduleFormHref } from '@/lib/denom-reward'
import { burnerCoinHref } from '@/lib/raffle-new'
import { officialHref } from '@/lib/registry-entry'
import { workspaceHref } from '@/lib/workspace'

// What a Done screen proposes after each wizard (BFE-259, canvas D5): one recommended next step
// that carries what was just created, plus a few others. Kept short on purpose: the place to use
// the new thing (the DEX, Burner) and at most the one step that naturally follows. Steps the chain
// shows are already done are skipped. Renounce admin and Transfer admin are never proposed.

/** The completed action a Done screen is shown for. */
export type NextActionKind =
    | 'tokenCreated'
    | 'poolCreated'
    | 'marketCreated'
    | 'simpleRewardCreated'
    | 'compoundedCreated'
    | 'prizeAdded'
    | 'multisendFinished'
    | 'raffleStarted'
    | 'listed'

/** Icon names; DoneScreen maps them to icons. */
export type NextIcon =
    | 'pool' | 'stake' | 'registry' | 'brand' | 'market' | 'liquidity' | 'reward' | 'share'
    | 'prize' | 'airdrop' | 'partner' | 'reach' | 'extend' | 'download' | 'send' | 'contest' | 'raffle'

export type NextTarget =
    /** A Factory route. */
    | { href: string }
    /** A page of another BZE app (full URL), shown as that app's AppLink. */
    | { app: AppKey; href: string }
    /** Plain text for the clipboard; `copied` names it in the "Copied" toast. */
    | { copy: string; copied: string }
    | { onClick: () => void }

export interface NextAction {
    key: string;
    icon: NextIcon;
    title: string;
    text: string;
    /** The button / link label. */
    cta: string;
    target: NextTarget;
    /** A second way in shown next to the button, e.g. the DEX link beside "Copy link". */
    alsoApp?: { app: AppKey; href: string; label: string };
    /** Why it can't be done yet; the action shows disabled with this text. */
    disabledReason?: string;
    /** Disabled only until a chain read finishes (e.g. the new pool's LP denom): shows a shimmer. */
    pending?: boolean;
}

/** What was just created. Only the fields the kind needs are read. */
export interface NextActionContext {
    /** The token the action was about (created, staked, sent, raffled). */
    denom?: string;
    ticker?: string;
    poolId?: string;
    base?: string;
    quote?: string;
    /** The staked token of a reward. */
    stakedDenom?: string;
    stakedTicker?: string;
    /** prizeAdded: it went to a simple reward (extended, or airdropped through it). */
    viaSimpleReward?: boolean;
    /** multisendFinished, when the run was batched: downloads the report. */
    downloadReport?: () => void;
}

/** Chain facts about the subject token (see factsFromTokenSetup); anything missing is treated as not done. */
export interface NextActionFacts {
    /** Pools the token is in. */
    pools?: { id: string; base: string; quote: string }[];
    /** Order-book markets the token is in. */
    markets?: { base: string; quote: string }[];
    /** The token is in some order-book market (when the markets themselves aren't known). */
    hasMarket?: boolean;
    /** The token has a compounded reward (it is stakable). */
    hasCompoundedReward?: boolean;
    /** Something is staked in the token's compounded reward. */
    hasStakers?: boolean;
    /** Cosmos Chain Registry listing; 'off' on testnet. */
    registry?: 'listed' | 'not-listed' | 'off';
    brandKitSet?: boolean;
}

export interface NextActions {
    /** Undefined only when every candidate is already done. */
    recommended?: NextAction;
    /** At most three. */
    more: NextAction[];
}

const MAX_MORE = 3

const q = encodeURIComponent

// Every href in one place: later tickets change a route here in one line.
const ROUTES = {
    chooseMarket: (base: string) => `/create/market?base=${q(base)}`,
    chooseRewards: (denom: string) => chooseRewardsHref({ denom }),
    dailyPrize: (denom: string) => scheduleFormHref(denom),
    airdrop: (prize: string) => airdropHref({ prize }),
    registry: officialHref,
    tokenPage: (denom: string) => workspaceHref(denom),
    // BFE-271 moves the brand kit to the token page's details.
    brandKit: (denom: string) => workspaceHref(denom, 'details'),
    dexPool: (poolId: string) => `${getDexApp().href}/pools/details?id=${q(poolId)}`,
    dexMarket: (base: string, quote: string) => `${getDexApp().href}/exchange/market?id=${q(createMarketId(base, quote))}`,
    dexStaking: (ticker: string) => `${getDexApp().href}/staking?search=${q(ticker)}`,
    burnerCoin: (denom: string) => burnerCoinHref(getBurnerApp().href, denom),
}

const name = (ticker: string | undefined, fallback = 'the token') => ticker || fallback

interface Candidate extends NextAction {
    /** The chain shows it is done already. */
    done?: boolean;
}

function stakeOnDex(ticker: string | undefined): Candidate {
    const stakingUrl = ROUTES.dexStaking(name(ticker))
    return {
        key: 'stakeOnDex',
        icon: 'stake',
        title: 'Stake on DEX',
        text: `Staking happens on the DEX. See the reward live, stake ${name(ticker)} and share the link.`,
        cta: 'Stake on DEX',
        target: { app: 'dex', href: stakingUrl },
    }
}

/** A daily prize for a compounded reward's stakers: anyone can add one, in any coin. */
function moreRewards(stakedDenom: string, ticker: string | undefined): Candidate {
    return {
        key: 'moreRewards',
        icon: 'prize',
        title: 'Add more rewards',
        text: `Another daily prize for everyone staking ${name(ticker)}, in any coin.`,
        cta: 'Add daily prize',
        target: { href: ROUTES.dailyPrize(stakedDenom) },
    }
}

function candidatesFor(kind: NextActionKind, ctx: NextActionContext, facts?: NextActionFacts): Candidate[] {
    const denom = ctx.denom ?? ''
    const ticker = ctx.ticker

    switch (kind) {
    case 'tokenCreated':
        return [
            {
                key: 'market',
                icon: 'market',
                title: 'Create a DEX market',
                text: `Let people buy and sell ${name(ticker)}: a liquidity pool, an order book, or both.`,
                cta: 'Create a market',
                target: { href: ROUTES.chooseMarket(denom) },
            },
            {
                key: 'rewards',
                icon: 'reward',
                title: 'Create staking rewards',
                text: `Pay people for staking ${name(ticker)}, so they hold it.`,
                cta: 'Create staking rewards',
                target: { href: ROUTES.chooseRewards(denom) },
            },
            {
                key: 'airdrop',
                icon: 'airdrop',
                title: `Airdrop ${name(ticker)}`,
                text: 'Send it to a list of wallets, or to the stakers of any token.',
                cta: 'Airdrop',
                target: { href: ROUTES.airdrop(denom) },
            },
            {
                key: 'registry',
                icon: 'registry',
                title: 'Get your logo in every wallet',
                text: `Submit ${name(ticker)} to the Cosmos Chain Registry. Free, reviewed in a few days.`,
                cta: 'Submit to registry',
                target: { href: ROUTES.registry(denom) },
                done: facts?.registry === 'listed' || facts?.registry === 'off',
            },
        ]

    case 'poolCreated':
        return [{
            key: 'addLiquidity',
            icon: 'liquidity',
            title: 'Add liquidity on DEX',
            text: 'A deeper pool means big trades move the price less. You can take your part out any time.',
            cta: 'Add liquidity on DEX',
            target: { app: 'dex', href: ROUTES.dexPool(ctx.poolId ?? '') },
        }]

    case 'marketCreated':
        return [{
            key: 'openMarket',
            icon: 'market',
            title: 'Open the market on DEX',
            text: 'Place the first orders so traders see a price.',
            cta: 'Open market on DEX',
            target: { app: 'dex', href: ROUTES.dexMarket(ctx.base ?? '', ctx.quote ?? '') },
        }]

    case 'simpleRewardCreated':
        return [stakeOnDex(ctx.stakedTicker)]

    case 'compoundedCreated':
        return [stakeOnDex(ticker), moreRewards(denom, ticker)]

    // A prize on a compounded reward (daily, extended or airdropped) can take more; a simple reward can't.
    case 'prizeAdded':
        return [
            stakeOnDex(ctx.stakedTicker),
            ...(ctx.viaSimpleReward ? [] : [moreRewards(ctx.stakedDenom ?? denom, ctx.stakedTicker)]),
        ]

    case 'multisendFinished':
        return [
            ...(ctx.downloadReport ? [{
                key: 'report',
                icon: 'download' as const,
                title: 'Download the report',
                text: 'Every wallet, amount and transaction of this run, as a CSV.',
                cta: 'Download report',
                target: { onClick: ctx.downloadReport },
            }] : []),
            {
                key: 'sendAgain',
                icon: 'send',
                title: 'Send to another list',
                text: `Start a new list with ${name(ticker)} already picked.`,
                cta: 'New list',
                target: { href: airdropHref({ to: 'list', denom }) },
            },
        ]

    case 'raffleStarted':
        return [{
            key: 'openRaffle',
            icon: 'raffle',
            title: 'Open the raffle',
            text: 'Players join it on Burner. Check it is live and share it.',
            cta: 'Open on Burner',
            target: { app: 'burner', href: ROUTES.burnerCoin(denom) },
        }]

    // The registry guide's Done screen (BFE-274): back to the token, then its look and staking.
    case 'listed':
        return [
            {
                key: 'backToToken',
                icon: 'registry',
                title: `Back to ${name(ticker)}`,
                text: 'See its logo and everything else on its token page.',
                cta: `Back to ${name(ticker)}`,
                target: { href: ROUTES.tokenPage(denom) },
            },
            {
                key: 'brandKit',
                icon: 'brand',
                title: 'Brand kit',
                text: 'Colours and a font for its Communities page.',
                cta: 'Open brand kit',
                target: { href: ROUTES.brandKit(denom) },
                done: facts?.brandKitSet,
            },
            {
                key: 'rewards',
                icon: 'stake',
                title: 'Make it stakable',
                text: 'Pay people for staking it, so they hold it.',
                cta: 'Create staking rewards',
                target: { href: ROUTES.chooseRewards(denom) },
                done: facts?.hasCompoundedReward,
            },
        ]
    }
}

function toAction(candidate: Candidate): NextAction {
    const action = { ...candidate }
    delete action.done
    return action
}

/**
 * The next steps for a Done screen. The first candidate not yet done on chain (and not disabled)
 * is recommended; the rest that are not done follow, at most three.
 */
export function nextActions(kind: NextActionKind, ctx: NextActionContext, facts?: NextActionFacts): NextActions {
    const open = candidatesFor(kind, ctx, facts).filter(c => !c.done).map(toAction)
    const recommended = open.find(a => !a.disabledReason)
    return {
        recommended,
        more: open.filter(a => a !== recommended).slice(0, MAX_MORE),
    }
}

/** What useTokenSetup read, as next-action facts; undefined while it is still reading. */
export function factsFromTokenSetup(setup: {
    isLoading: boolean;
    items: { key: string; state: string }[];
    pools: { id: string; base: string; quote: string }[];
    hasMarket: boolean;
    denomReward?: unknown;
    hasStakers: boolean;
}): NextActionFacts | undefined {
    if (setup.isLoading) return undefined
    const stateOf = (key: string) => setup.items.find(item => item.key === key)?.state
    const registry = stateOf('registry')
    return {
        pools: setup.pools,
        hasMarket: setup.hasMarket,
        hasCompoundedReward: Boolean(setup.denomReward),
        hasStakers: setup.hasStakers,
        registry: registry === undefined ? 'off' : registry === 'done' ? 'listed' : 'not-listed',
        brandKitSet: stateOf('brandKit') === 'done',
    }
}
