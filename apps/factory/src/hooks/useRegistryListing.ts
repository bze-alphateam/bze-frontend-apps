'use client'

import { useCallback, useEffect, useState } from 'react'
import { getFromLocalStorage, isTestnetChain, setInLocalStorage } from '@bze/bze-ui-kit'
import { registryAssetListUrl } from '@/lib/registry-entry'

/** 'off' on testnet: the registry lists mainnet tokens only. */
export type RegistryListingStatus = 'off' | 'loading' | 'listed' | 'not-listed' | 'error'

interface ListedAsset {
    base: string;
    logo?: string;
}

const CACHE_KEY = 'factory_registry_assets'
const CACHE_TTL_MS = 15 * 60 * 1000

interface RawAsset {
    base?: string;
    logo_URIs?: { png?: string; svg?: string };
}

/** Only the bases and logos are kept, so the cache stays small. */
async function fetchListedAssets(): Promise<ListedAsset[]> {
    const res = await fetch(registryAssetListUrl())
    if (!res.ok) throw new Error(`registry answered ${res.status}`)
    const body = await res.json() as { assets?: RawAsset[] }
    return (body.assets ?? [])
        .filter((a): a is RawAsset & { base: string } => typeof a.base === 'string')
        .map(a => ({ base: a.base, logo: a.logo_URIs?.svg ?? a.logo_URIs?.png }))
}

// One request at a time for every hook on the page (the Overview and the Profile tab both ask).
let inFlight: Promise<ListedAsset[]> | undefined

async function loadListedAssets(force: boolean): Promise<ListedAsset[]> {
    if (!force) {
        const cached = getFromLocalStorage(CACHE_KEY)
        if (cached) {
            try {
                return JSON.parse(cached) as ListedAsset[]
            } catch {
                // fall through to a fresh fetch
            }
        }
    }
    inFlight ??= fetchListedAssets()
        .then(assets => {
            setInLocalStorage(CACHE_KEY, JSON.stringify(assets), CACHE_TTL_MS)
            return assets
        })
        .finally(() => { inFlight = undefined })
    return inFlight
}

/**
 * Whether `denom` is in the Cosmos Chain Registry's BeeZee asset list (BFE-164), read from the
 * raw file on GitHub (it allows any origin) and cached in this browser for 15 minutes.
 */
export function useRegistryListing(denom: string) {
    const off = isTestnetChain() || !denom
    const [result, setResult] = useState<{ status: RegistryListingStatus; logo?: string }>({ status: off ? 'off' : 'loading' })
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        if (off) return
        let cancelled = false
        loadListedAssets(attempt > 0)
            .then(assets => {
                if (cancelled) return
                const entry = assets.find(a => a.base === denom)
                setResult(entry ? { status: 'listed', logo: entry.logo } : { status: 'not-listed' })
            })
            .catch(() => {
                if (!cancelled) setResult({ status: 'error' })
            })
        return () => { cancelled = true }
    }, [denom, off, attempt])

    const retry = useCallback(() => {
        setResult({ status: 'loading' })
        setAttempt(a => a + 1)
    }, [])

    return { status: off ? 'off' as const : result.status, logo: result.logo, retry }
}
