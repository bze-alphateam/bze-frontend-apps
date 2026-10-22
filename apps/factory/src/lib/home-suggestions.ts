import { compoundedNewHref, scheduleFormHref } from '@/lib/denom-reward'
import type { MultiSendDraft } from '@/lib/multisend'
import { isRunDone, type MultiSendRun } from '@/lib/multisend-run'
import { TOKEN_FORM_KEYS, type TokenDraft, type TokenFormStep } from '@/lib/token-draft'

// The connected home's "Pick up where you left off" (BFE-275, canvas A2). Two sources only: drafts
// saved in this browser, and the chain state of the tokens the wallet created. No indexed data, and
// nothing about rewards someone "funded" (the chain records no funder). Pure, so every rule is a
// unit test.

/** At most this many cards, drafts first. */
export const MAX_HOME_CARDS = 3

/** Only the first tokens get their chain facts read, so the home stays cheap. */
export const MAX_SUGGESTED_TOKENS = 3

/** A daily prize that pays for this many days or fewer is about to stop. */
export const PRIZE_ENDING_DAYS = 7

/** Draft + Review: the token wizard always has four steps. */
const TOKEN_WIZARD_STEPS = TOKEN_FORM_KEYS.length + 1

const STEP_NAMES: Record<TokenFormStep, string> = {
    details: 'Details',
    supply: 'Supply',
    permissions: 'Permissions',
}

/** What this browser keeps, already read from localStorage. */
export interface HomeDrafts {
    /** The Create token draft: its ticker (may be empty) and the steps already finished. */
    token?: { ticker: string; answered: ReadonlyArray<TokenFormStep> };
    /** A multi-send run with batches still to send. */
    multisendRun?: { ticker: string; logo?: string; stoppedAt: number; batches: number };
    /** A multi-send list that was never sent. */
    multisendDraft?: { ticker: string; logo?: string };
}

/** The three localStorage entries as their loaders return them. */
export interface StoredDrafts {
    token?: TokenDraft;
    multisendDraft?: MultiSendDraft;
    multisendRun?: MultiSendRun;
}

/**
 * What the cards need from the stored drafts. A finished run is history, not work left; an empty
 * multi-send list is no draft.
 */
export function homeDrafts(
    stored: StoredDrafts,
    token: (denom: string) => { ticker: string; logo?: string },
): HomeDrafts {
    const drafts: HomeDrafts = {}
    if (stored.token) {
        drafts.token = { ticker: stored.token.form.symbol, answered: stored.token.answered }
    }
    const run = stored.multisendRun
    if (run && run.batches.length > 0 && !isRunDone(run)) {
        const stopped = run.batches.find(b => b.status !== 'sent')
        drafts.multisendRun = { ...token(run.denom), stoppedAt: stopped?.id ?? 1, batches: run.batches.length }
    }
    const list = stored.multisendDraft
    if (list && list.text.trim() !== '') {
        drafts.multisendDraft = list.denom ? token(list.denom) : { ticker: '' }
    }
    return drafts
}

export interface HomeToken {
    denom: string;
    ticker: string;
    logo?: string;
}

/** The chain facts of one token, as far as the rules need them. */
export interface TokenFacts {
    /** Pools with the token on either side; `pair` reads from the token's side ("HONEY/BZE"). */
    pools: ReadonlyArray<{ pair: string; lpDenom: string; isNativePair: boolean }>;
    /** Staking denoms of the simple rewards still paying. */
    runningSimpleRewards: ReadonlyArray<string>;
    /** The token's compounded reward, or undefined when it is not stakable. */
    compounded?: {
        /** "1,200" — staked amount, formatted. */
        stakedLabel: string;
        schedules: ReadonlyArray<{ id: string; daysLeft: number }>;
    };
}

/** Per denom: the facts, still loading, or failed (the token is skipped, never guessed). */
export type TokenFactsState = TokenFacts | 'loading' | 'error'

export type HomeCardKind = 'tokenDraft' | 'multisendRun' | 'multisendDraft' | 'noPool' | 'noLpReward' | 'prizeEnding' | 'notStakable'

export interface HomeCard {
    key: string;
    kind: HomeCardKind;
    avatar: { ticker: string; logo?: string };
    subject: string;
    state: string;
    /** The token draft's place in the wizard, drawn as a segmented bar. */
    progress?: { step: number; total: number };
    why: string;
    action: { label: string; href: string };
    /** The gold card: an unfinished token. */
    primary: boolean;
}

export interface HomeSuggestions {
    cards: HomeCard[];
    /** Tokens whose facts are still loading and could still fill a free slot: shimmer cards. */
    pending: number;
}

/** "Supply, Permissions and Review" */
function listNames(names: string[]): string {
    if (names.length <= 1) return names.join('')
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function tokenDraftCard(draft: NonNullable<HomeDrafts['token']>): HomeCard {
    const ticker = draft.ticker.trim()
    const left = TOKEN_FORM_KEYS.filter(k => !draft.answered.includes(k))
    const step = TOKEN_WIZARD_STEPS - left.length
    const names = [...left.map(k => STEP_NAMES[k]), 'Review']
    return {
        key: 'token-draft',
        kind: 'tokenDraft',
        avatar: { ticker: ticker || '?' },
        subject: ticker ? `Unfinished: ${ticker} token` : 'Unfinished token',
        state: `Draft · step ${step} of ${TOKEN_WIZARD_STEPS} · saved in this browser`,
        progress: { step, total: TOKEN_WIZARD_STEPS },
        why: `${listNames(names)} ${names.length === 1 ? 'is' : 'are'} left. Everything you typed is still there.`,
        action: { label: ticker ? `Continue creating ${ticker}` : 'Continue creating your token', href: '/token/new' },
        primary: true,
    }
}

function multisendCard(drafts: HomeDrafts): HomeCard | undefined {
    const run = drafts.multisendRun
    if (run) {
        return {
            key: 'multisend-run',
            kind: 'multisendRun',
            avatar: { ticker: run.ticker, logo: run.logo },
            subject: `Sending ${run.ticker} to a list of wallets`,
            state: `Batch ${run.stoppedAt} of ${run.batches} stopped`,
            why: 'The batches already sent stay sent. Resume to send the rest.',
            action: { label: 'Resume sending', href: '/multisend' },
            primary: false,
        }
    }
    const draft = drafts.multisendDraft
    if (!draft) return undefined
    const ticker = draft.ticker.trim()
    return {
        key: 'multisend-draft',
        kind: 'multisendDraft',
        avatar: { ticker: ticker || '?', logo: draft.logo },
        subject: ticker ? `Your ${ticker} list` : 'Your list of wallets',
        state: 'Not sent yet · saved in this browser',
        why: 'Your list of wallets is still there. Check it and send it when you are ready.',
        action: { label: 'Continue your list', href: '/multisend' },
        primary: false,
    }
}

/** The first rule that matches the token, or undefined when it needs nothing. */
export function tokenSuggestion(token: HomeToken, facts: TokenFacts): HomeCard | undefined {
    const t = token.ticker
    const avatar = { ticker: t, logo: token.logo }
    const base = { avatar, primary: false }

    if (facts.pools.length === 0) {
        return {
            ...base,
            key: `${token.denom}:noPool`,
            kind: 'noPool',
            subject: t,
            state: 'No market yet',
            why: `Nobody can buy ${t} yet. A ${t}/BZE pool lets people swap from the first minute.`,
            action: { label: `Create a ${t}/BZE pool`, href: `/pool/new?base=${encodeURIComponent(token.denom)}` },
        }
    }

    const rewarded = facts.pools.some(p => facts.runningSimpleRewards.includes(p.lpDenom))
    if (!rewarded) {
        const pool = facts.pools.find(p => p.isNativePair) ?? facts.pools[0]
        return {
            ...base,
            key: `${token.denom}:noLpReward`,
            kind: 'noLpReward',
            subject: t,
            state: `Pool ${pool.pair} · no staking rewards`,
            why: `People hold ${pool.pair} pool shares but earn nothing for keeping them. A simple reward pays them to stay.`,
            action: { label: `Reward ${pool.pair} liquidity`, href: `/reward/new?staking=${encodeURIComponent(pool.lpDenom)}` },
        }
    }

    const compounded = facts.compounded
    const ending = compounded?.schedules
        .filter(s => s.daysLeft > 0 && s.daysLeft <= PRIZE_ENDING_DAYS)
        .sort((a, b) => a.daysLeft - b.daysLeft)[0]
    if (compounded && ending) {
        return {
            ...base,
            key: `${token.denom}:prizeEnding`,
            kind: 'prizeEnding',
            subject: `${t} compounded reward`,
            state: `Daily prize ends in ${ending.daysLeft} day${ending.daysLeft === 1 ? '' : 's'}`,
            why: `${compounded.stakedLabel} ${t} is staked. Extend the daily prize before it stops.`,
            action: { label: 'Extend the daily prize', href: scheduleFormHref(token.denom, ending.id) },
        }
    }

    if (!compounded) {
        return {
            ...base,
            key: `${token.denom}:notStakable`,
            kind: 'notStakable',
            subject: t,
            state: 'Not stakable yet',
            why: `Make ${t} stakable so holders have a reason to keep it.`,
            action: { label: `Make ${t} stakable`, href: compoundedNewHref(token.denom) },
        }
    }

    return undefined
}

/**
 * The cards, in priority order: the unfinished token draft, the multi-send run (or its unsent list),
 * then one suggestion per created token, at most MAX_HOME_CARDS in all. Admin state plays no part:
 * every suggestion is permissionless, so a renounced token gets them too, and Renounce or Transfer
 * admin is never suggested (BFE-257 decision 7).
 */
export function suggestions(
    drafts: HomeDrafts,
    tokens: ReadonlyArray<HomeToken>,
    facts: Readonly<Record<string, TokenFactsState | undefined>>,
): HomeSuggestions {
    const cards: HomeCard[] = []
    if (drafts.token) cards.push(tokenDraftCard(drafts.token))
    const multisend = multisendCard(drafts)
    if (multisend) cards.push(multisend)

    let pending = 0
    for (const token of tokens.slice(0, MAX_SUGGESTED_TOKENS)) {
        if (cards.length + pending >= MAX_HOME_CARDS) break
        const state = facts[token.denom] ?? 'loading'
        if (state === 'loading') {
            pending++
            continue
        }
        if (state === 'error') continue
        const card = tokenSuggestion(token, state)
        if (card) cards.push(card)
    }

    return { cards: cards.slice(0, MAX_HOME_CARDS), pending }
}
