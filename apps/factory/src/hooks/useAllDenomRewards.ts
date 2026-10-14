'use client'

import { useCallback, useEffect, useState } from 'react'
import { DenomReward, getAllDenomRewards } from '@bze/bze-ui-kit'

type State =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; list: DenomReward[] }

/** Every holder reward on the chain, with a `retry` after a failed load. */
export function useAllDenomRewards() {
    const [state, setState] = useState<State>({ status: 'loading' })
    const [reload, setReload] = useState(0)

    useEffect(() => {
        let cancelled = false
        getAllDenomRewards()
            .then((list): State => ({ status: 'ready', list }))
            .catch((e): State => {
                console.error('failed to load the denom rewards', e)
                return { status: 'error' }
            })
            .then(next => {
                if (!cancelled) setState(next)
            })
        return () => { cancelled = true }
    }, [reload])

    const retry = useCallback(() => {
        setState({ status: 'loading' })
        setReload(n => n + 1)
    }, [])

    return {
        list: state.status === 'ready' ? state.list : undefined,
        isLoading: state.status === 'loading',
        hasError: state.status === 'error',
        retry,
    }
}
