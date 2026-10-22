'use client'

import { useEffect, useState } from 'react'
import { DenomRewardPrize, DenomRewardSchedule, getDenomRewardPrizes, getDenomRewardSchedules } from '@bze/bze-ui-kit'

export interface DenomRewardDetails {
    prizes: DenomRewardPrize[];
    /** Running daily prizes (the chain deletes finished schedules). */
    schedules: DenomRewardSchedule[];
}

/** Per staking denom: missing = still loading, null = the queries failed. */
export type DenomRewardDetailsMap = Record<string, DenomRewardDetails | null>

/**
 * Prizes and running daily prizes of every listed compounded reward: one prizes + schedules query
 * per DR, each card filled in as its answer arrives.
 */
export function useDenomRewardDetails(denoms: ReadonlyArray<string>): DenomRewardDetailsMap {
    const key = denoms.join('\n')
    const [state, setState] = useState<{ key: string; map: DenomRewardDetailsMap }>({ key: '', map: {} })

    useEffect(() => {
        let cancelled = false
        const list = key ? key.split('\n') : []
        list.forEach(denom => {
            Promise.all([getDenomRewardPrizes(denom), getDenomRewardSchedules(denom)])
                .then(([prizes, schedules]): DenomRewardDetails => ({ prizes, schedules }))
                .catch(e => {
                    console.error('failed to load the denom reward prizes of', denom, e)
                    return null
                })
                .then(value => {
                    if (cancelled) return
                    setState(prev => ({ key, map: { ...(prev.key === key ? prev.map : {}), [denom]: value } }))
                })
        })
        return () => { cancelled = true }
    }, [key])

    return state.key === key ? state.map : {}
}
