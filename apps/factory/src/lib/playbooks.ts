import { getFromLocalStorage, setInLocalStorage } from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { withReturn } from '@/components/guided/return-to'
import { denomRewardHref } from '@/lib/denom-reward'
import type { GoalId } from '@/lib/goals'
import { officialHref } from '@/lib/registry-entry'
import { reachHref } from '@/lib/reach'
import { isStakingRewardFinished, programInvolves } from '@/lib/staking-rewards'
import type { SetupItem } from '@/lib/token-setup'
import { workspaceHref } from '@/lib/workspace'

// Playbooks for newcomers (BFE-169): proven recipes that chain goals step by step. Which steps are
// done is read from the chain on every visit (useTokenSetup); only the steps the chain can't show
// (a gift to another community) are stored, in this browser, with the chosen token.

export type PlaybookId = 'launch' | 'noticed' | 'lps'

export const PLAYBOOKS_PATH = '/playbooks'

/** What the chain says about the chosen token, for the step detection. */
export interface PlaybookFacts {
    /** The chosen token; undefined before one is chosen. */
    denom?: string;
    /** useTokenSetup's checklist of the chosen token. */
    items: Pick<SetupItem, 'key' | 'state'>[];
    /** From useMyTokens: an address, '' when renounced, undefined when unknown. */
    admin?: string;
    /** LP token of the token's first pool, for the LP campaign. */
    lpDenom?: string;
    /** A running staking program pays people staking an LP token of the token's pools. */
    lpCampaign: boolean;
}

export interface PlaybookStep {
    goalId: GoalId;
    /** Short name in the home card's chain ("Create → Pool → …"). */
    short: string;
    title: string;
    why: string;
    /** The sentence a done step collapses to. */
    doneText: string;
    /** The button to the goal's form. */
    action: string;
    /** The step opens a form about the chosen token, so it waits for one. Default true. */
    needsToken?: boolean;
    /** Done according to the chain; undefined = the chain can't tell, the user marks it done. */
    detect?: (facts: PlaybookFacts) => boolean | undefined;
    href: (facts: PlaybookFacts) => string;
}

export interface Playbook {
    id: PlaybookId;
    title: string;
    pitch: string;
    time: string;
    /** "Done. <TICKER> now <outcome>." */
    outcome: string;
    steps: PlaybookStep[];
}

const itemDone = (key: string) => (facts: PlaybookFacts) => {
    const item = facts.items.find(i => i.key === key)
    // Not in the checklist (the registry on testnet): the chain can't tell.
    return item ? item.state === 'done' : undefined
}

const enc = encodeURIComponent

const POOL_STEP: PlaybookStep = {
    goalId: 'pool', short: 'Pool', title: 'Let people buy and sell it',
    why: 'A pool with BZE gives the token a price and lets anyone swap it.',
    doneText: 'It has a pool, so people can buy and sell it.',
    action: 'Create a pool',
    detect: itemDone('pool'),
    href: f => `/pool/new?base=${enc(f.denom ?? '')}`,
}

const STAKABLE_STEP: PlaybookStep = {
    goalId: 'stakable', short: 'Stakable', title: 'Make it stakable',
    why: 'Holders stake it and share a daily prize you fund, so they keep it longer.',
    doneText: 'Holders can stake it and a daily prize is running.',
    action: 'Set up holder rewards',
    detect: itemDone('holderRewards'),
    href: f => denomRewardHref(f.denom ?? ''),
}

export const PLAYBOOKS: Playbook[] = [
    {
        id: 'launch',
        title: 'Launch a community token',
        pitch: 'From nothing to a token people can buy, stake and find in their wallets.',
        time: '5 steps · about 20 min + registry review',
        outcome: 'trades, rewards its stakers and is on its way into every wallet.',
        steps: [
            {
                goalId: 'createToken', short: 'Create', title: 'Create my token',
                why: 'Name, ticker and supply. The whole supply is minted to you.',
                doneText: 'The token exists.',
                action: 'Create my token',
                needsToken: false,
                detect: f => Boolean(f.denom),
                href: () => '/token/new',
            },
            POOL_STEP,
            { ...STAKABLE_STEP, why: 'Holders stake it and share a daily prize: create the holder rewards, then start a daily prize.' },
            {
                goalId: 'registry', short: 'Logo', title: 'Get my logo in every wallet',
                why: 'Without the Cosmos Chain Registry, wallets show a long factory/… code and no logo.',
                doneText: 'It is listed in the Cosmos Chain Registry.',
                action: 'Open the registry guide',
                detect: itemDone('registry'),
                href: f => officialHref(f.denom ?? ''),
            },
            {
                goalId: 'lock', short: 'Lock', title: 'Prove the supply is fixed',
                why: 'Locking the supply shows nobody can mint more. Do it last: it cannot be undone.',
                doneText: 'The supply is locked for good.',
                action: 'Review and lock',
                detect: f => f.admin === '',
                href: f => `${workspaceHref(f.denom ?? '', 'control')}&lock=1`,
            },
        ],
    },
    {
        id: 'noticed',
        title: 'Get noticed by another community',
        pitch: 'Gift your token to people staking a bigger token, so they discover yours.',
        time: '2 steps · about 5 min',
        outcome: 'is in the wallets of another community, and they can stake it.',
        steps: [
            {
                goalId: 'reach', short: 'Gift', title: 'Pick a community and gift',
                why: 'Your token lands in the wallets of everyone staking theirs, split by stake.',
                doneText: 'You sent a gift to another community.',
                action: 'Pick a community',
                needsToken: false,
                href: f => reachHref({ gift: f.denom }),
            },
            { ...STAKABLE_STEP, title: 'Make yours stakable', why: 'The people you reached can stake what they got and earn more of it.' },
        ],
    },
    {
        id: 'lps',
        title: 'Reward liquidity providers',
        pitch: 'Pay people who add to your pool, so trading stays smooth.',
        time: '2 steps · about 5 min',
        outcome: 'pays the people who add to its pool.',
        steps: [
            { ...POOL_STEP, why: 'Skip this when the token already has a pool.' },
            {
                goalId: 'campaign', short: 'Campaign', title: 'Run a 30-day campaign on the LP token',
                why: 'People who add to the pool stake their LP tokens and earn your token.',
                doneText: `A campaign pays the pool's liquidity providers.`,
                action: 'Start the campaign',
                detect: f => f.lpCampaign,
                href: f => (f.lpDenom ? `/reward/new?staking=${enc(f.lpDenom)}` : '/reward/new'),
            },
        ],
    },
]

export const playbookById = (id: string | null | undefined): Playbook | undefined => PLAYBOOKS.find(p => p.id === id)

/** `/playbooks?id=…`, with the chosen token and the step a form returns to. */
export function playbookHref(id: PlaybookId, denom?: string, step?: GoalId): string {
    const q = new URLSearchParams({ id })
    if (denom) q.set('denom', denom)
    if (step) q.set('step', step)
    return `${PLAYBOOKS_PATH}?${q.toString()}`
}

export const PLAYBOOK_RETURN_LABEL = 'the playbook'

/**
 * The step's button: its form, with the way back to the playbook. Creating the token returns to
 * the bare playbook: the launch screen adds the new denom and the step itself.
 */
export function stepHref(playbook: Playbook, step: PlaybookStep, facts: PlaybookFacts): string {
    const back = step.goalId === 'createToken'
        ? playbookHref(playbook.id)
        : playbookHref(playbook.id, facts.denom, step.goalId)
    return withReturn(step.href(facts), { href: back, label: PLAYBOOK_RETURN_LABEL })
}

/** Where the launch screen sends a playbook back to, once the token exists. */
export function createdReturnHref(returnHref: string, denom: string): string {
    const q = new URLSearchParams({ denom, step: 'createToken', completed: '1' })
    return `${returnHref}${returnHref.includes('?') ? '&' : '?'}${q.toString()}`
}

export type StepState = 'done' | 'current' | 'later'

export interface StepStatus {
    step: PlaybookStep;
    state: StepState;
    /** The chain can't tell: "Mark as done" is offered. */
    manual: boolean;
}

/** Each step's state: done (chain or marked), the first undone one is current, the rest later. */
export function stepStatuses(playbook: Playbook, facts: PlaybookFacts, manualDone: readonly string[]): StepStatus[] {
    let currentSeen = false
    return playbook.steps.map(step => {
        const detected = step.detect?.(facts)
        const manual = detected === undefined
        const done = detected === true || manualDone.includes(step.goalId)
        let state: StepState = 'done'
        if (!done) {
            state = currentSeen ? 'later' : 'current'
            currentSeen = true
        }
        return { step, state, manual }
    })
}

/** True when a running staking program pays people staking an LP token of `denom`'s pools. */
export function hasRunningLpCampaign(
    programs: ReadonlyArray<Pick<StakingRewardSDKType, 'staking_denom' | 'prize_denom' | 'payouts' | 'duration'>>,
    denom: string,
    pools: ReadonlyArray<{ lp_denom: string; base: string; quote: string }>,
): boolean {
    return programs.some(p =>
        !isStakingRewardFinished(p)
        && pools.some(pool => pool.lp_denom === p.staking_denom)
        && programInvolves(p, denom, pools))
}

export interface PlaybookProgress {
    denom?: string;
    /** Steps marked done by the user or by a form's success panel; never chain states. */
    manualDone: string[];
}

export const playbookProgressKey = (id: PlaybookId) => `factory_playbook_${id}`

/** Stored progress (the raw localStorage value); undefined when absent or unreadable. */
export function parsePlaybookProgress(raw: string | null | undefined): PlaybookProgress | undefined {
    if (!raw) return undefined
    try {
        const parsed = JSON.parse(raw) as Partial<PlaybookProgress>
        return {
            denom: typeof parsed.denom === 'string' && parsed.denom ? parsed.denom : undefined,
            manualDone: Array.isArray(parsed.manualDone) ? parsed.manualDone.filter((s): s is string => typeof s === 'string') : [],
        }
    } catch {
        return undefined
    }
}

/** undefined: the playbook was never started in this browser. */
export function loadPlaybookProgress(id: PlaybookId): PlaybookProgress | undefined {
    return parsePlaybookProgress(getFromLocalStorage(playbookProgressKey(id)))
}

/** No expiry: a playbook can take weeks (the registry review). */
export function savePlaybookProgress(id: PlaybookId, progress: PlaybookProgress): void {
    setInLocalStorage(playbookProgressKey(id), JSON.stringify(progress), 0)
}

/** Another token starts the playbook over: what was marked done was for the previous one. */
export function chooseToken(progress: PlaybookProgress | undefined, denom: string): PlaybookProgress {
    if (progress?.denom === denom) return progress
    return { denom, manualDone: progress?.denom ? [] : (progress?.manualDone ?? []) }
}

export function markDone(progress: PlaybookProgress | undefined, step: string): PlaybookProgress {
    const base = progress ?? { manualDone: [] }
    return base.manualDone.includes(step) ? base : { ...base, manualDone: [...base.manualDone, step] }
}

/**
 * The progress after landing on the page: the URL's token is adopted, and a step returned to
 * with `completed=1` (a form's success panel) is marked done. A plain back link marks nothing.
 */
export function progressOnLoad(
    stored: PlaybookProgress | undefined,
    params: { denom?: string | null; step?: string | null; completed?: string | null },
    playbook: Playbook,
): PlaybookProgress | undefined {
    let progress = stored
    if (params.denom) progress = chooseToken(progress, params.denom)
    const step = params.step
    if (step && params.completed === '1' && playbook.steps.some(s => s.goalId === step)) {
        progress = markDone(progress, step)
    }
    return progress
}
