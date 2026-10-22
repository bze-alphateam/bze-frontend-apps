'use client'

import { useCallback, useEffect, useState } from 'react'
import { getFactoryDenomAdmin } from '@bze/bze-ui-kit'

interface Lookup {
    denom: string;
    admin: string | undefined;
}

/**
 * The current tokenfactory admin of one denom, asked live from the chain (`DenomAuthority`) each
 * time the token page opens: an address, '' when renounced, undefined when the query failed.
 * A changed denom is loading until its own answer arrives. `refresh()` asks again (Retry, or
 * after a transfer or renounce). An empty denom never queries.
 */
export function useDenomAdmin(denom: string) {
    const [lookup, setLookup] = useState<Lookup | undefined>(undefined)

    useEffect(() => {
        if (!denom) return
        let cancelled = false
        getFactoryDenomAdmin(denom).then(admin => {
            if (!cancelled) setLookup({ denom, admin })
        })
        return () => { cancelled = true }
    }, [denom])

    const refresh = useCallback(async () => {
        if (!denom) return
        setLookup(undefined)
        setLookup({ denom, admin: await getFactoryDenomAdmin(denom) })
    }, [denom])

    const isCurrent = lookup?.denom === denom
    return {
        admin: isCurrent ? lookup.admin : undefined,
        isLoading: Boolean(denom) && !isCurrent,
        refresh,
    }
}
