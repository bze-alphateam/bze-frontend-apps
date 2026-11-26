'use client'

import { useCallback, useEffect, useState } from 'react'
import { getFactoryDenomAuthority } from '@bze/bze-ui-kit'

interface Lookup {
    denom: string;
    admin: string | undefined;
    mintable: boolean | undefined;
    mintableKnown: boolean;
}

/**
 * The current tokenfactory admin of one denom, asked live from the chain (`DenomAuthority`) each
 * time the token page opens: an address, '' when renounced, undefined when the query failed;
 * `mintable` is whether minting is still on (undefined with the admin when the query failed).
 * A changed denom is loading until its own answer arrives. `refresh()` asks again (Retry, or
 * after a transfer or renounce). An empty denom never queries.
 */
export function useDenomAdmin(denom: string) {
    const [lookup, setLookup] = useState<Lookup | undefined>(undefined)

    useEffect(() => {
        if (!denom) return
        let cancelled = false
        getFactoryDenomAuthority(denom).then(authority => {
            if (!cancelled) setLookup({ denom, admin: authority?.admin, mintable: authority?.mintable, mintableKnown: authority?.mintableKnown ?? false })
        })
        return () => { cancelled = true }
    }, [denom])

    const refresh = useCallback(async () => {
        if (!denom) return
        setLookup(undefined)
        const authority = await getFactoryDenomAuthority(denom)
        setLookup({ denom, admin: authority?.admin, mintable: authority?.mintable, mintableKnown: authority?.mintableKnown ?? false })
    }, [denom])

    const isCurrent = lookup?.denom === denom
    return {
        admin: isCurrent ? lookup.admin : undefined,
        mintable: isCurrent ? lookup.mintable : undefined,
        /** Whether the node's answer carried `mintable` (v8.3.0+); false on v8.2.0 and while unknown. */
        mintableKnown: isCurrent ? lookup.mintableKnown : false,
        isLoading: Boolean(denom) && !isCurrent,
        refresh,
    }
}
