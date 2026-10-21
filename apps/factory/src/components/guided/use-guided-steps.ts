'use client'

import { useCallback, useMemo, useState } from 'react'

export type StepState = 'active' | 'done' | 'todo'

/**
 * Which way the wizard last moved: `forward` (the new step slides in from below) or `back`
 * (going back or editing an earlier step: it slides in from above).
 */
export type StepDirection = 'forward' | 'back'

/** What a step card needs from the hook: spread `steps.step(key)` onto a <Question>. */
export interface StepProps {
    number: number;
    total: number;
    state: StepState;
    direction: StepDirection;
    /** Reopens the step (the Edit button of a done row). */
    onEdit: () => void;
}

/**
 * The state of each question of a guided form. The active question is the first one
 * without a valid answer, unless the user reopened an answered one with `open(key)`;
 * reopening keeps the later answers. `close()` collapses the reopened question again (call
 * it once the new answer is in), so the next unanswered question becomes active. An answer
 * that becomes invalid makes its question unanswered, so it turns active again.
 *
 * `direction` says which way the active step last moved, for the step cards' slide.
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

    // The direction is derived while rendering from the previous active step (React's
    // "store information from previous renders" pattern), so it is right on the very render
    // that opens the new step.
    const [moved, setMoved] = useState<{ from: K | undefined; direction: StepDirection }>({ from: active, direction: 'forward' })
    let direction = moved.direction
    if (moved.from !== active) {
        const before = moved.from === undefined ? -1 : keys.indexOf(moved.from)
        const now = active === undefined ? -1 : keys.indexOf(active)
        direction = before >= 0 && now >= 0 && now < before ? 'back' : 'forward'
        setMoved({ from: active, direction })
    }

    const state = useMemo(() => {
        const out = {} as Record<K, StepState>
        for (const k of keys) {
            out[k] = k === active ? 'active' : isAnswered[k] ? 'done' : 'todo'
        }
        return out
    }, [keys, isAnswered, active])

    const open = useCallback((key: K) => setReopened(key), [])
    const close = useCallback(() => setReopened(undefined), [])

    /** Reopens the step before the active one (the "↑ Back" of a step card). */
    const back = useCallback(() => {
        const i = active === undefined ? -1 : keys.indexOf(active)
        if (i > 0) setReopened(keys[i - 1])
    }, [keys, active])

    const step = useCallback((key: K): StepProps => ({
        number: keys.indexOf(key) + 1,
        total: keys.length,
        state: state[key],
        direction,
        onEdit: () => setReopened(key),
    }), [keys, state, direction])

    return { state, active, direction, open, close, back, step }
}
