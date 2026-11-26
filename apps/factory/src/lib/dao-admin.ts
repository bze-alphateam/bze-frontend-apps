import {
    getDaoByAddress,
    getDaoController,
    getChainId,
    getFromLocalStorage,
    isDaoModuleSupported,
    setInLocalStorage,
    truncateAddress,
} from '@bze/bze-ui-kit'
import type { Dao, DaoControllerResponse } from '@bze/bze-ui-kit'

// x/dao (chain v8.3.0): a token's admin can be a DAO's account. These helpers recognise one (BFE-387),
// word it, and cache the lookup. The queries are BFE-369's, injected so tests swap them.

/** What the admin lookups need from the chain; the defaults are the ui-kit x/dao queries. */
export interface DaoAdminServices {
    isSupported: () => Promise<boolean>;
    byAddress: (address: string) => Promise<Dao | null>;
    controller: (daoId: string) => Promise<DaoControllerResponse | null>;
}

export const defaultDaoAdminServices: DaoAdminServices = {
    isSupported: isDaoModuleSupported,
    byAddress: getDaoByAddress,
    controller: getDaoController,
}

/**
 * The answer for one address. `none`: not a DAO's account. `unsupported`: the node does not run x/dao
 * (v8.2.x). `failed`: the lookup broke. The last two read like `none` in the UI: no DAO wording, no error.
 */
export type DaoAdminLookup =
    | { status: 'dao'; dao: Dao }
    | { status: 'none' }
    | { status: 'unsupported' }
    | { status: 'failed' }

/** The lookup's cache lifetime, in seconds (the ui-kit storage helper's unit). */
export const DAO_ADMIN_CACHE_TTL_SECONDS = 5 * 60

// Per network, so a testnet answer is never read on mainnet.
const cacheKey = (address: string) => `factory-dao-admin-${getChainId()}-${address}`

function readCache(address: string): DaoAdminLookup | undefined {
    try {
        const raw = getFromLocalStorage(cacheKey(address))
        if (!raw) return undefined
        const parsed = JSON.parse(raw) as { dao: Dao | null }
        return parsed.dao ? { status: 'dao', dao: parsed.dao } : undefined
    } catch {
        return undefined
    }
}

/** Looks one address up: is it a DAO's account? Only a DAO answer is cached. */
export async function lookupDaoAdmin(address: string, services: DaoAdminServices = defaultDaoAdminServices): Promise<DaoAdminLookup> {
    const cached = readCache(address)
    if (cached) return cached
    try {
        if (!(await services.isSupported())) return { status: 'unsupported' }
        const dao = await services.byAddress(address)
        // Only a DAO is cached: an address that is no DAO's yet may become one (create a DAO, then hand over).
        if (dao) setInLocalStorage(cacheKey(address), JSON.stringify({ dao }), DAO_ADMIN_CACHE_TTL_SECONDS)
        return dao ? { status: 'dao', dao } : { status: 'none' }
    } catch {
        return { status: 'failed' }
    }
}

/** The DAO behind a lookup, when there is one. */
export const daoOf = (lookup: DaoAdminLookup | undefined): Dao | undefined => lookup?.status === 'dao' ? lookup.dao : undefined

/** "DAO Honey Guild (#7)". */
export const daoLabel = (dao: Pick<Dao, 'id' | 'name'>) => `DAO ${dao.name} (#${dao.id})`

/** How the DAO decides. `tickerOf` names the staked token of a stake DAO when it is known. */
export function daoTypeLine(dao: Pick<Dao, 'type' | 'electorate'>, tickerOf: (denom: string) => string | undefined = () => undefined): string {
    if (dao.type === 'DAO_TYPE_STATIC_LIST') return 'Voted by its members'
    const ticker = dao.electorate?.dr_denom ? tickerOf(dao.electorate.dr_denom) : undefined
    return ticker ? `Voted by the stakers of ${ticker}` : 'Voted by the stakers of its staking rewards'
}

/** Who ultimately controls the DAO, from its admin chain. */
export function daoControllerLine(controller: DaoControllerResponse): string {
    switch (controller.end_reason) {
        case 'SELF_OWNED':
            return 'Controlled by its voters'
        case 'ACCOUNT':
            return `Controlled by ${truncateAddress(controller.controller)}`
        case 'CYCLE':
            return `Controlled by DAO ${truncateAddress(controller.controller)} (its admins form a loop)`
        case 'DEPTH_CAP':
            return 'Controlled through a chain of more than 16 DAOs'
        default:
            return ''
    }
}

/** The review step's extra line when the new admin is a DAO. */
export const daoHandoverNote = (ticker: string) =>
    `From now on, changes to ${ticker} need this DAO: a proposal its voters pass, or its admin.`

/** The hint under the address field. */
export const daoAddressHint = (ticker: string) => `Hand ${ticker} to a DAO: paste the DAO's address.`

/** The DAO's page in the DAO app. */
export function daoPageHref(baseUrl: string, daoId: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/dao/${encodeURIComponent(daoId)}`
}
