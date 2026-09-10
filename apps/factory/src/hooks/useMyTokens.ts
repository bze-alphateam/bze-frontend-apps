'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    getChainName,
    getFactoryDenomAdmin,
    useAssets,
} from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { filterMyTokens, toMyTokens, type AdminMap, type MyToken } from '@/lib/my-tokens'

export type { MyToken }

/**
 * The connected user's own factory tokens: assets filtered by the
 * factory/{address}/ denom prefix, enriched with each denom's admin address.
 * Admin lookups are per-denom (the chain has no batched authority query) but a
 * creator owns few tokens, so N small requests are fine.
 *
 * Admin semantics: an address, '' when renounced, undefined when the lookup
 * failed — the UI shows a trust badge only for the first two.
 */
export function useMyTokens() {
    const { assets, isLoading: isAssetsLoading } = useAssets()
    const { address } = useChain(getChainName())

    const myAssets = useMemo(() => filterMyTokens(assets ?? [], address), [assets, address])

    // The admin map is only valid for the address + token set it was fetched
    // for; keying it lets a wallet switch fall back to "loading" instead of
    // showing the previous address's admins on the new tokens.
    const adminsKey = `${address ?? ''}|${myAssets.map(a => a.denom).join(',')}`
    const [adminsState, setAdminsState] = useState<{ key: string; admins: AdminMap } | undefined>(undefined)
    const admins = adminsState?.key === adminsKey ? adminsState.admins : undefined

    const fetchAdmins = useCallback(async (): Promise<AdminMap> => {
        const entries = await Promise.all(
            myAssets.map(async a => [a.denom, await getFactoryDenomAdmin(a.denom)] as const)
        )
        return Object.fromEntries(entries)
    }, [myAssets])

    useEffect(() => {
        let cancelled = false

        // Promise.all over an empty list resolves immediately to {}.
        fetchAdmins().then(result => {
            if (!cancelled) setAdminsState({ key: adminsKey, admins: result })
        })

        return () => { cancelled = true }
    }, [fetchAdmins, adminsKey])

    const refreshAdmins = useCallback(async () => {
        setAdminsState({ key: adminsKey, admins: await fetchAdmins() })
    }, [fetchAdmins, adminsKey])

    const tokens: MyToken[] = useMemo(
        () => toMyTokens(myAssets, admins),
        [myAssets, admins]
    )

    return {
        tokens,
        isLoading: isAssetsLoading || (myAssets.length > 0 && admins === undefined),
        /** Re-fetch admin addresses — call after a changeAdmin/renounce tx, or to retry a failed lookup. */
        refreshAdmins,
    }
}
