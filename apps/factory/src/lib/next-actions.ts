import { createMarketId, getBurnerApp, getDexApp, getFactoryApp, type AppKey } from '@bze/bze-ui-kit'
import { burnerCoinHref } from '@/lib/raffle-new'
import { officialHref } from '@/lib/registry-entry'
import { workspaceHref } from '@/lib/workspace'

// What a Done screen proposes after each wizard (BFE-259, canvas D5): one recommended next step
// that carries what was just created, plus up to three others. Steps the chain shows are already
// done are skipped. Renounce admin, Transfer admin and "lock the supply" are never proposed.

/** The completed action a Done screen is shown for. */
export type NextActionKind =
    | 'tokenCreated'
    | 'poolCreated'
    | 'marketCreated'
    | 'simpleRewardCreated'
    | 'compoundedCreated'
    | 'prizeAdded'
    | 'reachedCommunity'
    | 'multisendFinished'
    | 'raffleStarted'

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
    /** The token the action was about (created, staked, gifted, sent, raffled). */
    denom?: string;
    ticker?: string;
    poolId?: string;
    lpDenom?: string;
    base?: string;
    quote?: string;
    /** "HONEY/BZE". */
    pairLabel?: string;
    rewardId?: string;
    /** The staked token of a reward. */
    stakedDenom?: string;
    stakedTicker?: string;
    prizeDenom?: string;
    prizeTicker?: string;
    /** The daily prize schedule that was added (prizeAdded, daily prize only). */
    scheduleId?: string;
    /** prizeAdded: a daily prize or a one-off airdrop. */
    prizeKind?: 'daily' | 'airdrop';
    /** compoundedCreated: a first daily prize was funded with it. */
    withPrize?: boolean;
    /** The key number for announcements, e.g. "50 BZE a day for 30 days". */
    prize?: string;
    /** poolCreated: "0.002 BZE per HONEY". */
    startingPrice?: string;
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

const NATIVE_DENOM = 'ubze'
const MAX_MORE = 3

const q = encodeURIComponent

// Every href in one place: later tickets change a route here in one line.
const ROUTES = {
    newPool: (base: string, quote?: string) => `/pool/new?base=${q(base)}${quote ? `&quote=${q(quote)}` : ''}`,
    newMarket: (base: string, quote?: string) => `/market/new?base=${q(base)}${quote ? `&quote=${q(quote)}` : ''}`,
    makeStakable: (denom: string) => `/denom-reward/new?denom=${q(denom)}`,
    dailyPrize: (denom: string, scheduleId?: string) =>
        `/denom-reward/schedule?denom=${q(denom)}${scheduleId ? `&schedule=${q(scheduleId)}` : ''}`,
    airdrop: (denom: string) => `/denom-reward/airdrop?denom=${q(denom)}`,
    newSimpleReward: (stakingDenom: string) => `/reward/new?staking=${q(stakingDenom)}`,
    reachWithGift: (gift: string) => `/reach?gift=${q(gift)}`,
    reachCommunity: (denom: string) => `/reach?community=${q(denom)}`,
    multisend: (denom: string) => `/multisend?denom=${q(denom)}`,
    registry: officialHref,
    // BFE-271 moves the brand kit to the token page's details.
    brandKit: (denom: string) => workspaceHref(denom, 'details'),
    factoryUrl: (path: string) => `${getFactoryApp().href}${path}`,
    dexPool: (poolId: string) => `${getDexApp().href}/pools/details?id=${q(poolId)}`,
    dexMarket: (base: string, quote: string) => `${getDexApp().href}/exchange/market?id=${q(createMarketId(base, quote))}`,
    dexStaking: (ticker: string) => `${getDexApp().href}/staking?search=${q(ticker)}`,
    burnerCoin: (denom: string) => burnerCoinHref(getBurnerApp().href, denom),
}

const NOT_STAKED_YET = 'Available once someone is staking. We check before you sign.'

interface Candidate extends NextAction {
    /** The chain shows it is done already. */
    done?: boolean;
}

const samePair = (a: { base: string; quote: string }, x: string, y: string) =>
    (a.base === x && a.quote === y) || (a.base === y && a.quote === x)

const hasPool = (facts: NextActionFacts | undefined, x: string, y: string) =>
    Boolean(facts?.pools?.some(p => samePair(p, x, y)))

const hasMarket = (facts: NextActionFacts | undefined, x: string, y: string) =>
    Boolean(facts?.markets?.some(m => samePair(m, x, y)))

const name = (ticker: string | undefined, fallback = 'the token') => ticker || fallback

function makeStakable(denom: string, ticker: string | undefined, facts: NextActionFacts | undefined, title?: string): Candidate {
    return {
        key: 'makeStakable',
        icon: 'stake',
        title: title ?? `Make ${name(ticker)} stakable`,
        text: 'People stake it and share prizes you or others add.',
        cta: 'Create compounded reward',
        target: { href: ROUTES.makeStakable(denom) },
        done: facts?.hasCompoundedReward,
    }
}

function airdropToStakers(denom: string, ticker: string | undefined, facts: NextActionFacts | undefined): Candidate {
    return {
        key: 'airdrop',
        icon: 'airdrop',
        title: 'Airdrop to stakers, once',
        text: `Send a one-off gift to everyone staking ${name(ticker)}, shared by stake.`,
        cta: 'Airdrop',
        target: { href: ROUTES.airdrop(denom) },
        disabledReason: facts?.hasStakers ? undefined : NOT_STAKED_YET,
    }
}

function tellStakers(ctx: NextActionContext): Candidate {
    const ticker = name(ctx.stakedTicker ?? ctx.ticker)
    const what = ctx.prize ? `${ctx.prize}, shared by everyone staking ${ticker}` : `a new prize for everyone staking ${ticker}`
    return {
        key: 'tellStakers',
        icon: 'share',
        title: 'Tell your stakers',
        text: 'A ready post with the prize and the staking link.',
        cta: 'Copy announcement',
        target: {
            copy: `New for ${ticker} stakers: ${what}. Stake ${ticker} on the BZE DEX: ${ROUTES.dexStaking(ticker)}`,
            copied: 'Announcement',
        },
    }
}

function reachAnother(gift: string, ticker: string | undefined, title = 'Reach another community'): Candidate {
    return {
        key: 'reach',
        icon: 'reach',
        title,
        text: `Put ${name(ticker)} in front of another token's stakers as a daily prize or an airdrop.`,
        cta: 'Reach a community',
        target: { href: ROUTES.reachWithGift(gift) },
    }
}

function candidatesFor(kind: NextActionKind, ctx: NextActionContext, facts?: NextActionFacts): Candidate[] {
    const denom = ctx.denom ?? ''
    const ticker = ctx.ticker

    switch (kind) {
    case 'tokenCreated':
        return [
            {
                key: 'pool',
                icon: 'pool',
                title: `Let people buy ${name(ticker)}`,
                text: `Create a ${name(ticker)}/BZE liquidity pool. ${name(ticker)} is already filled in.`,
                cta: 'Create pool',
                target: { href: ROUTES.newPool(denom) },
                done: hasPool(facts, denom, NATIVE_DENOM),
            },
            makeStakable(denom, ticker, facts),
            {
                key: 'registry',
                icon: 'registry',
                title: 'Get your logo in every wallet',
                text: `Submit ${name(ticker)} to the Cosmos Chain Registry. Free, reviewed in a few days.`,
                cta: 'Submit to registry',
                target: { href: ROUTES.registry(denom) },
                done: facts?.registry === 'listed' || facts?.registry === 'off',
            },
            {
                key: 'brandKit',
                icon: 'brand',
                title: 'Give it a look',
                text: 'Colours and a font for its Communities page.',
                cta: 'Open brand kit',
                target: { href: ROUTES.brandKit(denom) },
                done: facts?.brandKitSet,
            },
            {
                key: 'market',
                icon: 'market',
                title: 'Allow limit orders too',
                text: `Open an order book for ${name(ticker)} for traders who name their price.`,
                cta: 'Create order-book market',
                target: { href: ROUTES.newMarket(denom) },
                done: Boolean(facts?.hasMarket || facts?.markets?.some(m => m.base === denom || m.quote === denom)),
            },
        ]

    case 'poolCreated': {
        const base = ctx.base ?? ''
        const quote = ctx.quote ?? ''
        const pair = ctx.pairLabel ?? 'the'
        const poolUrl = ROUTES.dexPool(ctx.poolId ?? '')
        return [
            {
                key: 'addLiquidity',
                icon: 'liquidity',
                title: 'Add liquidity you can withdraw',
                text: 'A deeper pool means big trades move the price less. You get pool shares for this part and can take it out any time.',
                cta: 'Add liquidity on DEX',
                target: { app: 'dex', href: poolUrl },
            },
            {
                key: 'rewardLps',
                icon: 'reward',
                title: 'Reward liquidity providers',
                text: `Pay people who stake ${pair} pool shares, so the pool keeps its depth.`,
                cta: 'Create simple reward',
                target: { href: ROUTES.newSimpleReward(ctx.lpDenom ?? '') },
                // The LP denom is read from the stored pool after the tx: until then there is nothing to stake.
                ...(ctx.lpDenom ? {} : { disabledReason: 'Waiting for the pool share token…', pending: true }),
            },
            {
                key: 'market',
                icon: 'market',
                title: 'Allow limit orders too',
                text: `Open a ${pair} order book next to the pool for traders who name their price.`,
                cta: 'Create order-book market',
                target: { href: ROUTES.newMarket(base, quote) },
                done: hasMarket(facts, base, quote),
            },
            {
                key: 'announce',
                icon: 'share',
                title: 'Tell people about it',
                text: 'A ready post with the pool link and starting price.',
                cta: 'Copy announcement',
                target: {
                    copy: `The ${pair} pool is open on the BZE DEX${ctx.startingPrice ? `, starting at ${ctx.startingPrice}` : ''}. Swap here: ${poolUrl}`,
                    copied: 'Announcement',
                },
            },
        ]
    }

    case 'marketCreated': {
        const base = ctx.base ?? ''
        const quote = ctx.quote ?? ''
        const pair = ctx.pairLabel ?? 'The'
        const marketUrl = ROUTES.dexMarket(base, quote)
        return [
            {
                key: 'openMarket',
                icon: 'market',
                title: 'Open the market on DEX',
                text: 'Place the first orders so traders see a price.',
                cta: 'Open market on DEX',
                target: { app: 'dex', href: marketUrl },
            },
            {
                key: 'pool',
                icon: 'pool',
                title: 'Create a pool for the pair',
                text: 'Swaps fill instantly from a pool, next to the order book.',
                cta: 'Create pool',
                target: { href: ROUTES.newPool(base, quote) },
                done: hasPool(facts, base, quote),
            },
            {
                key: 'contest',
                icon: 'contest',
                title: 'Trading contest',
                text: 'Reward the best traders of the market.',
                cta: 'Coming soon',
                target: { href: '/' },
                disabledReason: 'Coming soon',
            },
            {
                key: 'copyMarket',
                icon: 'share',
                title: 'Share the market',
                text: 'A ready post with the market link.',
                cta: 'Copy market link',
                target: { copy: `${pair} order book is open on the BZE DEX. Place limit orders: ${marketUrl}`, copied: 'Market link' },
            },
        ]
    }

    case 'simpleRewardCreated': {
        const staked = ctx.stakedDenom ?? ''
        const stakedTicker = name(ctx.stakedTicker)
        const stakingUrl = ROUTES.dexStaking(stakedTicker)
        const prize = ctx.prize ? ` and earn ${ctx.prize}` : ctx.prizeTicker ? ` and earn ${ctx.prizeTicker}` : ''
        return [
            {
                key: 'shareStaking',
                icon: 'share',
                title: 'Share the staking link',
                text: 'Staking happens on the DEX. Send your community straight to it.',
                cta: 'Copy staking link',
                target: { copy: `Stake ${stakedTicker}${prize} on the BZE DEX: ${stakingUrl}`, copied: 'Staking link' },
            },
            {
                key: 'stakeOnDex',
                icon: 'stake',
                title: 'Stake on DEX',
                text: `See the reward live and stake your own ${stakedTicker}.`,
                cta: 'Stake on DEX',
                target: { app: 'dex', href: stakingUrl },
            },
            makeStakable(staked, ctx.stakedTicker, facts, `Make ${stakedTicker} stakable for good`),
        ]
    }

    case 'compoundedCreated': {
        if (ctx.withPrize) {
            return [
                tellStakers(ctx),
                airdropToStakers(denom, ticker, facts),
                reachAnother(ctx.prizeDenom ?? denom, ctx.prizeTicker ?? ticker),
            ]
        }
        const stakingUrl = ROUTES.dexStaking(name(ticker))
        return [
            {
                key: 'dailyPrize',
                icon: 'prize',
                title: 'Add a daily prize',
                text: `Shared every day by everyone staking ${name(ticker)}. Any token can be the prize.`,
                cta: 'Add daily prize',
                target: { href: ROUTES.dailyPrize(denom) },
            },
            airdropToStakers(denom, ticker, facts),
            {
                key: 'sendToStake',
                icon: 'stake',
                title: 'Send people to stake',
                text: 'Staking happens on the DEX. Share the link with your community.',
                cta: 'Copy link',
                target: { copy: `${name(ticker)} is stakable on the BZE DEX. Stake it here: ${stakingUrl}`, copied: 'Staking link' },
                alsoApp: { app: 'dex', href: stakingUrl, label: 'DEX' },
            },
            {
                key: 'invitePartner',
                icon: 'partner',
                title: 'Ask a partner to add prizes',
                text: `Another community can put its token here to reach ${name(ticker)} stakers.`,
                cta: 'Copy invite',
                target: {
                    copy: `${name(ticker)} stakers are open to new prizes. Put your token in front of them as a daily prize or an airdrop: ${ROUTES.factoryUrl(ROUTES.reachCommunity(denom))}`,
                    copied: 'Invite',
                },
            },
        ]
    }

    case 'prizeAdded':
        return [
            tellStakers(ctx),
            reachAnother(ctx.prizeDenom ?? '', ctx.prizeTicker),
            ...(ctx.prizeKind === 'daily' ? [{
                key: 'extend',
                icon: 'extend' as const,
                title: 'Extend before it ends',
                text: 'Pay for more days so stakers keep earning without a gap.',
                cta: 'Extend daily prize',
                target: { href: ROUTES.dailyPrize(ctx.stakedDenom ?? denom, ctx.scheduleId) },
            }] : []),
        ]

    case 'reachedCommunity': {
        const pool = facts?.pools?.find(p => samePair(p, denom, NATIVE_DENOM))
        return [
            makeStakable(denom, ticker, facts, `Make ${name(ticker, 'your token')} stakable`),
            pool ? {
                key: 'addLiquidity',
                icon: 'liquidity',
                title: 'Add liquidity on DEX',
                text: `New holders can trade ${name(ticker)} more easily in a deeper pool.`,
                cta: 'Add liquidity on DEX',
                target: { app: 'dex', href: ROUTES.dexPool(pool.id) },
            } : {
                key: 'pool',
                icon: 'pool',
                title: `Let people buy ${name(ticker)}`,
                text: `Create a ${name(ticker)}/BZE liquidity pool so new holders can trade it.`,
                cta: 'Create pool',
                target: { href: ROUTES.newPool(denom) },
            },
            reachAnother(denom, ticker, 'Airdrop to another token'),
        ]
    }

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
            makeStakable(denom, ticker, facts),
            {
                key: 'sendAgain',
                icon: 'send',
                title: 'Send to another list',
                text: `Start a new list with ${name(ticker)} already picked.`,
                cta: 'New list',
                target: { href: ROUTES.multisend(denom) },
            },
        ]

    case 'raffleStarted': {
        const burnerUrl = ROUTES.burnerCoin(denom)
        return [
            {
                key: 'openRaffle',
                icon: 'raffle',
                title: 'Open the raffle',
                text: 'Players join it on Burner. Check it is live and try your luck.',
                cta: 'Open on Burner',
                target: { app: 'burner', href: burnerUrl },
            },
            {
                key: 'copyRaffle',
                icon: 'share',
                title: 'Share the raffle',
                text: 'A ready post with the raffle link.',
                cta: 'Copy raffle link',
                target: { copy: `A burning raffle for ${name(ticker)} is live on Burner. Join here: ${burnerUrl}`, copied: 'Raffle link' },
            },
            ...(facts?.hasCompoundedReward ? [airdropToStakers(denom, ticker, facts)] : []),
        ]
    }
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
