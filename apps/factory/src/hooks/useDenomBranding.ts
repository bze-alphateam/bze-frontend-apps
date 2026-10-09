'use client'

import { useCallback, useEffect, useState } from 'react'
import { DenomBranding, getDenomBranding } from '@bze/bze-ui-kit'

interface DenomBrandingState {
    /** The stored kit; null when the token has none (or before the first load). */
    branding: DenomBranding | null;
    /** The query failed (node down, or a node older than v8.2.0) — whether a kit exists is unknown. */
    hasError: boolean;
}

async function loadBranding(denom: string): Promise<DenomBrandingState> {
    try {
        return { branding: await getDenomBranding(denom), hasError: false }
    } catch (e) {
        console.error('failed to load the brand kit of', denom, e)
        return { branding: null, hasError: true }
    }
}

/**
 * The on-chain brand kit of `denom` (chain v8.2.0), read straight from the chain; `refresh` after
 * every set/remove tx. An error is reported as `hasError`, never as "no brand kit".
 */
export function useDenomBranding(denom: string) {
    const [state, setState] = useState<DenomBrandingState>({ branding: null, hasError: false })
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!denom) return
        let cancelled = false

        loadBranding(denom).then(result => {
            if (cancelled) return
            setState(result)
            setIsLoading(false)
        })

        return () => { cancelled = true }
    }, [denom])

    const refresh = useCallback(async () => {
        setState(await loadBranding(denom))
    }, [denom])

    return { ...state, isLoading, refresh }
}
