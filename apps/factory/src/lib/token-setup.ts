import { withReturn } from '@/components/guided/return-to'
import { officialHref } from '@/lib/registry-entry'
import { VOCABULARY } from '@/lib/vocabulary'
import { workspaceHref } from '@/lib/workspace'

// The "Set up <TICKER>" checklist of the token workspace (BFE-146). Every item is computed from
// chain data on each render, never stored. A new item is one more entry in SETUP_ITEMS.

export type SetupState = 'done' | 'todo' | 'partial' | 'unknown' | 'impossible'

export interface SetupAction {
    label: string;
    href: string;
}

export interface SetupItem {
    key: string;
    title: string;
    detail: string;
    state: SetupState;
    optional: boolean;
    /** Where the item is set up or managed. */
    href: string;
    /** The button next to the item: primary for todo/partial, secondary (if any) when done. */
    action?: SetupAction;
}

/** What the chain says about the token, gathered by useTokenSetup. */
export interface TokenSetupFacts {
    denom: string;
    ticker: string;
    /** Total supply, already formatted for display. */
    supplyLabel: string;
    /** Admin renounced: nothing that needs the admin can be added any more. */
    isLocked: boolean;
    /** On-chain metadata description; undefined when there is no metadata. */
    description?: string;
    brandKit: 'set' | 'none' | 'error';
    /** Pools with the token as base or quote, with a display label per pair. */
    pools: { id: string; label: string }[];
    denomReward: 'none' | 'error' | { runningSchedules: number };
    hasMarket: boolean;
    /** Cosmos Chain Registry listing; 'off' on testnet, where the item is left out. */
    registry: 'off' | 'listed' | 'not-listed' | 'error';
}

interface SetupItemDefinition {
    key: string;
    optional?: boolean;
    /** The item needs the admin, so a locked token can never get it. */
    needsAdmin?: boolean;
    /** The item doesn't apply to this token at all and is left out. */
    skip?: (facts: TokenSetupFacts) => boolean;
    build: (facts: TokenSetupFacts) => Omit<SetupItem, 'key' | 'optional'>;
}

const LOCKED_DETAIL = "Can't be added after the supply was locked"

const backTo = (facts: TokenSetupFacts, tab: 'trading' | 'rewards') => ({
    href: workspaceHref(facts.denom, tab),
    label: facts.ticker,
})

export const SETUP_ITEMS: SetupItemDefinition[] = [
    {
        key: 'created',
        build: f => ({
            title: 'Token created',
            detail: `${f.supplyLabel} ${f.ticker}`,
            state: 'done',
            href: workspaceHref(f.denom, 'supply'),
        }),
    },
    {
        key: 'description',
        needsAdmin: true,
        build: f => {
            const href = workspaceHref(f.denom, 'profile')
            const done = Boolean(f.description?.trim())
            return {
                title: 'Description · shown in wallets',
                detail: done ? (f.description ?? '').trim() : 'Tell people what the token is for.',
                state: done ? 'done' : 'todo',
                href,
                action: { label: done ? 'Edit' : 'Add', href },
            }
        },
    },
    {
        key: 'brandKit',
        needsAdmin: true,
        build: f => {
            const href = workspaceHref(f.denom, 'profile')
            const title = `${VOCABULARY.brandKit.name} · colours and a font for ${f.ticker}'s Communities page`
            if (f.brandKit === 'error') {
                return { title, detail: "Couldn't check the brand kit.", state: 'unknown', href }
            }
            const done = f.brandKit === 'set'
            return {
                title,
                detail: done ? 'Set' : 'Not set yet',
                state: done ? 'done' : 'todo',
                href,
                action: { label: done ? 'Edit' : 'Set up', href },
            }
        },
    },
    {
        key: 'pool',
        build: f => {
            const href = withReturn(`/pool/new?base=${encodeURIComponent(f.denom)}`, backTo(f, 'trading'))
            if (f.pools.length === 0) {
                return {
                    title: VOCABULARY.pool.name,
                    detail: `Lets people swap ${f.ticker}.`,
                    state: 'todo',
                    href,
                    action: { label: 'Create', href },
                }
            }
            return {
                title: VOCABULARY.pool.name,
                detail: f.pools.map(p => p.label).join(', '),
                state: 'done',
                href,
                action: {
                    label: 'Add liquidity',
                    href: withReturn(`/pool/add?pool=${encodeURIComponent(f.pools[0].id)}`, backTo(f, 'trading')),
                },
            }
        },
    },
    {
        key: 'holderRewards',
        build: f => {
            const href = workspaceHref(f.denom, 'rewards')
            const title = VOCABULARY.holderRewards.name
            if (f.denomReward === 'error') {
                return { title, detail: "Couldn't check the holder rewards.", state: 'unknown', href }
            }
            if (f.denomReward === 'none') {
                return {
                    title,
                    detail: `Holders stake ${f.ticker} and share daily prizes.`,
                    state: 'todo',
                    href,
                    action: { label: 'Set up', href },
                }
            }
            if (f.denomReward.runningSchedules === 0) {
                return { title, detail: 'Created, no daily prize running', state: 'partial', href, action: { label: 'Set up', href } }
            }
            const n = f.denomReward.runningSchedules
            return {
                title,
                detail: `${n} daily prize${n === 1 ? '' : 's'} running`,
                state: 'done',
                href,
                action: { label: 'Manage', href },
            }
        },
    },
    {
        key: 'registry',
        skip: f => f.registry === 'off',
        build: f => {
            const href = officialHref(f.denom)
            const title = 'Logo in every wallet · Cosmos Chain Registry'
            if (f.registry === 'error') {
                return { title, detail: "Couldn't reach the registry.", state: 'unknown', href }
            }
            return f.registry === 'listed'
                ? { title, detail: 'Listed', state: 'done', href }
                : {
                    title,
                    detail: `Without it, most wallets show ${f.ticker} as a long factory/… code with no logo.`,
                    state: 'todo',
                    href,
                    action: { label: 'Get it listed', href },
                }
        },
    },
    {
        key: 'market',
        optional: true,
        build: f => {
            const href = withReturn(`/market/new?base=${encodeURIComponent(f.denom)}`, backTo(f, 'trading'))
            return f.hasMarket
                ? { title: VOCABULARY.market.name, detail: 'Open on the DEX', state: 'done', href }
                : {
                    title: VOCABULARY.market.name,
                    detail: 'Lets people place limit orders.',
                    state: 'todo',
                    href,
                    action: { label: 'Create', href },
                }
        },
    },
]

export interface TokenSetup {
    items: SetupItem[];
    doneCount: number;
    /** Every item except the impossible ones; optional items count too. */
    totalCount: number;
}

export function computeTokenSetup(facts: TokenSetupFacts, definitions: SetupItemDefinition[] = SETUP_ITEMS): TokenSetup {
    const items = definitions.filter(def => !def.skip?.(facts)).map((def): SetupItem => {
        const item: SetupItem = { key: def.key, optional: Boolean(def.optional), ...def.build(facts) }
        if (def.needsAdmin && facts.isLocked && item.state === 'todo') {
            return { ...item, state: 'impossible', detail: LOCKED_DETAIL, action: undefined }
        }
        return item
    })

    const counted = items.filter(item => item.state !== 'impossible')
    return {
        items,
        doneCount: counted.filter(item => item.state === 'done').length,
        totalCount: counted.length,
    }
}

// Short hints for token lists (/manage and the home strip), by item key and state.
const HINTS: Record<string, Partial<Record<SetupState, string>>> = {
    description: { todo: 'no description yet' },
    brandKit: { todo: 'no brand kit yet' },
    pool: { todo: 'no pool yet' },
    holderRewards: { todo: 'not stakable yet', partial: 'no daily prize running' },
    registry: { todo: 'not in the registry yet' },
    market: { todo: 'no market yet' },
}

/** The first unfinished item as a short hint ("no pool yet"); undefined when nothing is left to do. */
export function setupHint(setup: Pick<TokenSetup, 'items'>): string | undefined {
    for (const item of setup.items) {
        const hint = HINTS[item.key]?.[item.state]
        if (hint) return hint
    }
    return undefined
}
