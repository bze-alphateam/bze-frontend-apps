'use client'

import { useSyncExternalStore } from 'react'
import { getFromLocalStorage, getKeyExpiry, setInLocalStorage } from '@bze/bze-ui-kit'
import { lastWizard, type Saved, type StoredWizards, type WizardHint } from '@/lib/last-wizard'
import { MULTISEND_DRAFT_KEY, MULTISEND_DRAFT_TTL, loadMultiSendDraft } from '@/lib/multisend'
import { MULTISEND_RUN_KEY, MULTISEND_RUN_TTL, loadMultiSendRun } from '@/lib/multisend-run'
import { TOKEN_DRAFT_KEY, TOKEN_DRAFT_TTL, loadTokenDraft } from '@/lib/token-draft'

const DISMISSED_KEY = 'factory_home_hint_dismissed'
const DISMISSED_TTL = 30 * 24 * 60 * 60

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

/** When the entry was saved: its expiry minus the TTL it was saved with. */
function savedAt(key: string, ttl: number): number {
    const expiry = getKeyExpiry(key)
    return expiry ? expiry.getTime() - ttl * 1000 : 0
}

function saved<T>(value: T | undefined, key: string, ttl: number): Saved<T> | undefined {
    return value === undefined ? undefined : { value, savedAt: savedAt(key, ttl) }
}

// The hint is cached on the raw entries, so the snapshot keeps its identity between renders
// until something in storage really changes.
let cache: { raw: string; hint: WizardHint | undefined } | undefined

function readHint(): WizardHint | undefined {
    const keys = [TOKEN_DRAFT_KEY, MULTISEND_DRAFT_KEY, MULTISEND_RUN_KEY]
    const raw = JSON.stringify([...keys.map(k => [getFromLocalStorage(k), getKeyExpiry(k)?.getTime()]), getFromLocalStorage(DISMISSED_KEY)])
    if (cache?.raw !== raw) {
        const stored: StoredWizards = {
            token: saved(loadTokenDraft(), TOKEN_DRAFT_KEY, TOKEN_DRAFT_TTL),
            multisendDraft: saved(loadMultiSendDraft(), MULTISEND_DRAFT_KEY, MULTISEND_DRAFT_TTL),
            multisendRun: saved(loadMultiSendRun(), MULTISEND_RUN_KEY, MULTISEND_RUN_TTL),
        }
        const hint = lastWizard(stored)
        cache = { raw, hint: hint && hint.key !== getFromLocalStorage(DISMISSED_KEY) ? hint : undefined }
    }
    return cache.hint
}

/**
 * The home's "Continue …" hint from the drafts this browser keeps; none on the server, so the
 * first render matches it. Dismissing hides it until that wizard saves new progress.
 */
export function useLastWizard(): { hint: WizardHint | undefined; dismiss: () => void } {
    const hint = useSyncExternalStore(subscribe, readHint, () => undefined)
    const dismiss = () => {
        if (!hint) return
        setInLocalStorage(DISMISSED_KEY, hint.key, DISMISSED_TTL)
        listeners.forEach(l => l())
    }
    return { hint, dismiss }
}
