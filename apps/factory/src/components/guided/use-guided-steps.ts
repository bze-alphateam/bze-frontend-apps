'use client'

import { useCallback, useMemo, useState } from 'react'

export type StepState = 'active' | 'done' | 'todo'

/**
 * The state of each question of a guided form. The active question is the first one
 * without a valid answer, unless the user reopened an answered one with `open(key)`;
 * reopening keeps the later answers. `close()` collapses the reopened question again (call
 * it once the new answer is in), so the next unanswered question becomes active. An answer
 * that becomes invalid makes its question unanswered, so it turns active again.
 */
export function useGuidedSteps<K extends string>(keys: readonly K[], isAnswered: Record<K, boolean>) {
    const [reopened, setReopened] = useState<K | undefined>(undefined)

    const active = useMemo(() => {
        const firstUnanswered = keys.find(k => !isAnswered[k])
        if (reopened === undefined || !keys.includes(reopened)) return firstUnanswered
        // An earlier question lost its answer: it wins over the reopened one.
        if (firstUnanswered !== undefined && keys.indexOf(firstUnanswered) < keys.indexOf(reopened)) {
            return firstUnanswered
        }
        return reopened
    }, [keys, isAnswered, reopened])

    const state = useMemo(() => {
        const out = {} as Record<K, StepState>
        for (const k of keys) {
            out[k] = k === active ? 'active' : isAnswered[k] ? 'done' : 'todo'
        }
        return out
    }, [keys, isAnswered, active])

    const open = useCallback((key: K) => setReopened(key), [])
    const close = useCallback(() => setReopened(undefined), [])

    return { state, active, open, close }
}
