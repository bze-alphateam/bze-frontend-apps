'use client'

import { useCallback, useEffect, useState } from 'react'
import {
    DenomReward,
    DenomRewardPrize,
    DenomRewardSchedule,
    getDenomReward,
    getDenomRewardPrizes,
    getDenomRewardSchedules,
} from '@bze/bze-ui-kit'

interface DenomRewardState {
    /** The DR of the denom; undefined when it has none (or before the first load). */
    denomReward?: DenomReward;
    schedules: DenomRewardSchedule[];
    /** Every prize denom ever used on the DR — what the prize cap counts. */
    prizes: DenomRewardPrize[];
    /** The queries failed (node down, or a node older than v8.2.0) — the DR state is unknown. */
    hasError: boolean;
}

const EMPTY: DenomRewardState = { schedules: [], prizes: [], hasError: false }

async function loadDenomReward(denom: string): Promise<DenomRewardState> {
    try {
        const denomReward = await getDenomReward(denom)
        if (!denomReward) {
            return EMPTY
        }
        const [schedules, prizes] = await Promise.all([getDenomRewardSchedules(denom), getDenomRewardPrizes(denom)])
        return { denomReward, schedules, prizes, hasError: false }
    } catch (e) {
        console.error('failed to load the denom reward of', denom, e)
        return { ...EMPTY, hasError: true }
    }
}

/**
 * The denom reward of `denom` with its schedules and prize entries, read straight from the chain
 * (`refresh` after every create/schedule/extend tx, and right before signing where the state
 * matters; it also returns what it read). An error is reported as `hasError`, never as
 * "no denom reward", so the UI never offers to create a DR that may already exist. A picked
 * denom that changes is loading until its own answer arrives: the previous one's never shows.
 */
export function useDenomReward(denom: string) {
    const [loaded, setLoaded] = useState<DenomRewardState & { denom: string }>({ ...EMPTY, denom: '' })

    useEffect(() => {
        if (!denom) return
        let cancelled = false

        loadDenomReward(denom).then(result => {
            if (cancelled) return
            setLoaded({ ...result, denom })
        })

        return () => { cancelled = true }
    }, [denom])

    const refresh = useCallback(async (): Promise<DenomRewardState | undefined> => {
        if (!denom) return undefined
        const result = await loadDenomReward(denom)
        setLoaded({ ...result, denom })
        return result
    }, [denom])

    const isCurrent = loaded.denom === denom
    const { denomReward, schedules, prizes, hasError } = isCurrent ? loaded : EMPTY
    return { denomReward, schedules, prizes, hasError, isLoading: Boolean(denom) && !isCurrent, refresh }
}
