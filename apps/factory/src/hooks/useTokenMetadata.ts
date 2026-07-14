'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MetadataSDKType } from '@bze/bzejs/cosmos/bank/v1beta1/bank'
import { getRestClient } from '@bze/bze-ui-kit'

/**
 * On-chain bank metadata of a denom, fetched fresh so the manage flows edit
 * exactly what the chain holds right now. Uses the query-string variant of the
 * endpoint — factory denoms contain "/" and would break the path-based one.
 */
export function useTokenMetadata(denom: string) {
    const [metadata, setMetadata] = useState<MetadataSDKType | undefined>(undefined)
    const [isLoading, setIsLoading] = useState(true)

    const fetchMetadata = useCallback(async () => {
        if (!denom) return undefined
        try {
            const client = await getRestClient()
            const res = await client.cosmos.bank.v1beta1.denomMetadataByQueryString({ denom })
            return res.metadata
        } catch (e) {
            console.error('failed to fetch metadata of', denom, e)
            return undefined
        }
    }, [denom])

    useEffect(() => {
        let cancelled = false

        fetchMetadata().then(result => {
            if (cancelled) return
            setMetadata(result)
            setIsLoading(false)
        })

        return () => { cancelled = true }
    }, [fetchMetadata])

    const refresh = useCallback(async () => {
        setMetadata(await fetchMetadata())
    }, [fetchMetadata])

    return { metadata, isLoading, refresh }
}
