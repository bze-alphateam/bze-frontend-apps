import type { CreationFees } from '@bze/bze-ui-kit'
import { airdropFormHref, denomRewardHref, scheduleFormHref } from '@/lib/denom-reward'
import { officialHref } from '@/lib/registry-entry'
import { reachHref } from '@/lib/reach'
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
    | 'stakable' | 'giftStakers' | 'reach' | 'multisend' | 'campaign' | 'dailyPrize'
    | 'registry' | 'brandKit' | 'lock'

export interface Goal {
    id: GoalId;
    group: GoalGroupId;
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
    /** Where the goal starts; called with the chosen token for `needsToken` goals. Without it the goal is "Coming soon". */
    href?: (denom?: string) => string;
    /** Everyday words that find the goal; filled by the search ticket. */
    synonyms: string[];
}

const enc = encodeURIComponent

export const GOALS: Goal[] = [
    {
        id: 'createToken', group: 'start', title: 'Create my token',
        description: 'Name, ticker and supply. Minted to you in one step.',
        techTag: 'Token factory', feeKey: 'createDenomFee', href: () => '/token/new', synonyms: [],
    },
    {
        id: 'pool', group: 'traded', title: 'Let people buy and sell it',
        description: 'Pair it with BZE. You set the starting price.',
        techTag: 'Liquidity pool', feeKey: 'createMarketFee',
        href: (denom) => (denom ? `/pool/new?base=${enc(denom)}` : '/pool/new'), synonyms: [],
    },
    {
        id: 'addLiquidity', group: 'traded', title: 'Make trading smoother',
        description: 'Add more to a pool so big trades move the price less.',
        techTag: 'Add liquidity', href: () => '/pool/add', synonyms: [],
    },
    {
        id: 'market', group: 'traded', title: 'Allow limit orders',
        description: 'Traders can name their price on the DEX.',
        techTag: 'Order-book market', feeKey: 'createMarketFee', href: () => '/market/new', synonyms: [],
    },
    {
        id: 'stakable', group: 'community', title: 'Make my token stakable', badge: 'Start here',
        description: 'Holders stake it and share daily prizes you fund.',
        techTag: 'Holder rewards', feeKey: 'createDenomRewardFee', needsToken: 'any', includeLP: true,
        href: (denom = '') => denomRewardHref(denom), synonyms: [],
    },
    {
        id: 'giftStakers', group: 'community', title: 'Gift my stakers, once',
        description: 'Split an amount between everyone staking today.',
        techTag: 'Holder rewards · airdrop', needsToken: 'any', includeLP: true,
        href: (denom = '') => airdropFormHref(denom), synonyms: [],
    },
    {
        id: 'reach', group: 'community', title: 'Reach another community',
        description: 'Put your token in the wallets of people staking theirs.',
        techTag: 'Airdrop or daily prize, on their token', href: () => reachHref(), synonyms: [],
    },
    {
        id: 'multisend', group: 'community', title: 'Send to a list of wallets',
        description: 'Contest winners, a snapshot, your early supporters: paste or upload a list.',
        techTag: 'Multi-send · no fee', href: () => '/multisend', synonyms: [],
    },
    {
        id: 'campaign', group: 'community', title: 'Run a campaign with an end date',
        description: 'e.g. stake HONEY/BZE LP for 30 days, earn HONEY.',
        techTag: 'Staking program', feeKey: 'createStakingRewardFee', href: () => '/reward/new', synonyms: [],
    },
    {
        id: 'dailyPrize', group: 'community', title: 'Give a little every day',
        description: 'Keeps people staking longer than a one-off gift.',
        techTag: 'Holder rewards · daily prize', feeKey: 'addDenomRewardScheduleFee', needsToken: 'any', includeLP: true,
        href: (denom = '') => scheduleFormHref(denom), synonyms: [],
    },
    {
        id: 'registry', group: 'official', title: 'Get my logo in every wallet',
        description: 'List the token in the Cosmos Chain Registry. We walk you through it.',
        techTag: 'Chain registry · free', needsToken: 'any',
        href: (denom = '') => officialHref(denom), synonyms: [],
    },
    {
        id: 'brandKit', group: 'official', title: 'Give it a look',
        description: 'Colours and a font for its Communities page.',
        techTag: 'Brand kit', needsToken: 'mine',
        href: (denom = '') => workspaceHref(denom, 'profile'), synonyms: [],
    },
    {
        id: 'lock', group: 'official', title: 'Prove the supply is fixed',
        description: 'Lock it forever. Do it last.',
        techTag: 'Renounce admin', needsToken: 'mine',
        href: (denom = '') => `${workspaceHref(denom, 'control')}&lock=1`, synonyms: [],
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
    { label: 'Burn', external: 'burner' },
    { label: 'My creations', href: '/manage' },
]

/**
 * The home search box until the synonym search lands: title, description and tech tag,
 * case-insensitive. The tech tag is in so the technical names find their goal ("pool").
 */
export function filterGoals(goals: Goal[], query: string): Goal[] {
    const q = query.trim().toLowerCase()
    if (!q) return goals
    return goals.filter(g => [g.title, g.description, g.techTag].some(text => text.toLowerCase().includes(q)))
}
