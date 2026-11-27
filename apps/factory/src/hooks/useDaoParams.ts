'use client'

import { useCallback, useEffect, useState } from 'react'
import { DaoModuleNotSupportedError, getDaoParams, type DaoParams } from '@bze/bze-ui-kit'

export type DaoParamsState =
    | { status: 'loading' }
    | { status: 'unsupported' }
    | { status: 'error' }
    | { status: 'ready'; params: DaoParams }

/**
 * The x/dao params (BFE-388): `unsupported` on a node without the module (v8.2.x answers 501), `error`
 * when the query failed (`retry` asks again). `getParams` is injectable for tests.
 */
export function useDaoParams(getParams: () => Promise<DaoParams> = getDaoParams): DaoParamsState & { retry: () => void } {
    const [state, setState] = useState<DaoParamsState>({ status: 'loading' })
    const [reload, setReload] = useState(0)

    useEffect(() => {
        let cancelled = false
        getParams()
            .then((params): DaoParamsState => ({ status: 'ready', params }))
            .catch((e): DaoParamsState => (e instanceof DaoModuleNotSupportedError ? { status: 'unsupported' } : { status: 'error' }))
            .then(next => { if (!cancelled) setState(next) })
        return () => { cancelled = true }
    }, [getParams, reload])

    const retry = useCallback(() => {
        setState({ status: 'loading' })
        setReload(n => n + 1)
    }, [])

    return { ...state, retry }
}
