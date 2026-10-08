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
 * (`refresh` after every create/schedule/extend tx). An error is reported as `hasError`, never as
 * "no denom reward", so the UI never offers to create a DR that may already exist.
 */
export function useDenomReward(denom: string) {
    const [state, setState] = useState<DenomRewardState>(EMPTY)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!denom) return
        let cancelled = false

        loadDenomReward(denom).then(result => {
            if (cancelled) return
            setState(result)
            setIsLoading(false)
        })

        return () => { cancelled = true }
    }, [denom])

    const refresh = useCallback(async () => {
        if (!denom) return
        setState(await loadDenomReward(denom))
    }, [denom])

    return { ...state, isLoading: Boolean(denom) && isLoading, refresh }
}
