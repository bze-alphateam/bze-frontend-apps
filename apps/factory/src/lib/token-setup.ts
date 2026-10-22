import { type AppKey, getDexApp } from '@bze/bze-ui-kit'
import { withReturn } from '@/components/guided/return-to'
import { dexPoolHref } from '@/lib/create-routes'
import { officialHref } from '@/lib/registry-entry'
import { VOCABULARY } from '@/lib/vocabulary'
import { workspaceHref, type TokenSection } from '@/lib/workspace'

// The token's setup checklist (BFE-146), drawn as the token page's setup chips since BFE-271.
// Every item is computed from chain data on each render, never stored. A new item is one more
// entry in SETUP_ITEMS.

export type SetupState = 'done' | 'todo' | 'partial' | 'unknown' | 'impossible'

export interface SetupAction {
    label: string;
    href: string;
    /** A page of another BZE app (full URL), shown as that app's AppLink. */
    app?: AppKey;
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
    /** Admin given up (renounced): nothing that needs the admin can be added any more. */
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

const LOCKED_DETAIL = "Can't be added once the admin is given up"

const backTo = (facts: TokenSetupFacts) => ({ href: workspaceHref(facts.denom), label: facts.ticker })

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
            const href = workspaceHref(f.denom, 'details')
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
            const href = workspaceHref(f.denom, 'details')
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
            const href = withReturn(`/pool/new?base=${encodeURIComponent(f.denom)}`, backTo(f))
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
                // Adding liquidity lives on the DEX pool page (BFE-262).
                action: { label: 'Add liquidity on DEX', href: dexPoolHref(getDexApp().href, f.pools[0].id), app: 'dex' },
            }
        },
    },
    {
        key: 'holderRewards',
        build: f => {
            const href = workspaceHref(f.denom, 'rewards')
            const title = VOCABULARY.holderRewards.name
            if (f.denomReward === 'error') {
                return { title, detail: "Couldn't check the compounded reward.", state: 'unknown', href }
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
                action: { label: 'Open', href },
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
            const href = withReturn(`/market/new?base=${encodeURIComponent(f.denom)}`, backTo(f))
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

// Short hints for token lists (/tokens and the home strip), by item key and state.
/** The chips of the token page, in order, with their short names (canvas D2). */
const CHIPS: { key: string; label: string; section: TokenSection; needsAdmin?: boolean }[] = [
    { key: 'created', label: 'Created', section: 'supply' },
    { key: 'pool', label: 'Pool', section: 'trading' },
    { key: 'holderRewards', label: 'Stakable', section: 'rewards' },
    { key: 'registry', label: 'Logo in wallets', section: 'details' },
    { key: 'brandKit', label: 'Brand kit', section: 'details', needsAdmin: true },
]

export interface SetupChip {
    key: string;
    label: string;
    /** done ✓, todo ○ (partial counts as todo), unknown (the check failed), impossible (admin given up). */
    state: 'done' | 'todo' | 'unknown' | 'impossible';
    /** The page section that holds the chip's action. */
    section: TokenSection;
    /** Shown after the label: "Admin only" for an admin item the wallet can't do, "admin given up". */
    note?: string;
}

/**
 * The setup chips: "Getting there · 3 of 5". Shown to everyone (the facts are public); an admin-only
 * item still to do says "Admin only" unless the wallet is the admin. Items left out by the checklist
 * (the registry on testnet) are left out here too, and impossible ones don't count.
 */
export function setupChips(items: ReadonlyArray<SetupItem>, isAdmin: boolean) {
    const chips = CHIPS.flatMap((chip): SetupChip[] => {
        const item = items.find(i => i.key === chip.key)
        if (!item) return []
        const state = item.state === 'partial' ? 'todo' : item.state
        const note = state === 'impossible'
            ? 'admin given up'
            : state === 'todo' && chip.needsAdmin && !isAdmin ? 'Admin only' : undefined
        return [{ key: chip.key, label: chip.label, state, section: chip.section, note }]
    })
    const counted = chips.filter(c => c.state !== 'impossible')
    const doneCount = counted.filter(c => c.state === 'done').length
    return { chips, doneCount, totalCount: counted.length }
}
