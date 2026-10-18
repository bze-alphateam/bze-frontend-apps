import { type CreationFees, getBurnerApp } from '@bze/bze-ui-kit'
import { airdropFormHref, denomRewardHref, scheduleFormHref } from '@/lib/denom-reward'
import { officialHref } from '@/lib/registry-entry'
import { reachHref } from '@/lib/reach'
import { raffleHref } from '@/lib/raffle-new'
import { rewardsHref } from '@/lib/rewards-directory'
import { workspaceHref } from '@/lib/workspace'

// The home page's goal catalogue (BFE-167): what people want to do, in plain words, with the
// technical name next to it. Data only; the home search and the playbooks read it too.

export type GoalGroupId = 'start' | 'traded' | 'community' | 'official'

export interface GoalGroup {
    id: GoalGroupId;
    number: number;
    title: string;
}

export const GOAL_GROUPS: GoalGroup[] = [
    { id: 'start', number: 1, title: 'Start' },
    { id: 'traded', number: 2, title: 'Get it traded' },
    { id: 'community', number: 3, title: 'Grow the community' },
    { id: 'official', number: 4, title: 'Make it official' },
]

export type GoalId =
    | 'createToken' | 'pool' | 'addLiquidity' | 'market'
    | 'stakable' | 'giftStakers' | 'reach' | 'multisend' | 'campaign' | 'dailyPrize' | 'raffle'
    | 'registry' | 'brandKit' | 'lock'

/** Tools that are not goals on the home cards; only the search finds them. */
export type ToolId = 'burn' | 'mintMore' | 'handOver'

export interface Goal {
    id: GoalId | ToolId;
    /** 'tool': a search-only entry, never a home card. */
    group: GoalGroupId | 'tool';
    title: string;
    description: string;
    /** The technical name, in small grey text. */
    techTag: string;
    /** The creation fee the flow charges (from chain params), when it has one. */
    feeKey?: keyof CreationFees;
    badge?: string;
    /** The goal acts on a token: ask which one first. 'mine' = the user's own tokens only. */
    needsToken?: 'mine' | 'any';
    /** The token choice also offers LP tokens. */
    includeLP?: boolean;
    /** The token choice hides governance-halted tokens. */
    excludeHalted?: boolean;
    /** Where the goal starts; called with the chosen token for `needsToken` goals. Without it the goal is "Coming soon". */
    href?: (denom?: string) => string;
    /** `href` is another app (the burner), opened in a new tab. */
    external?: boolean;
    /** Everyday words that find the goal (lower case), for the home search. */
    synonyms: string[];
}

const enc = encodeURIComponent

export const GOALS: Goal[] = [
    {
        id: 'createToken', group: 'start', title: 'Create my token',
        description: 'Name, ticker and supply. Minted to you in one step.',
        techTag: 'Token factory', feeKey: 'createDenomFee', href: () => '/token/new', synonyms: ['create', 'new token', 'coin', 'launch', 'mint', 'issue', 'make a token', 'meme', 'memecoin'],
    },
    {
        id: 'pool', group: 'traded', title: 'Let people buy and sell it',
        description: 'Pair it with BZE. You set the starting price.',
        techTag: 'Liquidity pool', feeKey: 'createMarketFee',
        href: (denom) => (denom ? `/pool/new?base=${enc(denom)}` : '/pool/new'), synonyms: ['pool', 'liquidity', 'lp', 'list', 'listing', 'list my token', 'buy', 'sell', 'trade', 'swap', 'price', 'exchange', 'amm'],
    },
    {
        id: 'addLiquidity', group: 'traded', title: 'Make trading smoother',
        description: 'Add more to a pool so big trades move the price less.',
        techTag: 'Add liquidity', href: () => '/pool/add', synonyms: ['add liquidity', 'deposit', 'provide', 'deepen', 'slippage', 'smoother'],
    },
    {
        id: 'market', group: 'traded', title: 'Allow limit orders',
        description: 'Traders can name their price on the DEX.',
        techTag: 'Order-book market', feeKey: 'createMarketFee', href: () => '/market/new', synonyms: ['market', 'order book', 'orderbook', 'limit order', 'limit', 'order'],
    },
    {
        id: 'stakable', group: 'community', title: 'Make my token stakable', badge: 'Start here',
        description: 'Holders stake it and share daily prizes you fund.',
        techTag: 'Holder rewards', feeKey: 'createDenomRewardFee', needsToken: 'any', includeLP: true,
        href: (denom = '') => denomRewardHref(denom), synonyms: ['stake', 'stakable', 'staking', 'yield', 'apr', 'apy', 'earn', 'hold', 'holders', 'rewards', 'passive', 'farm'],
    },
    {
        id: 'giftStakers', group: 'community', title: 'Gift my stakers, once',
        description: 'Split an amount between everyone staking today.',
        techTag: 'Holder rewards · airdrop', needsToken: 'any', includeLP: true,
        href: (denom = '') => airdropFormHref(denom), synonyms: ['airdrop', 'giveaway', 'gift', 'drop', 'bonus', 'reward stakers', 'thank', 'distribute'],
    },
    {
        id: 'reach', group: 'community', title: 'Reach another community',
        description: 'Put your token in the wallets of people staking theirs.',
        techTag: 'Airdrop or daily prize, on their token', href: () => reachHref(), synonyms: ['airdrop', 'other community', 'another token', 'marketing', 'promote', 'grow', 'partner', 'cross-community', 'get noticed'],
    },
    {
        id: 'multisend', group: 'community', title: 'Send to a list of wallets',
        description: 'Contest winners, a snapshot, your early supporters: paste or upload a list.',
        techTag: 'Multi-send · no fee', href: () => '/multisend', synonyms: ['airdrop', 'bulk send', 'multi send', 'multisend', 'send to many', 'list of wallets', 'addresses', 'csv', 'spreadsheet', 'snapshot', 'winners', 'contest', 'bounty', 'distribute'],
    },
    {
        id: 'campaign', group: 'community', title: 'Run a campaign with an end date',
        description: 'e.g. stake HONEY/BZE LP for 30 days, earn HONEY.',
        techTag: 'Staking program', feeKey: 'createStakingRewardFee', href: () => '/reward/new', synonyms: ['campaign', 'farm', 'farming', 'lp rewards', 'promotion', 'season', 'end date', 'lock', 'incentive'],
    },
    {
        id: 'dailyPrize', group: 'community', title: 'Give a little every day',
        description: 'Keeps people staking longer than a one-off gift.',
        techTag: 'Holder rewards · daily prize', feeKey: 'addDenomRewardScheduleFee', needsToken: 'any', includeLP: true,
        href: (denom = '') => scheduleFormHref(denom), synonyms: ['daily', 'every day', 'drip', 'ongoing', 'schedule', 'prize', 'top up'],
    },
    {
        id: 'raffle', group: 'community', title: 'Run a burning raffle',
        description: "People buy tickets to win from a pot you fund. What's left at the end is burned.",
        techTag: 'Burning raffle · no fee', needsToken: 'any', excludeHalted: true,
        href: (denom) => raffleHref(denom), synonyms: ['raffle', 'lottery', 'lucky draw', 'draw', 'prize', 'game', 'tickets', 'burn', 'giveaway', 'contest', 'win'],
    },
    {
        id: 'registry', group: 'official', title: 'Get my logo in every wallet',
        description: 'List the token in the Cosmos Chain Registry. We walk you through it.',
        techTag: 'Chain registry · free', needsToken: 'any',
        href: (denom = '') => officialHref(denom), synonyms: ['logo', 'icon', 'image', 'picture', 'registry', 'keplr', 'leap', 'wallet', 'verified', 'official', 'chain registry', 'github'],
    },
    {
        id: 'brandKit', group: 'official', title: 'Give it a look',
        description: 'Colours and a font for its Communities page.',
        techTag: 'Brand kit', needsToken: 'mine',
        href: (denom = '') => workspaceHref(denom, 'profile'), synonyms: ['brand', 'colours', 'colors', 'font', 'theme', 'look', 'style', 'design'],
    },
    {
        id: 'lock', group: 'official', title: 'Prove the supply is fixed',
        description: 'Lock it forever. Do it last.',
        techTag: 'Renounce admin', needsToken: 'mine',
        href: (denom = '') => `${workspaceHref(denom, 'control')}&lock=1`, synonyms: ['lock', 'renounce', 'fixed supply', 'admin', 'freeze', 'trust', 'rug', 'safe', 'ownership'],
    },
]

/** What the search finds besides the goals: tools people ask for by name. */
export const SEARCH_TOOLS: Goal[] = [
    {
        id: 'burn', group: 'tool', title: 'Burn tokens',
        description: 'Destroy some of the supply, in the Burner app.',
        techTag: 'Burner', external: true, href: () => getBurnerApp().href,
        synonyms: ['burn', 'destroy', 'reduce supply'],
    },
    {
        id: 'mintMore', group: 'tool', title: 'Mint more',
        description: 'Add to the supply of a token you control.',
        techTag: 'Token factory · mint', needsToken: 'mine',
        href: (denom) => (denom ? workspaceHref(denom, 'supply') : '/manage'),
        synonyms: ['mint more', 'increase supply', 'inflation'],
    },
    {
        id: 'handOver', group: 'tool', title: 'Hand over control',
        description: 'Give the token to a team wallet or a DAO.',
        techTag: 'Change admin', needsToken: 'mine',
        href: (denom = '') => workspaceHref(denom, 'control'),
        synonyms: ['transfer admin', 'change admin', 'dao', 'team wallet'],
    },
]

export const goalById = (id: GoalId): Goal => GOALS.find(g => g.id === id) as Goal

/** The quick chips under the home search. */
export const GOAL_CHIPS: { label: string; goal: GoalId }[] = [
    { label: 'Create my token', goal: 'createToken' },
    { label: 'Let people buy it', goal: 'pool' },
    { label: 'Make it stakable', goal: 'stakable' },
    { label: 'Airdrop another community', goal: 'reach' },
    { label: 'Get a logo everywhere', goal: 'registry' },
]

export type ToolLink =
    | { label: string; goal: GoalId }
    | { label: string; href: string }
    | { label: string; external: 'burner' }

/** "All tools": the technical names, for people who know what they want. */
export const ALL_TOOLS: ToolLink[] = [
    { label: 'Create token', goal: 'createToken' },
    { label: 'Create pool', goal: 'pool' },
    { label: 'Add liquidity', goal: 'addLiquidity' },
    { label: 'Create market', goal: 'market' },
    { label: 'Holder rewards', href: rewardsHref() },
    { label: 'Airdrop', goal: 'giftStakers' },
    { label: 'Multi-send', goal: 'multisend' },
    { label: 'Staking program', goal: 'campaign' },
    { label: 'Brand kit', goal: 'brandKit' },
    { label: 'Chain registry', goal: 'registry' },
    { label: 'Burner', external: 'burner' },
    { label: 'My creations', href: '/manage' },
]
