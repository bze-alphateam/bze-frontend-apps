import type { MultiSendDraft } from '@/lib/multisend'
import { isRunDone, type MultiSendRun } from '@/lib/multisend-run'
import { TOKEN_FORM_KEYS, type TokenDraft } from '@/lib/token-draft'

// The home's one-line "Continue …" hint: the wizard this browser last saved progress in, once at
// least one of its steps is finished. It reads the drafts the wizards already keep and changes
// nothing else on the page. Pure, so every rule is a unit test.

/** A stored draft and when it was last saved, in ms (0 when unknown). */
export interface Saved<T> {
    value: T;
    savedAt: number;
}

/** The three localStorage entries as their loaders return them, with their save time. */
export interface StoredWizards {
    token?: Saved<TokenDraft>;
    multisendDraft?: Saved<MultiSendDraft>;
    multisendRun?: Saved<MultiSendRun>;
}

export interface WizardHint {
    /** One per wizard and save: a dismissed hint comes back only after new progress. */
    key: string;
    /** "Continue creating BEE" */
    label: string;
    /** The step the wizard opens on. */
    step: number;
    total: number;
    href: string;
    savedAt: number;
}

/** Details, Supply, Permissions + Review. */
const TOKEN_STEPS = TOKEN_FORM_KEYS.length + 1

/** Who, Token, List + Review (the list flow of Airdrop coins). */
const MULTISEND_STEPS = 4

function tokenHint(saved: Saved<TokenDraft>): WizardHint | undefined {
    const { form, answered } = saved.value
    if (answered.length === 0) return undefined
    const ticker = form.symbol.trim()
    return {
        key: `token:${saved.savedAt}`,
        label: ticker ? `Continue creating ${ticker}` : 'Continue creating your token',
        step: Math.min(answered.length + 1, TOKEN_STEPS),
        total: TOKEN_STEPS,
        href: '/token/new',
        savedAt: saved.savedAt,
    }
}

/**
 * The multi-send wizard reopens on Review while a run has batches left to send, and on the list
 * once a token is picked. A finished run is history, not work left.
 */
function multisendHint(stored: StoredWizards): WizardHint | undefined {
    const run = stored.multisendRun
    const pick = run && run.value.batches.length > 0 && !isRunDone(run.value)
        ? { step: 4, savedAt: run.savedAt }
        : stored.multisendDraft?.value.denom
            ? { step: 3, savedAt: stored.multisendDraft.savedAt }
            : undefined
    if (!pick) return undefined
    return {
        key: `multisend:${pick.savedAt}`,
        label: 'Continue your airdrop to a list of wallets',
        step: pick.step,
        total: MULTISEND_STEPS,
        href: '/airdrop?to=list',
        savedAt: pick.savedAt,
    }
}

/** The most recently saved wizard with a finished step; on a tie, the token wizard. */
export function lastWizard(stored: StoredWizards): WizardHint | undefined {
    const hints = [stored.token && tokenHint(stored.token), multisendHint(stored)]
        .filter((h): h is WizardHint => h !== undefined)
    return hints.reduce<WizardHint | undefined>((latest, h) => (!latest || h.savedAt > latest.savedAt ? h : latest), undefined)
}
