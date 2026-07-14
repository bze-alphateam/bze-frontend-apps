'use client'

import { useCallback, useMemo } from 'react'
import { TxOptions, useBZETx } from '@bze/bze-ui-kit'

type BzeTx = ReturnType<typeof useBZETx>['tx']

/**
 * Every factory flow submits BZE custom-module messages (tokenfactory,
 * tradebin, rewards). bzejs v3's amino converters produce sign-doc bytes the
 * chain rejects with code 4 (signature verification failed), so all factory
 * transactions sign in direct (protobuf) mode — the same workaround the dex
 * uses for IBC transfers. Use this instead of useBZETx everywhere in this app.
 */
export function useFactoryTx() {
    const { tx: bzeTx, progressTrack } = useBZETx()

    const tx: BzeTx = useCallback(
        (msgs: Parameters<BzeTx>[0], options?: TxOptions) =>
            bzeTx(msgs, { ...options, useDirectSign: true }),
        [bzeTx]
    )

    return useMemo(() => ({ tx, progressTrack }), [tx, progressTrack])
}
