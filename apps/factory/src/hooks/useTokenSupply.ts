'use client'

import { useCallback, useEffect, useState } from 'react'
import { getRestClient } from '@bze/bze-ui-kit'

/**
 * Live total supply of a denom (u-amount string), fetched directly from the
 * bank module so manage actions (mint/burn) can show the effect immediately —
 * the assets context refreshes on its own slower cadence.
 */
export function useTokenSupply(denom: string) {
    const [supply, setSupply] = useState<string | undefined>(undefined)
    const [isLoading, setIsLoading] = useState(true)

    const fetchSupply = useCallback(async () => {
        if (!denom) return undefined
        try {
            const client = await getRestClient()
            const res = await client.cosmos.bank.v1beta1.supplyOf({ denom })
            return res.amount?.amount
        } catch (e) {
            console.error('failed to fetch supply of', denom, e)
            return undefined
        }
    }, [denom])

    useEffect(() => {
        let cancelled = false

        fetchSupply().then(result => {
            if (cancelled) return
            setSupply(result)
            setIsLoading(false)
        })

        return () => { cancelled = true }
    }, [fetchSupply])

    const refresh = useCallback(async () => {
        setSupply(await fetchSupply())
    }, [fetchSupply])

    return { supply, isLoading, refresh }
}
