import {getExplorerBaseURL} from "../constants/chain";
import {getFromLocalStorage, setInLocalStorage} from "../storage/storage";
import type {RegistryAssetsResponse} from "../types/registry_asset";

/**
 * BZE Scan's asset list (GET /api/v1/registry/assets). Scan sends CORS for any origin plus
 * `Cache-Control: public, max-age=30` and an ETag, so the browser calls it directly and its
 * HTTP cache revalidates by itself; `noCache` forces that revalidation (after the user's own
 * asset-changing transaction).
 *
 * The last good list is kept in localStorage, read only when Scan cannot be reached.
 */

const CACHE_KEY = "registry_assets";
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — setInLocalStorage takes seconds

export const getRegistryAssetsURL = (): string => `${getExplorerBaseURL()}/api/v1/registry/assets`

const isRegistryAssetsResponse = (body: unknown): body is RegistryAssetsResponse => {
    const b = body as Partial<RegistryAssetsResponse> | null
    return !!b
        && typeof b.version === 'string'
        && b.version.length > 0
        && Array.isArray(b.assets)
        && b.assets.every(a => !!a && typeof a.denom === 'string' && typeof a.ticker === 'string' && typeof a.decimals === 'number')
}

/** Fetches the list from Scan; undefined on a network error, a non-2xx answer or an invalid body. */
export const fetchRegistryAssets = async (noCache = false): Promise<RegistryAssetsResponse | undefined> => {
    try {
        const resp = await fetch(getRegistryAssetsURL(), noCache ? {cache: 'no-cache'} : undefined)
        if (!resp.ok) {
            console.warn(`[registry_assets] Scan answered ${resp.status}`)
            return undefined
        }
        const body: unknown = await resp.json()
        if (!isRegistryAssetsResponse(body)) {
            console.warn('[registry_assets] invalid asset list from Scan')
            return undefined
        }
        setInLocalStorage(CACHE_KEY, JSON.stringify(body), CACHE_TTL_SECONDS)

        return body
    } catch (e) {
        console.warn('[registry_assets] Scan unreachable', e)
        return undefined
    }
}

/** The last list fetched from Scan in this browser, if any. */
export const getCachedRegistryAssets = (): RegistryAssetsResponse | undefined => {
    const cached = getFromLocalStorage(CACHE_KEY)
    if (!cached) return undefined
    try {
        const parsed: unknown = JSON.parse(cached)
        return isRegistryAssetsResponse(parsed) ? parsed : undefined
    } catch {
        return undefined
    }
}
