'use client'

import { useEffect, useState } from 'react'
import type { Dao, DaoControllerResponse } from '@bze/bze-ui-kit'
import {
    defaultDaoAdminServices,
    daoOf,
    lookupDaoAdmin,
    type DaoAdminLookup,
    type DaoAdminServices,
} from '@/lib/dao-admin'

/**
 * DAO-admin lookups for a set of addresses (BFE-387): the token page asks for one, "Created by you" for
 * the admins of the wallet's own tokens. Cached for five minutes. An address missing from `lookups` is
 * still loading; a 501 node or a failed lookup never throws, it reads as `unsupported` / `failed`.
 */
export function useDaoAdmins(addresses: ReadonlyArray<string | undefined>, services: DaoAdminServices = defaultDaoAdminServices) {
    const key = [...new Set(addresses.filter((a): a is string => !!a))].sort().join(',')
    const [state, setState] = useState<{ key: string; lookups: Record<string, DaoAdminLookup> } | undefined>(undefined)

    useEffect(() => {
        if (!key) return
        let cancelled = false
        const list = key.split(',')
        Promise.all(list.map(async (a) => [a, await lookupDaoAdmin(a, services)] as const)).then((entries) => {
            if (!cancelled) setState({ key, lookups: Object.fromEntries(entries) })
        })
        return () => { cancelled = true }
    }, [key, services])

    const ready = state?.key === key
    return { lookups: ready ? state.lookups : ({} as Record<string, DaoAdminLookup>), isLoading: key !== '' && !ready }
}

/** The DAO behind one address, when the address is a DAO's account. */
export function useDaoAdmin(address: string | undefined, services: DaoAdminServices = defaultDaoAdminServices) {
    const { lookups, isLoading } = useDaoAdmins([address], services)
    const lookup = address ? lookups[address] : undefined
    return { lookup, dao: daoOf(lookup), isLoading }
}

/** Who ultimately controls a DAO. undefined while loading and when the lookup failed (the line is just left out). */
export function useDaoController(dao: Pick<Dao, 'id'> | undefined, services: DaoAdminServices = defaultDaoAdminServices): DaoControllerResponse | undefined {
    const id = dao?.id
    const [state, setState] = useState<{ id: string; controller: DaoControllerResponse | undefined } | undefined>(undefined)

    useEffect(() => {
        if (!id) return
        let cancelled = false
        services.controller(id).then(
            (controller) => { if (!cancelled) setState({ id, controller: controller ?? undefined }) },
            () => { if (!cancelled) setState({ id, controller: undefined }) },
        )
        return () => { cancelled = true }
    }, [id, services])

    return id && state?.id === id ? state.controller : undefined
}

/** Whether the node runs x/dao; undefined until known and when the check failed. */
export function useDaoModuleSupported(services: DaoAdminServices = defaultDaoAdminServices): boolean | undefined {
    const [supported, setSupported] = useState<boolean | undefined>(undefined)
    useEffect(() => {
        let cancelled = false
        services.isSupported().then(
            (v) => { if (!cancelled) setSupported(v) },
            () => { if (!cancelled) setSupported(undefined) },
        )
        return () => { cancelled = true }
    }, [services])
    return supported
}
