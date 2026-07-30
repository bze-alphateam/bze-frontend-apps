'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    getChainName,
    getFactoryDenomAdminAddress,
    useAssets,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { filterMyTokens, toMyTokens, type MyToken } from '@/lib/my-tokens'

export type { MyToken }

/**
 * The connected user's own factory tokens: assets filtered by the
 * factory/{address}/ denom prefix, enriched with each denom's admin address.
 * Admin lookups are per-denom (the chain has no batched authority query) but a
 * creator owns few tokens, so N small requests are fine.
 */
export function useMyTokens() {
    const { assets, isLoading: isAssetsLoading } = useAssets()
    const { address } = useChain(getChainName())

    const myAssets = useMemo(() => filterMyTokens(assets ?? [], address), [assets, address])

    // undefined until the first fetch resolves — '' is a real value (renounced).
    const [admins, setAdmins] = useState<Record<string, string> | undefined>(undefined)

    const fetchAdmins = useCallback(async () => {
        const entries = await Promise.all(
            myAssets.map(async a => [a.denom, await getFactoryDenomAdminAddress(a.denom)] as const)
        )
        return Object.fromEntries(entries)
    }, [myAssets])

    useEffect(() => {
        let cancelled = false

        // Promise.all over an empty list resolves immediately to {}.
        fetchAdmins().then(result => {
            if (!cancelled) setAdmins(result)
        })

        return () => { cancelled = true }
    }, [fetchAdmins])

    const refreshAdmins = useCallback(async () => {
        setAdmins(await fetchAdmins())
    }, [fetchAdmins])

    const tokens: MyToken[] = useMemo(
        () => toMyTokens(myAssets, admins),
        [myAssets, admins]
    )

    return {
        tokens,
        isLoading: isAssetsLoading || (myAssets.length > 0 && admins === undefined),
        /** Re-fetch admin addresses — call after a changeAdmin/renounce tx. */
        refreshAdmins,
    }
}
