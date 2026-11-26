'use client'

import {useCallback, useEffect, useMemo, useState} from "react";
import {getBlockedDenoms, getClosedChannels} from "../query/guardian";

export interface UseIbcRouteStatusResult {
    /** `channelId` is the BZE-side channel id; exact match (`channel-3` is not `channel-30`). */
    isChannelClosed: (channelId: string | undefined) => boolean;
    /** `denom` is the BZE-side denom; exact, case-sensitive match. */
    isDenomBlocked: (denom: string | undefined) => boolean;
    loading: boolean;
}

/**
 * Guardian stops on IBC routes (chain v8.3.0): closed transfer channels and blocked denoms.
 * Nothing is stopped while loading and when the queries fail (fail open). Reloads on mount and
 * whenever `refreshKey` changes (pass e.g. the drawer-open flag); the readers' 60s cache keeps
 * that cheap.
 */
export function useIbcRouteStatus(refreshKey?: unknown): UseIbcRouteStatusResult {
    const [state, setState] = useState<{channels: string[]; denoms: string[]} | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getClosedChannels(), getBlockedDenoms()]).then(([channels, denoms]) => {
            if (!cancelled) setState({channels, denoms});
        });
        return () => { cancelled = true; };
    }, [refreshKey]);

    const channels = useMemo(() => new Set(state?.channels ?? []), [state]);
    const denoms = useMemo(() => new Set(state?.denoms ?? []), [state]);

    const isChannelClosed = useCallback((id: string | undefined) => !!id && channels.has(id), [channels]);
    const isDenomBlocked = useCallback((d: string | undefined) => !!d && denoms.has(d), [denoms]);

    return {isChannelClosed, isDenomBlocked, loading: state === undefined};
}
