'use client'

import { useCallback, useMemo } from 'react'
import { TxOptions, useBZETx } from '@bze/bze-ui-kit'

type BzeTx = ReturnType<typeof useBZETx>['tx']

export function useFactoryTx() {
    const { tx: bzeTx, progressTrack } = useBZETx()

    const tx: BzeTx = useCallback(
        (msgs: Parameters<BzeTx>[0], options?: TxOptions) =>
            bzeTx(msgs, options),
        [bzeTx]
    )

    return useMemo(() => ({ tx, progressTrack }), [tx, progressTrack])
}
