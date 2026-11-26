'use client'

import { useCallback, useEffect, useState } from 'react'
import { getDenomConfigInfo, type DenomConfigInfo } from '@bze/bze-ui-kit'

interface Lookup {
    denom: string;
    info: DenomConfigInfo;
}

/**
 * The tokenfactory config of one denom (v8.3.0): `undefined` while loading (and for a changed
 * denom until its own answer arrives), then the helper's answer, whose `status` says `unsupported`
 * on v8.2.0 nodes. `refresh()` asks the node again past the 5-minute cache, for after a tx.
 */
export function useDenomConfig(denom: string) {
    const [lookup, setLookup] = useState<Lookup | undefined>(undefined)

    useEffect(() => {
        if (!denom) return
        let cancelled = false
        getDenomConfigInfo(denom).then(info => {
            if (!cancelled) setLookup({ denom, info })
        })
        return () => { cancelled = true }
    }, [denom])

    const refresh = useCallback(async () => {
        if (!denom) return
        const info = await getDenomConfigInfo(denom, { fresh: true })
        setLookup({ denom, info })
    }, [denom])

    return { config: lookup?.denom === denom ? lookup.info : undefined, refresh }
}
