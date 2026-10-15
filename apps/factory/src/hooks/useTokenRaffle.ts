'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RaffleSDKType } from '@bze/bzejs/bze/burner/raffle'
import { getRafflesOrThrow } from '@bze/bze-ui-kit'

export type TokenRaffle =
    | { status: 'loading' }
    | { status: 'running'; raffle: RaffleSDKType }
    | { status: 'none' }
    | { status: 'error' }

interface Lookup {
    key: string;
    result: TokenRaffle;
}

/**
 * The raffle running for `denom` (one per denom on chain), or none. A failed query is an
 * `error`, never "none running": the raffle form and the Supply card must not offer to start a
 * raffle the chain would refuse. `refresh()` looks it up again (after a tx, on Retry).
 */
export function useTokenRaffle(denom: string | undefined) {
    const [version, setVersion] = useState(0)
    const [lookup, setLookup] = useState<Lookup | undefined>(undefined)
    const key = `${denom ?? ''}#${version}`

    useEffect(() => {
        if (!denom) return
        let live = true
        const load = async () => {
            let result: TokenRaffle
            try {
                const raffles = await getRafflesOrThrow()
                const raffle = raffles.find(r => r.denom === denom)
                result = raffle ? { status: 'running', raffle } : { status: 'none' }
            } catch {
                result = { status: 'error' }
            }
            if (live) setLookup({ key, result })
        }
        void load()
        return () => {
            live = false
        }
    }, [denom, key])

    const refresh = useCallback(() => setVersion(v => v + 1), [])
    const raffle: TokenRaffle = denom && lookup?.key === key ? lookup.result : { status: 'loading' }

    return { raffle, refresh }
}
